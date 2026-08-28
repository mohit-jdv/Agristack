-- ============================================================================
-- KisanSetu — Milestone 2 seed data
-- ----------------------------------------------------------------------------
-- Small MULTI-STATE demo dataset that proves the schema is India-wide — this
-- is NOT complete national coverage, just enough real place names in enough
-- states to show the architecture isn't Maharashtra-only. The full original
-- Nashik/Ramesh Patil/onion scenario from Milestone 1 is preserved exactly,
-- price-for-price, so the existing farmer journey keeps working unchanged.
-- Safe to re-run: every insert is idempotent via ON CONFLICT.
-- ============================================================================

-- ---- states ---------------------------------------------------------------
insert into states (name, code) values
  ('Maharashtra', 'MH'),
  ('Gujarat', 'GJ'),
  ('Rajasthan', 'RJ'),
  ('Punjab', 'PB'),
  ('Madhya Pradesh', 'MP'),
  ('Karnataka', 'KA'),
  ('Uttar Pradesh', 'UP')
on conflict (name) do nothing;

-- ---- districts --------------------------------------------------------------
insert into districts (state_id, name)
select s.id, d.name
from (values
  ('Maharashtra', 'Nashik'),
  ('Maharashtra', 'Jalgaon'),
  ('Maharashtra', 'Pune'),
  ('Gujarat', 'Mehsana'),
  ('Rajasthan', 'Kota'),
  ('Punjab', 'Amritsar'),
  ('Karnataka', 'Dharwad')
) as d(state_name, name)
join states s on s.name = d.state_name
on conflict (state_id, name) do nothing;

-- ---- commodities ------------------------------------------------------------
insert into commodities (name, category, unit) values
  ('Onion', 'Vegetable', 'quintal'),
  ('Tomato', 'Vegetable', 'quintal'),
  ('Potato', 'Vegetable', 'quintal'),
  ('Wheat', 'Grain', 'quintal'),
  ('Rice', 'Grain', 'quintal'),
  ('Soybean', 'Cash Crop', 'quintal'),
  ('Cotton', 'Cash Crop', 'quintal'),
  ('Maize', 'Grain', 'quintal')
on conflict (name) do nothing;

-- ---- markets ------------------------------------------------------------
-- Primary demo scenario (Nashik-area, matches Milestone 1 exactly) plus a
-- handful of other-state markets to demonstrate India-wide reach.
insert into markets (name, state_id, district_id, market_type, status)
select m.name, s.id, di.id, m.market_type, m.status
from (values
  ('Lasalgaon APMC', 'Maharashtra', 'Nashik', 'APMC', 'Open'),
  ('Manmad APMC', 'Maharashtra', 'Nashik', 'APMC', 'Open'),
  ('Pune APMC', 'Maharashtra', 'Pune', 'APMC', 'Open'),
  ('Jalgaon APMC', 'Maharashtra', 'Jalgaon', 'APMC', 'Open'),
  ('Unjha Market', 'Gujarat', 'Mehsana', 'APMC', 'Open'),
  ('Kota Market', 'Rajasthan', 'Kota', 'APMC', 'Open'),
  ('Amritsar Market', 'Punjab', 'Amritsar', 'APMC', 'Open'),
  ('Hubballi Market', 'Karnataka', 'Dharwad', 'APMC', 'Open')
) as m(name, state_name, district_name, market_type, status)
join states s on s.name = m.state_name
join districts di on di.state_id = s.id and di.name = m.district_name
on conflict do nothing;

-- ---- market_prices --------------------------------------------------------
-- Onion prices for the primary Nashik-area comparison set — figures match
-- the Milestone 1 demo scenario exactly (modal_price = the price the
-- frontend showed as "price").
insert into market_prices (market_id, commodity_id, price_min, price_max, modal_price, arrival_quantity, price_date, source)
select mk.id, c.id, p.price_min, p.price_max, p.modal_price, p.arrival_quantity, p.price_date::date, 'demo'
from (values
  ('Lasalgaon APMC', 'Onion', 4100, 4600, 4400, 1200, current_date),
  ('Manmad APMC', 'Onion', 3500, 4000, 3800, 800, current_date),
  ('Pune APMC', 'Onion', 2500, 3000, 2750, 600, current_date),
  ('Jalgaon APMC', 'Onion', 2300, 2700, 2500, 500, current_date),
  -- a couple of other-state records to prove multi-state price data works
  ('Unjha Market', 'Onion', 3900, 4300, 4100, 700, current_date),
  ('Kota Market', 'Wheat', 2150, 2350, 2250, 900, current_date),
  ('Amritsar Market', 'Wheat', 2200, 2400, 2300, 1100, current_date),
  ('Hubballi Market', 'Maize', 1900, 2100, 2000, 400, current_date)
) as p(market_name, commodity_name, price_min, price_max, modal_price, arrival_quantity, price_date)
join markets mk on mk.name = p.market_name
join commodities c on c.name = p.commodity_name
on conflict do nothing;

-- ---- procurement_centres ----------------------------------------------------
insert into procurement_centres (name, state_id, district_id, status, daily_capacity)
select pc.name, s.id, di.id, pc.status, pc.daily_capacity
from (values
  ('Government Procurement Centre', 'Maharashtra', 'Nashik', 'Busy', 400)
) as pc(name, state_name, district_name, status, daily_capacity)
join states s on s.name = pc.state_name
join districts di on di.state_id = s.id and di.name = pc.district_name
on conflict do nothing;

-- ---- procurement_prices ------------------------------------------------------
insert into procurement_prices (procurement_centre_id, commodity_id, procurement_price, effective_date, source)
select pcn.id, c.id, 2125, current_date, 'demo'
from procurement_centres pcn
join commodities c on c.name = 'Onion'
where pcn.name = 'Government Procurement Centre'
on conflict do nothing;

-- ---- queue_records ----------------------------------------------------------
-- A few sample readings so the table isn't empty — this is what the future
-- waiting-time model will eventually train on at real scale.
insert into queue_records (procurement_centre_id, recorded_at, queue_size, arrivals_per_hour, processing_capacity, actual_wait_minutes)
select pcn.id, now() - (n || ' hours')::interval, 8 + n, 12.5, 20, 150 + (n * 5)
from procurement_centres pcn
cross join generate_series(0, 4) as n
where pcn.name = 'Government Procurement Centre';

-- ---- queue system seed (0003 tables) ----------------------------------------
-- Second centre so admin list is not a single row
insert into procurement_centres (name, state_id, district_id, status, daily_capacity)
select v.name, s.id, d.id, v.status, v.cap
from (values
  ('Pune Government Procurement Centre', 'Maharashtra', 'Pune', 'Open', 300)
) as v(name, state_name, district_name, status, cap)
join states s on s.name = v.state_name
join districts d on d.state_id = s.id and d.name = v.district_name
on conflict do nothing;

-- Historical processing records for ETA averages / charts
insert into processing_records (
  procurement_centre_id, commodity_name, quantity_quintals,
  started_at, completed_at, duration_minutes
)
select
  pcn.id,
  'Onion',
  10 + (n % 5) * 5,
  now() - ((n + 1) || ' hours')::interval - (15 + n) * interval '1 minute',
  now() - ((n + 1) || ' hours')::interval,
  12 + (n % 8)
from procurement_centres pcn
cross join generate_series(0, 14) as n
where pcn.name = 'Government Procurement Centre';
