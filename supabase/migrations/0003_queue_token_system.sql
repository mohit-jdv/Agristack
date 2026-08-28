-- ============================================================================
-- AgriStack / KisanSetu — Queue & token system (procurement centres only)
-- Extends the existing schema. Does not modify 0001/0002.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- farmers (lightweight identity — no full auth yet)
-- ----------------------------------------------------------------------------
create table if not exists farmers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  phone text,
  location text,
  created_at timestamptz not null default now()
);

create index if not exists idx_farmers_phone on farmers (phone);

-- ----------------------------------------------------------------------------
-- token_counters — per-centre daily sequence for human-readable tokens
-- ----------------------------------------------------------------------------
create table if not exists token_counters (
  procurement_centre_id uuid not null references procurement_centres (id) on delete cascade,
  day date not null default (current_date),
  last_value integer not null default 0,
  primary key (procurement_centre_id, day)
);

-- ----------------------------------------------------------------------------
-- queue_entries — live tokens / queue positions
-- ----------------------------------------------------------------------------
create table if not exists queue_entries (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  procurement_centre_id uuid not null references procurement_centres (id) on delete cascade,
  farmer_id uuid not null references farmers (id) on delete cascade,
  commodity_name text not null,
  quantity_quintals numeric(12, 2) not null check (quantity_quintals > 0),
  status text not null default 'WAITING'
    check (status in (
      'WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING', 'DONE', 'CANCELLED', 'NO_SHOW'
    )),
  position integer not null check (position >= 1),
  estimated_wait_minutes integer,
  joined_at timestamptz not null default now(),
  accepted_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_queue_entries_centre_status
  on queue_entries (procurement_centre_id, status);
create index if not exists idx_queue_entries_token
  on queue_entries (token);
create index if not exists idx_queue_entries_farmer
  on queue_entries (farmer_id);
create index if not exists idx_queue_entries_position
  on queue_entries (procurement_centre_id, position)
  where status in ('WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING');

drop trigger if exists trg_queue_entries_updated_at on queue_entries;
create trigger trg_queue_entries_updated_at
  before update on queue_entries
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- notifications (in-app status messages for a token)
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid not null references queue_entries (id) on delete cascade,
  message text not null,
  kind text not null default 'info'
    check (kind in ('info', 'success', 'warning', 'action')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_entry
  on notifications (queue_entry_id);

-- ----------------------------------------------------------------------------
-- processing_records — actual processing times for analytics / ETA
-- ----------------------------------------------------------------------------
create table if not exists processing_records (
  id uuid primary key default gen_random_uuid(),
  procurement_centre_id uuid not null references procurement_centres (id) on delete cascade,
  queue_entry_id uuid references queue_entries (id) on delete set null,
  commodity_name text,
  quantity_quintals numeric(12, 2),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_processing_records_centre
  on processing_records (procurement_centre_id);
create index if not exists idx_processing_records_completed
  on processing_records (completed_at);

-- ============================================================================
-- Functions
-- ============================================================================

-- Next human-readable token for a centre (e.g. PC-20260828-0042)
create or replace function next_token(p_centre_id uuid)
returns text
language plpgsql
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

-- Average processing minutes for a centre (fallback 15)
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

-- Recalculate positions + ETAs for active entries at a centre
create or replace function recalculate_centre_queue(p_centre_id uuid)
returns void
language plpgsql
as $$
declare
  r record;
  pos integer := 0;
  avg_min numeric;
begin
  avg_min := average_processing_minutes(p_centre_id);

  for r in
    select id
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
    update queue_entries
    set
      position = pos,
      estimated_wait_minutes = greatest(0, round((pos - 1) * avg_min)::integer),
      updated_at = now()
    where id = r.id;
  end loop;
end;
$$;

-- Farmer joins a procurement-centre queue
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
as $$
declare
  v_farmer_id uuid;
  v_token text;
  v_position integer;
  v_entry_id uuid;
  v_avg numeric;
  v_eta integer;
  v_centre_name text;
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

  insert into farmers (display_name, phone, location)
  values (
    coalesce(nullif(trim(p_display_name), ''), 'Farmer'),
    nullif(trim(p_phone), ''),
    nullif(trim(p_location), '')
  )
  returning id into v_farmer_id;

  select coalesce(max(position), 0) + 1 into v_position
  from queue_entries
  where procurement_centre_id = p_centre_id
    and status in ('WAITING', 'ACCEPTED', 'HOLD', 'PROCESSING');

  v_token := next_token(p_centre_id);
  v_avg := average_processing_minutes(p_centre_id);
  v_eta := greatest(0, round((v_position - 1) * v_avg)::integer);

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
    v_position,
    v_eta
  )
  returning id into v_entry_id;

  insert into notifications (queue_entry_id, message, kind)
  values (
    v_entry_id,
    'Joined queue at ' || v_centre_name || '. Token ' || v_token || '. Position #' || v_position || '.',
    'success'
  );

  -- Snapshot for historical queue_records chart
  insert into queue_records (
    procurement_centre_id,
    recorded_at,
    queue_size,
    processing_capacity,
    actual_wait_minutes
  )
  values (
    p_centre_id,
    now(),
    v_position,
    null,
    v_eta
  );

  return jsonb_build_object(
    'entry_id', v_entry_id,
    'token', v_token,
    'position', v_position,
    'estimated_wait_minutes', v_eta,
    'status', 'WAITING',
    'centre_name', v_centre_name
  );
end;
$$;

-- Admin actions on a queue entry
create or replace function admin_queue_action(
  p_entry_id uuid,
  p_action text
)
returns jsonb
language plpgsql
as $$
declare
  v_entry queue_entries%rowtype;
  v_centre_id uuid;
  v_new_status text;
  v_msg text;
  v_started timestamptz;
  v_duration integer;
begin
  select * into v_entry from queue_entries where id = p_entry_id for update;
  if not found then
    raise exception 'queue entry not found';
  end if;

  v_centre_id := v_entry.procurement_centre_id;

  case upper(p_action)
    when 'ACCEPT' then
      if v_entry.status not in ('WAITING', 'HOLD') then
        raise exception 'cannot ACCEPT from status %', v_entry.status;
      end if;
      v_new_status := 'ACCEPTED';
      update queue_entries
      set status = v_new_status, accepted_at = coalesce(accepted_at, now()), updated_at = now()
      where id = p_entry_id;
      v_msg := 'Your token was accepted. Please proceed when called.';

    when 'HOLD' then
      if v_entry.status not in ('WAITING', 'ACCEPTED') then
        raise exception 'cannot HOLD from status %', v_entry.status;
      end if;
      v_new_status := 'HOLD';
      update queue_entries set status = v_new_status, updated_at = now() where id = p_entry_id;
      v_msg := 'Your token is on hold. Please wait for further instructions.';

    when 'RESUME' then
      if v_entry.status <> 'HOLD' then
        raise exception 'cannot RESUME from status %', v_entry.status;
      end if;
      v_new_status := 'WAITING';
      update queue_entries set status = v_new_status, updated_at = now() where id = p_entry_id;
      v_msg := 'Your token is active again in the queue.';

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
      v_msg := 'Processing started for your token.';

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
      v_msg := 'Completed. Thank you for selling at this centre.';

    when 'DEQUEUE', 'CANCEL' then
      v_new_status := 'CANCELLED';
      update queue_entries
      set status = v_new_status, completed_at = now(), updated_at = now()
      where id = p_entry_id;
      v_msg := 'Your token was removed from the queue.';

    when 'PUSH' then
      -- Move this entry one position later among WAITING entries
      if v_entry.status <> 'WAITING' then
        raise exception 'cannot PUSH from status %', v_entry.status;
      end if;
      update queue_entries
      set position = position + 1, updated_at = now()
      where id = p_entry_id;
      v_new_status := v_entry.status;
      v_msg := 'Your position in the queue was updated.';

    else
      raise exception 'unknown action: %', p_action;
  end case;

  perform recalculate_centre_queue(v_centre_id);

  insert into notifications (queue_entry_id, message, kind)
  values (
    p_entry_id,
    v_msg,
    case
      when v_new_status in ('DONE', 'ACCEPTED') then 'success'
      when v_new_status in ('HOLD', 'CANCELLED') then 'warning'
      else 'info'
    end
  );

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
