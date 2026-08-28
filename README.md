# AgriStack — SIH Demo

**Sell smarter. Earn better.**

This is the first working prototype milestone: Landing Page → Farmer Dashboard →
Crop Details Form → Mock Market Comparison → Recommendation Engine.
No Supabase, no Gemini, no ML model, no real APIs yet — all market data is
clearly labeled sample data, per project spec.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript (strict)
- Tailwind CSS
- Zero backend calls in this milestone — everything runs client/server-rendered
  off in-repo demo data

## Folder structure

```
src/
  app/
    layout.tsx          Root layout, fonts, global styles
    page.tsx             Landing page
    globals.css
    dashboard/
      page.tsx           Farmer dashboard + crop entry form
    compare/
      page.tsx           Market comparison + recommendation (reads ?crop=&quantity=&location=)
  components/
    Navbar.tsx
    Hero.tsx
    CropForm.tsx          Client component — validates input, routes to /compare
    ComparisonTable.tsx   Ranked table of every selling option
    RecommendationCard.tsx  Top recommendation + plain-language "why"
    DemoDataBadge.tsx     Reusable "Demo Data" label — DATA HONESTY requirement
  lib/
    types.ts               Shared domain types (SellingOption, ScoredOption, ...)
    demo-data.ts            DEMO market/procurement data — clearly labeled, isDemoData: true
    calculations.ts          Pure, deterministic financial math (gross revenue, net return)
    recommendation-engine.ts  Pure, deterministic, rule-based scoring — NO LLM involved
```

## How the recommendation engine works

1. **Financials** (`calculations.ts`): for every selling option,
   `grossRevenue = price × quantity`, then `netReturn = grossRevenue − transportCost`.
   Verified against the spec's worked example: ₹4,400 × 50 = ₹2,20,000 gross,
   minus ₹6,500 transport = ₹2,13,500 net.

2. **Scoring** (`recommendation-engine.ts`): each option gets a 0–100 score from
   three weighted, normalized factors (weights are constants at the top of the
   file, easy to retune):
   - **Net return (70%)** — normalized against the min/max net return *among the
     options being compared*, so the scale always adapts to the current comparison set.
   - **Waiting time (20%)** — same normalization, inverted (shorter wait scores higher).
   - **Availability (10%)** — High/Medium/Low mapped to a fixed 1 / 0.6 / 0.2.

   Options are ranked by final score; rank 1 is the recommendation. Every score
   comes with a `scoreFactors` breakdown so the UI can explain *why*, in plain
   language, without ever asking an LLM to invent or recompute a number.

3. **No LLM anywhere in this milestone.** The AI Assistant (Gemini + agent tools)
   is Milestone 4 — it will *call* `generateRecommendation()` as a tool and
   narrate the result, never replace it.

## Running locally (SIH demo mode)

**Default is DEMO MODE** — no Supabase credentials required. Farmer and admin
share one in-memory queue in the Next.js server process.

```bash
npm install
# AGRISTACK_DATA_MODE defaults to demo
npm run dev
# http://localhost:8080
```

Walkthrough:

1. Dashboard → crop, quantity, location → compare (existing recommendation engine).
2. Join queue on a **Govt. Procurement** option (APMC has no live queue).
3. Farmer token page: position, people ahead, ETA, notifications.
4. Admin → Nashik centre: same tokens. Accept / Up / Down / Hold / Process / Done.
5. Farmer page polls every 1.5s and updates without a manual refresh.

What is mock vs production:

| Surface | Demo mode | Supabase mode |
|---|---|---|
| Market prices / recommendation inputs | `src/lib/demo-data.ts` | `src/lib/data/markets.ts` → Postgres |
| Recommendation scoring | Unchanged (`recommendation-engine.ts`) | Unchanged |
| Queue, tokens, ETA, notifications | `src/lib/demo/queue-engine.ts` (in-memory) | RPCs in `supabase/migrations/0003` + `0005` |
| Farmer live updates | HTTP poll `/api/demo/queue/[token]` | Supabase Realtime |
| Admin live updates | `router.refresh` every 2s | Realtime + revalidate |

Switch to production backend (migrations still in `supabase/`):

```bash
AGRISTACK_DATA_MODE=supabase \
NEXT_PUBLIC_AGRISTACK_DATA_MODE=supabase \
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run dev
```

Do not delete the Supabase migrations — they remain the intended production path.

```bash
npm run typecheck
npm run demo:simulate   # A001–A004 queue scenario, no server required
```


## Milestone 2 — Supabase + India-ready data architecture

Adds an India-wide Postgres schema and a Supabase data-access layer **in front
of**, not instead of, the Milestone 1 demo data. Nothing in the V1 UI,
recommendation engine, or farmer journey changed.

```
supabase/
  migrations/
    0001_init_schema.sql       states, districts, commodities, markets,
                                market_prices, procurement_centres,
                                procurement_prices, queue_records
    0002_row_level_security.sql  public read-only RLS on all reference/price
                                  tables; no anon writes anywhere
  seed/
    0001_demo_seed.sql          multi-state demo rows (MH, GJ, RJ, PB, MP, KA)
                                 + the exact Milestone 1 Nashik/onion scenario

src/lib/supabase/
  client.ts    browser client — anon key only
  server.ts    server-only clients — anon key for reads, service-role key
               (never bundled to the browser) reserved for future admin/
               ingestion jobs
  types.ts     hand-written Database types matching the SQL schema

src/lib/data/
  markets.ts   getMarkets(), getMarketPrices(), getProcurementCentres(),
               getProcurementPrices(), and getSellingOptions() — the one
               function the UI calls. Falls back to the original
               DEMO_SELLING_OPTIONS whenever Supabase is unconfigured,
               errors, or has no rows for the requested crop.
```

**Why the schema doesn't have distance/transport/waiting columns yet:** those
depend on the farmer's live location and will come from a real distance/maps
API (a later milestone). Until then, `getSellingOptions()` merges DB-sourced
prices with the logistics numbers already in `demo-data.ts` — one source of
truth, not duplicated.

**Fallback guarantee:** this sandbox has no live Supabase project or network
access, so `NEXT_PUBLIC_SUPABASE_URL`/keys are unset here — meaning every read
in this environment exercises the fallback path. I verified it end-to-end:
with no env vars set, `getSellingOptions("Onion")` returns all 5 demo options
and `generateRecommendation()` reproduces the exact Milestone 1 result
(Lasalgaon APMC, ₹2,13,500 net return). The pure logic and the new
Supabase/data-access files were type-checked with `tsc --strict` (Supabase's
own types were stubbed for this, since `npm install` isn't possible here —
verify with real types once you `npm install` locally).

**Security:** `SUPABASE_SERVICE_ROLE_KEY` is read only in `lib/supabase/server.ts`,
which throws if ever evaluated where `window` is defined, and is never
referenced by any Client Component. Only `NEXT_PUBLIC_*` vars reach the browser.
RLS is enabled on every table; only `select` policies exist for the public
role, so writes are denied by default even if a key leaked.

**To actually run this against your real Supabase project:**
```bash
# apply schema + RLS
supabase db push   # or paste the two migration files into the SQL editor
# seed multi-state demo data
psql "$DATABASE_URL" -f supabase/seed/0001_demo_seed.sql
# add credentials
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY
npm install
npm run dev
```

### Milestone 2 report

1. **Schema created**: `supabase/migrations/0001_init_schema.sql` — 8 tables
2. **Tables**: states, districts, commodities, markets, market_prices, procurement_centres, procurement_prices, queue_records
3. **Relationships**: districts→states, markets→states/districts, market_prices→markets/commodities, procurement_centres→states/districts, procurement_prices→procurement_centres/commodities, queue_records→procurement_centres — all FKs enforced
4. **Indexes**: on every FK column plus `price_date` and `recorded_at`
5. **Supabase client**: `src/lib/supabase/{client,server,types}.ts`
6. **Data-access layer**: `src/lib/data/markets.ts`
7. **Demo records added**: 7 states, 7 districts, 8 commodities, 8 markets, 8 market-price rows, 1 procurement centre + price, 5 queue-record rows — via `supabase/seed/0001_demo_seed.sql`
8. **Existing UI preserved**: only line changed in the UI layer is the data source in `compare/page.tsx` (`DEMO_SELLING_OPTIONS` → `await getSellingOptions(crop)`); every component, style, and page is untouched
9. **Tests/build status**: pure logic + new data-access/Supabase files type-check clean (`tsc --strict`, Supabase types stubbed); fallback path run end-to-end and matches Milestone 1 output exactly. Full `next build` not run — no network access in this sandbox to `npm install` Next.js/Supabase — run `npm install && npm run build` locally to confirm
10. **Remaining issues / caveats**: no live Supabase project was actually queried (none is reachable from this sandbox); real DB types should be regenerated with `supabase gen types typescript` once connected, in place of the hand-written ones; latitude/longitude columns exist but aren't populated by the seed (not needed until Maps milestone)

Do not move to Milestone 3 until instructed.
