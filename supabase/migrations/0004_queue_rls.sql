-- ============================================================================
-- RLS for queue / token tables
-- Prototype: public read on live queue status; writes via SECURITY DEFINER RPCs
-- or service-role server actions only.
-- ============================================================================

alter table farmers enable row level security;
alter table token_counters enable row level security;
alter table queue_entries enable row level security;
alter table notifications enable row level security;
alter table processing_records enable row level security;

-- Farmers: no direct public access (created via join_centre_queue)
drop policy if exists farmers_no_anon on farmers;
create policy farmers_no_anon on farmers
  for all using (false) with check (false);

-- Token counters: internal only
drop policy if exists token_counters_no_anon on token_counters;
create policy token_counters_no_anon on token_counters
  for all using (false) with check (false);

-- Queue entries: anyone can read (farmer token status page / admin live view)
drop policy if exists queue_entries_public_read on queue_entries;
create policy queue_entries_public_read on queue_entries
  for select using (true);

drop policy if exists queue_entries_no_direct_write on queue_entries;
create policy queue_entries_no_direct_write on queue_entries
  for insert with check (false);

drop policy if exists queue_entries_no_direct_update on queue_entries;
create policy queue_entries_no_direct_update on queue_entries
  for update using (false);

drop policy if exists queue_entries_no_direct_delete on queue_entries;
create policy queue_entries_no_direct_delete on queue_entries
  for delete using (false);

-- Notifications: public read (scoped by knowing the entry id / token)
drop policy if exists notifications_public_read on notifications;
create policy notifications_public_read on notifications
  for select using (true);

drop policy if exists notifications_no_direct_write on notifications;
create policy notifications_no_direct_write on notifications
  for insert with check (false);

drop policy if exists notifications_no_direct_update on notifications;
create policy notifications_no_direct_update on notifications
  for update using (false);

drop policy if exists notifications_no_direct_delete on notifications;
create policy notifications_no_direct_delete on notifications
  for delete using (false);

-- Processing records: public read for admin analytics
drop policy if exists processing_records_public_read on processing_records;
create policy processing_records_public_read on processing_records
  for select using (true);

drop policy if exists processing_records_no_direct_write on processing_records;
create policy processing_records_no_direct_write on processing_records
  for insert with check (false);

drop policy if exists processing_records_no_direct_update on processing_records;
create policy processing_records_no_direct_update on processing_records
  for update using (false);

drop policy if exists processing_records_no_direct_delete on processing_records;
create policy processing_records_no_direct_delete on processing_records
  for delete using (false);

-- RPCs run as invoker by default; elevate so anon/authenticated can call join + admin
-- (prototype — tighten with real auth later)
revoke all on function next_token(uuid) from public;
revoke all on function average_processing_minutes(uuid) from public;
revoke all on function recalculate_centre_queue(uuid) from public;

revoke all on function join_centre_queue(uuid, text, text, text, text, numeric) from public;
grant execute on function join_centre_queue(uuid, text, text, text, text, numeric) to anon, authenticated, service_role;

revoke all on function admin_queue_action(uuid, text) from public;
grant execute on function admin_queue_action(uuid, text) to anon, authenticated, service_role;

-- Ensure functions own elevated rights for internal writes
alter function join_centre_queue(uuid, text, text, text, text, numeric) security definer;
alter function admin_queue_action(uuid, text) security definer;
alter function recalculate_centre_queue(uuid) security definer;
alter function next_token(uuid) security definer;
