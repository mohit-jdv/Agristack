-- ============================================================================
-- AgriStack — Queue correctness (join recalc, locks, MOVE_UP/DOWN, notifications,
-- Realtime publication, prototype-safe RPC grants)
-- Safe to apply after 0003 + 0004. CREATE OR REPLACE / IF NOT EXISTS throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notifications.event_key — dedupe automatic position/status alerts
-- ----------------------------------------------------------------------------
alter table notifications
  add column if not exists event_key text;

create unique index if not exists idx_notifications_entry_event_key
  on notifications (queue_entry_id, event_key)
  where event_key is not null;

-- ----------------------------------------------------------------------------
-- Helper: insert notification once per (entry, event_key)
-- ----------------------------------------------------------------------------
create or replace function notify_queue_event(
  p_entry_id uuid,
  p_event_key text,
  p_message text,
  p_kind text default 'info'
)
returns void
language plpgsql
security definer
as $$
begin
  if p_event_key is null or p_entry_id is null then
    return;
  end if;

  insert into notifications (queue_entry_id, message, kind, event_key)
  values (p_entry_id, p_message, p_kind, p_event_key)
  on conflict do nothing;

  -- Partial unique index does not create an ON CONFLICT target automatically
  -- for all PG versions without a constraint name. Use existence check instead.
exception
  when unique_violation then
    null;
end;
$$;

-- More portable dedupe without relying on ON CONFLICT target:
create or replace function notify_queue_event(
  p_entry_id uuid,
  p_event_key text,
  p_message text,
  p_kind text default 'info'
)
returns void
language plpgsql
security definer
as $$
begin
  if p_entry_id is null or p_event_key is null or length(trim(p_event_key)) = 0 then
    return;
  end if;

  if exists (
    select 1 from notifications
    where queue_entry_id = p_entry_id
      and event_key = p_event_key
  ) then
    return;
  end if;

  insert into notifications (queue_entry_id, message, kind, event_key)
  values (p_entry_id, p_message, coalesce(p_kind, 'info'), p_event_key);
end;
$$;

-- ----------------------------------------------------------------------------
-- average_processing_minutes (unchanged logic, keep available)
-- ----------------------------------------------------------------------------
create or replace function average_processing_minutes(p_centre_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    (select avg(duration_minutes)::numeric
     from processing_records
     where procurement_centre_id = p_centre_id
       and completed_at > now() - interval '30 days'),
    15
  );
$$;

-- ----------------------------------------------------------------------------
-- recalculate_centre_queue — positions + ETAs + position notifications
-- ----------------------------------------------------------------------------
create or replace function recalculate_centre_queue(p_centre_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  r record;
  pos integer := 0;
  avg_min numeric;
  v_old_pos integer;
begin
  avg_min := average_processing_minutes(p_centre_id);

  for r in
    select id, position as old_position, status
    from queue_entries
    where procurement_centre_id = p_centre_id
      and status in ('WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING')
    order by
      case status
        when 'PROCESSING' then 0
        when 'ACCEPTED' then 1
        when 'WAITING' then 2
        when 'HOLD' then 3
        else 4
      end,
      position,
      joined_at
  loop
    pos := pos + 1;
    v_old_pos := r.old_position;

    update queue_entries
    set
      position = pos,
      estimated_wait_minutes = greatest(0, round((pos - 1) * avg_min)::integer),
      updated_at = now()
    where id = r.id;

    -- Allow re-notify if farmer later returns to pos 1 or 2
    if pos is distinct from 1 and v_old_pos = 1 then
      delete from notifications
      where queue_entry_id = r.id and event_key = 'you_are_next';
    end if;
    if pos is distinct from 2 and v_old_pos = 2 then
      delete from notifications
      where queue_entry_id = r.id and event_key = 'approaching';
    end if;

    -- Position alerts; notify_queue_event is idempotent per event_key
    if pos = 1 and r.status in ('WAITING', 'ACCEPTED', 'HOLD') then
      perform notify_queue_event(
        r.id,
        'you_are_next',
        'You are next. Please proceed to the procurement centre.',
        'action'
      );
    elsif pos = 2 and r.status in ('WAITING', 'ACCEPTED', 'HOLD') then
      perform notify_queue_event(
        r.id,
        'approaching',
        'Your turn is approaching. Please prepare to proceed to the procurement centre.',
        'action'
      );
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- next_token (unchanged behaviour, security definer)
-- ----------------------------------------------------------------------------
create or replace function next_token(p_centre_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_day date := current_date;
  v_next integer;
  v_prefix text;
begin
  insert into token_counters (procurement_centre_id, day, last_value)
  values (p_centre_id, v_day, 1)
  on conflict (procurement_centre_id, day)
  do update set last_value = token_counters.last_value + 1
  returning last_value into v_next;

  v_prefix := 'PC-' || to_char(v_day, 'YYYYMMDD') || '-';
  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- join_centre_queue — advisory lock + insert + full recalculate
-- ----------------------------------------------------------------------------
create or replace function join_centre_queue(
  p_centre_id uuid,
  p_display_name text,
  p_phone text,
  p_location text,
  p_commodity_name text,
  p_quantity numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_farmer_id uuid;
  v_token text;
  v_entry_id uuid;
  v_centre_name text;
  v_entry queue_entries%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  select name into v_centre_name
  from procurement_centres
  where id = p_centre_id;

  if v_centre_name is null then
    raise exception 'procurement centre not found';
  end if;

  -- Serialize all join/reorder operations for this centre within the transaction
  perform pg_advisory_xact_lock(hashtext('agristack-queue'), hashtext(p_centre_id::text));

  insert into farmers (display_name, phone, location)
  values (
    coalesce(nullif(trim(p_display_name), ''), 'Farmer'),
    nullif(trim(p_phone), ''),
    nullif(trim(p_location), '')
  )
  returning id into v_farmer_id;

  v_token := next_token(p_centre_id);

  -- Temporary position; recalculate assigns the true sequential position
  insert into queue_entries (
    token,
    procurement_centre_id,
    farmer_id,
    commodity_name,
    quantity_quintals,
    status,
    position,
    estimated_wait_minutes
  )
  values (
    v_token,
    p_centre_id,
    v_farmer_id,
    p_commodity_name,
    p_quantity,
    'WAITING',
    (
      select coalesce(max(position), 0) + 1
      from queue_entries
      where procurement_centre_id = p_centre_id
        and status in ('WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING')
    ),
    null
  )
  returning id into v_entry_id;

  perform notify_queue_event(
    v_entry_id,
    'joined',
    'Joined queue at ' || v_centre_name || '. Token ' || v_token || '.',
    'success'
  );

  -- Full recalculate updates ALL active farmers (including this one)
  perform recalculate_centre_queue(p_centre_id);

  insert into queue_records (
    procurement_centre_id,
    recorded_at,
    queue_size,
    processing_capacity,
    actual_wait_minutes
  )
  select
    p_centre_id,
    now(),
    count(*)::integer,
    null,
    null
  from queue_entries
  where procurement_centre_id = p_centre_id
    and status in ('WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING');

  select * into v_entry from queue_entries where id = v_entry_id;

  return jsonb_build_object(
    'entry_id', v_entry.id,
    'token', v_entry.token,
    'position', v_entry.position,
    'estimated_wait_minutes', v_entry.estimated_wait_minutes,
    'status', v_entry.status,
    'centre_name', v_centre_name
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_queue_action — MOVE_UP / MOVE_DOWN, status actions, centre lock
-- ----------------------------------------------------------------------------
create or replace function admin_queue_action(
  p_entry_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_entry queue_entries%rowtype;
  v_centre_id uuid;
  v_new_status text;
  v_msg text;
  v_event_key text;
  v_started timestamptz;
  v_duration integer;
  v_swap queue_entries%rowtype;
  v_tmp_pos integer;
  v_action text := upper(trim(p_action));
begin
  select * into v_entry from queue_entries where id = p_entry_id for update;
  if not found then
    raise exception 'queue entry not found';
  end if;

  v_centre_id := v_entry.procurement_centre_id;
  perform pg_advisory_xact_lock(hashtext('agristack-queue'), hashtext(v_centre_id::text));

  -- Re-read under centre lock
  select * into v_entry from queue_entries where id = p_entry_id for update;

  case v_action
    when 'ACCEPT' then
      if v_entry.status not in ('WAITING', 'HOLD') then
        raise exception 'cannot ACCEPT from status %', v_entry.status;
      end if;
      v_new_status := 'ACCEPTED';
      update queue_entries
      set status = v_new_status, accepted_at = coalesce(accepted_at, now()), updated_at = now()
      where id = p_entry_id;
      v_msg := 'Your token was accepted. Please proceed when called.';
      v_event_key := 'accepted';

    when 'HOLD' then
      if v_entry.status not in ('WAITING', 'ACCEPTED') then
        raise exception 'cannot HOLD from status %', v_entry.status;
      end if;
      v_new_status := 'HOLD';
      update queue_entries set status = v_new_status, updated_at = now() where id = p_entry_id;
      v_msg := 'Your token is on hold. Please wait for further instructions.';
      v_event_key := 'hold';

    when 'RESUME' then
      if v_entry.status <> 'HOLD' then
        raise exception 'cannot RESUME from status %', v_entry.status;
      end if;
      v_new_status := 'WAITING';
      update queue_entries set status = v_new_status, updated_at = now() where id = p_entry_id;
      v_msg := 'Your token is active again in the queue.';
      v_event_key := 'resume';

    when 'PROCESS' then
      if v_entry.status not in ('ACCEPTED', 'WAITING') then
        raise exception 'cannot PROCESS from status %', v_entry.status;
      end if;
      v_new_status := 'PROCESSING';
      update queue_entries
      set status = v_new_status,
          processing_started_at = now(),
          accepted_at = coalesce(accepted_at, now()),
          updated_at = now()
      where id = p_entry_id;
      v_msg := 'Your procurement is now being processed.';
      v_event_key := 'processing';

    when 'DONE' then
      if v_entry.status not in ('PROCESSING', 'ACCEPTED') then
        raise exception 'cannot DONE from status %', v_entry.status;
      end if;
      v_new_status := 'DONE';
      v_started := coalesce(v_entry.processing_started_at, v_entry.accepted_at, v_entry.joined_at);
      v_duration := greatest(0, extract(epoch from (now() - v_started)) / 60)::integer;
      update queue_entries
      set status = v_new_status, completed_at = now(), updated_at = now()
      where id = p_entry_id;
      insert into processing_records (
        procurement_centre_id,
        queue_entry_id,
        commodity_name,
        quantity_quintals,
        started_at,
        completed_at,
        duration_minutes
      ) values (
        v_centre_id,
        p_entry_id,
        v_entry.commodity_name,
        v_entry.quantity_quintals,
        v_started,
        now(),
        v_duration
      );
      v_msg := 'Your procurement has been completed.';
      v_event_key := 'done';

    when 'DEQUEUE', 'CANCEL' then
      v_new_status := 'CANCELLED';
      update queue_entries
      set status = v_new_status, completed_at = now(), updated_at = now()
      where id = p_entry_id;
      v_msg := 'Your token was removed from the queue.';
      v_event_key := 'cancelled';

    when 'MOVE_UP', 'PUSH_UP' then
      -- Swap with the active entry immediately ahead (lower position number)
      if v_entry.status not in ('WAITING', 'ACCEPTED', 'HOLD') then
        raise exception 'cannot MOVE_UP from status %', v_entry.status;
      end if;
      select * into v_swap
      from queue_entries
      where procurement_centre_id = v_centre_id
        and status in ('WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING')
        and position < v_entry.position
      order by position desc
      limit 1
      for update;
      if not found then
        -- Already at front among movable peers; no-op
        v_new_status := v_entry.status;
        v_msg := 'Already at the front of the movable queue.';
        v_event_key := null;
      else
        v_tmp_pos := v_entry.position;
        update queue_entries set position = v_swap.position, updated_at = now()
        where id = v_entry.id;
        update queue_entries set position = v_tmp_pos, updated_at = now()
        where id = v_swap.id;
        v_new_status := v_entry.status;
        v_msg := 'Your position in the queue was updated.';
        v_event_key := 'moved';
      end if;

    when 'MOVE_DOWN', 'PUSH_DOWN', 'PUSH' then
      -- Swap with the active entry immediately behind (higher position number)
      if v_entry.status not in ('WAITING', 'ACCEPTED', 'HOLD') then
        raise exception 'cannot MOVE_DOWN from status %', v_entry.status;
      end if;
      select * into v_swap
      from queue_entries
      where procurement_centre_id = v_centre_id
        and status in ('WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING')
        and position > v_entry.position
      order by position asc
      limit 1
      for update;
      if not found then
        v_new_status := v_entry.status;
        v_msg := 'Already at the end of the movable queue.';
        v_event_key := null;
      else
        v_tmp_pos := v_entry.position;
        update queue_entries set position = v_swap.position, updated_at = now()
        where id = v_entry.id;
        update queue_entries set position = v_tmp_pos, updated_at = now()
        where id = v_swap.id;
        v_new_status := v_entry.status;
        v_msg := 'Your position in the queue was updated.';
        v_event_key := 'moved';
      end if;

    else
      raise exception 'unknown action: %', p_action;
  end case;

  -- Clear stale position event keys when leaving the queue so a future re-join
  -- path (new entry) is independent; for active movers, allow re-notify only
  -- when position actually changes via recalculate's old_pos check.
  if v_new_status in ('DONE', 'CANCELLED') then
    -- keep history; no further position alerts needed
    null;
  end if;

  perform recalculate_centre_queue(v_centre_id);

  if v_event_key is not null and v_msg is not null then
    perform notify_queue_event(p_entry_id, v_event_key, v_msg,
      case
        when v_new_status in ('DONE', 'ACCEPTED') then 'success'
        when v_new_status in ('HOLD', 'CANCELLED') then 'warning'
        when v_event_key = 'processing' then 'action'
        else 'info'
      end
    );
  end if;

  select * into v_entry from queue_entries where id = p_entry_id;

  return jsonb_build_object(
    'entry_id', v_entry.id,
    'token', v_entry.token,
    'status', v_entry.status,
    'position', v_entry.position,
    'estimated_wait_minutes', v_entry.estimated_wait_minutes
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Realtime publication for farmer QueueTicket subscriptions
-- ----------------------------------------------------------------------------
do $$
begin
  -- Add tables to supabase_realtime publication when it exists
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table queue_entries;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table notifications;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- Replica identity full helps Realtime deliver old/new on updates
alter table queue_entries replica identity full;
alter table notifications replica identity full;

-- ----------------------------------------------------------------------------
-- Prototype-safe grants
-- Server actions use the service role. Browser never needs to call admin RPCs.
-- Anon retains SELECT (for Realtime + token page reads) but not admin execute.
-- ----------------------------------------------------------------------------
revoke all on function next_token(uuid) from public, anon, authenticated;
revoke all on function average_processing_minutes(uuid) from public, anon, authenticated;
revoke all on function recalculate_centre_queue(uuid) from public, anon, authenticated;
revoke all on function notify_queue_event(uuid, text, text, text) from public, anon, authenticated;

revoke all on function join_centre_queue(uuid, text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function join_centre_queue(uuid, text, text, text, text, numeric) to service_role;

revoke all on function admin_queue_action(uuid, text) from public, anon, authenticated;
grant execute on function admin_queue_action(uuid, text) to service_role;

grant execute on function average_processing_minutes(uuid) to service_role;
grant execute on function recalculate_centre_queue(uuid) to service_role;
grant execute on function next_token(uuid) to service_role;
grant execute on function notify_queue_event(uuid, text, text, text) to service_role;

-- Note (prototype): queue_entries / notifications remain SELECT for anon so
-- Realtime and token pages work without full auth. Tokens are unguessable
-- (PC-YYYYMMDD-NNNN + uuid internals). Production must add auth + tighter RLS.
