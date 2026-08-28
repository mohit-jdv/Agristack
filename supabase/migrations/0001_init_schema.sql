-- ============================================================================
-- KisanSetu — Milestone 2 schema
-- India-wide agricultural market intelligence data model.
-- Maharashtra/Nashik is only ever seed data — nothing in this schema is
-- state-specific.
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- states
-- ----------------------------------------------------------------------------
create table if not exists states (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique, -- e.g. 'MH', 'GJ', 'RJ'
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- districts
-- ----------------------------------------------------------------------------
create table if not exists districts (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (state_id, name)
);

create index if not exists idx_districts_state_id on districts (state_id);

-- ----------------------------------------------------------------------------
-- commodities
-- ----------------------------------------------------------------------------
create table if not exists commodities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- e.g. 'Onion', 'Wheat'
  category text, -- e.g. 'Vegetable', 'Grain', 'Cash Crop'
  unit text not null default 'quintal',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- markets (APMC / eNAM / local markets)
-- ----------------------------------------------------------------------------
create table if not exists markets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_id uuid not null references states (id) on delete restrict,
  district_id uuid not null references districts (id) on delete restrict,
  latitude double precision,
  longitude double precision,
  market_type text not null default 'APMC'
    check (market_type in ('APMC', 'eNAM', 'Local Market')),
  status text not null default 'Open'
    check (status in ('Open', 'Busy', 'Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_markets_state_id on markets (state_id);
create index if not exists idx_markets_district_id on markets (district_id);

-- ----------------------------------------------------------------------------
-- market_prices
-- ----------------------------------------------------------------------------
create table if not exists market_prices (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets (id) on delete cascade,
  commodity_id uuid not null references commodities (id) on delete cascade,
  price_min numeric(10, 2) not null check (price_min >= 0),
  price_max numeric(10, 2) not null check (price_max >= 0),
  modal_price numeric(10, 2) not null check (modal_price >= 0),
  arrival_quantity numeric(10, 2), -- quintals arriving that day, if known
  price_date date not null,
  source text not null default 'demo', -- 'demo' | 'enam' | 'agmarknet' | ...
  created_at timestamptz not null default now()
);

create index if not exists idx_market_prices_market_id on market_prices (market_id);
create index if not exists idx_market_prices_commodity_id on market_prices (commodity_id);
create index if not exists idx_market_prices_price_date on market_prices (price_date);

-- ----------------------------------------------------------------------------
-- procurement_centres
-- ----------------------------------------------------------------------------
create table if not exists procurement_centres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_id uuid not null references states (id) on delete restrict,
  district_id uuid not null references districts (id) on delete restrict,
  latitude double precision,
  longitude double precision,
  status text not null default 'Open'
    check (status in ('Open', 'Busy', 'Closed')),
  daily_capacity numeric(10, 2), -- quintals/day the centre can process
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_procurement_centres_state_id on procurement_centres (state_id);
create index if not exists idx_procurement_centres_district_id on procurement_centres (district_id);

-- ----------------------------------------------------------------------------
-- procurement_prices
-- ----------------------------------------------------------------------------
create table if not exists procurement_prices (
  id uuid primary key default gen_random_uuid(),
  procurement_centre_id uuid not null references procurement_centres (id) on delete cascade,
  commodity_id uuid not null references commodities (id) on delete cascade,
  procurement_price numeric(10, 2) not null check (procurement_price >= 0),
  effective_date date not null,
  source text not null default 'demo',
  created_at timestamptz not null default now()
);

create index if not exists idx_procurement_prices_centre_id
  on procurement_prices (procurement_centre_id);
create index if not exists idx_procurement_prices_commodity_id
  on procurement_prices (commodity_id);

-- ----------------------------------------------------------------------------
-- queue_records
-- Training data for the future waiting-time prediction model (Milestone 5+).
-- ----------------------------------------------------------------------------
create table if not exists queue_records (
  id uuid primary key default gen_random_uuid(),
  procurement_centre_id uuid not null references procurement_centres (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  queue_size integer not null check (queue_size >= 0),
  arrivals_per_hour numeric(10, 2),
  processing_capacity numeric(10, 2),
  actual_wait_minutes integer check (actual_wait_minutes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_queue_records_centre_id
  on queue_records (procurement_centre_id);
create index if not exists idx_queue_records_recorded_at
  on queue_records (recorded_at);

-- ----------------------------------------------------------------------------
-- updated_at helper trigger — used by markets & procurement_centres
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_markets_updated_at on markets;
create trigger trg_markets_updated_at
  before update on markets
  for each row execute function set_updated_at();

drop trigger if exists trg_procurement_centres_updated_at on procurement_centres;
create trigger trg_procurement_centres_updated_at
  before update on procurement_centres
  for each row execute function set_updated_at();
