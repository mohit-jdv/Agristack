-- ============================================================================
-- KisanSetu — Row Level Security
-- V1 posture: reference/market data is public-readable (it's the whole point
-- of the product — farmers need to see prices without logging in). Nothing
-- is publicly writable. There is no farmer-identifying data in this schema
-- yet, so there's nothing sensitive to lock down further at this milestone —
-- that comes with farmers/auth in a later milestone.
-- ============================================================================

alter table states enable row level security;
alter table districts enable row level security;
alter table commodities enable row level security;
alter table markets enable row level security;
alter table market_prices enable row level security;
alter table procurement_centres enable row level security;
alter table procurement_prices enable row level security;
alter table queue_records enable row level security;

-- Public, anonymous read access on reference + pricing data.
create policy "Public read access" on states for select using (true);
create policy "Public read access" on districts for select using (true);
create policy "Public read access" on commodities for select using (true);
create policy "Public read access" on markets for select using (true);
create policy "Public read access" on market_prices for select using (true);
create policy "Public read access" on procurement_centres for select using (true);
create policy "Public read access" on procurement_prices for select using (true);

-- queue_records is operational/training data, not something a farmer needs to
-- browse directly in V1 — no public read policy is created for it, so with
-- RLS enabled and no policy it is deny-by-default for the anon/public role.
-- It is written and read only via the service-role key from trusted
-- server-side code (e.g. the future waiting-time ingestion job).

-- No insert/update/delete policies exist for the anon or authenticated roles
-- on any table in this milestone: with RLS enabled and no matching policy,
-- writes are denied by default. All writes in V1 go through the Supabase
-- service-role key from server-only code (migrations, seed scripts, future
-- admin/ingestion jobs) — never from the browser.
