// ============================================================================
// KisanSetu Data Access Layer
// ============================================================================
//
// This is the ONLY place that communicates with Supabase.
//
// UI components and recommendation logic should only receive SellingOption[].
//
// Supabase data is explicitly cast to our hand-written Database types because
// the current Database type is manually maintained and Supabase can otherwise
// infer some query results as `never`.
//
// ============================================================================

import { getSupabaseServerReadClient } from "@/lib/supabase/server";
import { DEMO_SELLING_OPTIONS } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/config";
import { syncCentresFromOptions } from "@/lib/demo/queue-engine";
import type { SellingOption } from "@/lib/types";
import type { Database } from "@/lib/supabase/types";

// ============================================================================
// Database row types
// ============================================================================

type MarketRow =
  Database["public"]["Tables"]["markets"]["Row"];

type MarketPriceRow =
  Database["public"]["Tables"]["market_prices"]["Row"];

type ProcurementCentreRow =
  Database["public"]["Tables"]["procurement_centres"]["Row"];

type ProcurementPriceRow =
  Database["public"]["Tables"]["procurement_prices"]["Row"];

// ============================================================================
// Explicit types for small lookup queries
// ============================================================================

type CommodityLookup = {
  id: string;
};

type MarketLookup = {
  id: string;
  name: string;
};

type ProcurementCentreLookup = {
  name: string;
};

// ============================================================================
// GET MARKETS
// ============================================================================

export async function getMarkets(filters?: {
  stateName?: string;
  districtName?: string;
}): Promise<MarketRow[]> {
  const supabase = getSupabaseServerReadClient();

  if (!supabase) {
    console.warn("Supabase client not configured.");
    return [];
  }

  let query = supabase
    .from("markets")
    .select(
      "*, states!inner(name), districts!inner(name)"
    );

  if (filters?.stateName) {
    query = query.eq(
      "states.name",
      filters.stateName
    );
  }

  if (filters?.districtName) {
    query = query.eq(
      "districts.name",
      filters.districtName
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "Failed to fetch markets:",
      error
    );
    return [];
  }

  if (!data) {
    return [];
  }

  // IMPORTANT:
  // Supabase can infer this as never[] with the current
  // hand-written Database type.
  const rows = data as unknown as MarketRow[];

  return rows;
}

// ============================================================================
// GET MARKET PRICES
// ============================================================================

export async function getMarketPrices(
  commodityName: string
): Promise<
  Array<MarketPriceRow & { market_name: string }>
> {
  const supabase = getSupabaseServerReadClient();

  if (!supabase) {
    console.error(
      "Supabase client not configured."
    );
    return [];
  }

  // --------------------------------------------------------------------------
  // 1. Find commodity
  // --------------------------------------------------------------------------

  const {
    data: commodityData,
    error: commodityError,
  } = await supabase
    .from("commodities")
    .select("id")
    .eq("name", commodityName)
    .limit(1);

  if (commodityError) {
    console.error(
      "Commodity query error:",
      commodityError
    );
    return [];
  }

  if (!commodityData || commodityData.length === 0) {
    console.error(
      "Commodity not found:",
      commodityName
    );
    return [];
  }

  // Explicitly cast before accessing .id.
  const commodityRow = commodityData?.[0] as unknown as {
  id: string;
} | undefined;

if (!commodityRow?.id) {
  console.error(
    "Commodity ID not found:",
    commodityName
  );
  return [];
}

const commodityId = commodityRow.id;

  console.log(
    "COMMODITY ID:",
    commodityId
  );

  // --------------------------------------------------------------------------
  // 2. Get market prices
  // --------------------------------------------------------------------------

  const {
    data: priceData,
    error: priceError,
  } = await supabase
    .from("market_prices")
    .select("*")
    .eq("commodity_id", commodityId)
    .order("price_date", {
      ascending: false,
    });

  if (priceError) {
    console.error(
      "Market price query failed:",
      priceError
    );
    return [];
  }

  if (!priceData || priceData.length === 0) {
    console.warn(
      "No market prices found for:",
      commodityName
    );
    return [];
  }

  // IMPORTANT:
  // Cast BEFORE map().
  // This prevents `row` from becoming `never`.
  const priceRows =
    priceData as unknown as MarketPriceRow[];

  console.log(
    "ONION MARKET PRICES:",
    {
      error: priceError,
      count: priceRows.length,
      data: priceRows,
    }
  );

  // --------------------------------------------------------------------------
  // 3. Get markets
  // --------------------------------------------------------------------------

  const {
    data: marketData,
    error: marketsError,
  } = await supabase
    .from("markets")
    .select("id, name");

  if (marketsError) {
    console.error(
      "Failed to fetch markets:",
      marketsError
    );
    return [];
  }

  if (!marketData || marketData.length === 0) {
    console.warn(
      "No markets found."
    );
    return [];
  }

  // Explicit cast prevents market.id / market.name errors.
  const markets =
    marketData as unknown as MarketLookup[];

  console.log(
    "MARKETS:",
    {
      error: marketsError,
      count: markets.length,
      data: markets,
    }
  );

  // --------------------------------------------------------------------------
  // 4. Create market ID -> market name map
  // --------------------------------------------------------------------------

  const marketMap = new Map<string, string>();

  for (const market of markets) {
    marketMap.set(
      market.id,
      market.name
    );
  }

  console.log(
    "MARKET MAP:",
    Object.fromEntries(marketMap)
  );

  // --------------------------------------------------------------------------
  // 5. Merge prices with market names
  // --------------------------------------------------------------------------

  const result: Array<
    MarketPriceRow & {
      market_name: string;
    }
  > = [];

  for (const row of priceRows) {
    const marketName =
      marketMap.get(row.market_id);

    if (!marketName) {
      console.warn(
        "No market found for market_id:",
        row.market_id
      );

      continue;
    }

    // No spread inference problem here because row is
    // explicitly MarketPriceRow.
    result.push({
      ...row,
      market_name: marketName,
    });
  }

  return result;
}

// ============================================================================
// GET PROCUREMENT CENTRES
// ============================================================================

export async function getProcurementCentres(
  filters?: {
    stateName?: string;
    districtName?: string;
  }
): Promise<ProcurementCentreRow[]> {
  const supabase =
    getSupabaseServerReadClient();

  if (!supabase) {
    console.warn(
      "Supabase client not configured."
    );
    return [];
  }

  let query = supabase
    .from("procurement_centres")
    .select(
      "*, states!inner(name), districts!inner(name)"
    );

  if (filters?.stateName) {
    query = query.eq(
      "states.name",
      filters.stateName
    );
  }

  if (filters?.districtName) {
    query = query.eq(
      "districts.name",
      filters.districtName
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "Failed to fetch procurement centres:",
      error
    );
    return [];
  }

  if (!data) {
    return [];
  }

  const rows =
    data as unknown as ProcurementCentreRow[];

  return rows;
}

// ============================================================================
// GET PROCUREMENT PRICES
// ============================================================================

export async function getProcurementPrices(
  commodityName: string
): Promise<
  Array<
    ProcurementPriceRow & {
      centre_name: string;
    }
  >
> {
  const supabase =
    getSupabaseServerReadClient();

  if (!supabase) {
    console.error(
      "Supabase client not configured."
    );
    return [];
  }

  // --------------------------------------------------------------------------
  // 1. Find commodity
  // --------------------------------------------------------------------------

  const {
    data: commodityData,
    error: commodityError,
  } = await supabase
    .from("commodities")
    .select("id")
    .eq("name", commodityName)
    .limit(1);

  if (commodityError) {
    console.error(
      "Failed to find commodity:",
      commodityError
    );
    return [];
  }

  if (
    !commodityData ||
    commodityData.length === 0
  ) {
    console.error(
      "Commodity not found:",
      commodityName
    );
    return [];
  }

  // Explicit cast before .id.
  const commodityRows =
    commodityData as unknown as CommodityLookup[];

  const commodityId =
    commodityRows[0]?.id;

  if (!commodityId) {
    console.error(
      "Commodity ID not found:",
      commodityName
    );
    return [];
  }

  console.log(
    "PROCUREMENT COMMODITY ID:",
    commodityId
  );

  // --------------------------------------------------------------------------
  // 2. Get procurement prices
  // --------------------------------------------------------------------------

  const {
    data: procurementData,
    error: procurementError,
  } = await supabase
    .from("procurement_prices")
    .select(
      "*, procurement_centres!inner(name)"
    )
    .eq(
      "commodity_id",
      commodityId
    )
    .order("effective_date", {
      ascending: false,
    });

  if (procurementError) {
    console.error(
      "Failed to fetch procurement prices:",
      procurementError
    );
    return [];
  }

  if (
    !procurementData ||
    procurementData.length === 0
  ) {
    console.warn(
      "No procurement prices found for:",
      commodityName
    );
    return [];
  }

  // --------------------------------------------------------------------------
  // 3. Explicit type for returned joined rows
  // --------------------------------------------------------------------------

  type ProcurementPriceWithCentre =
    ProcurementPriceRow & {
      procurement_centres: ProcurementCentreLookup;
    };

  // IMPORTANT:
  // Cast before .map() so row is NOT `never`.
  const rows =
    procurementData as unknown as ProcurementPriceWithCentre[];

  // --------------------------------------------------------------------------
  // 4. Add centre_name
  // --------------------------------------------------------------------------

  const result: Array<
    ProcurementPriceRow & {
      centre_name: string;
    }
  > = [];

  for (const row of rows) {
    result.push({
      ...row,
      centre_name:
        row.procurement_centres.name,
    });
  }

  return result;
}

// ============================================================================
// LOGISTICS
// ============================================================================
//
// Distance, transport cost, waiting time, etc. are still coming from the
// Milestone 1 demo data.
//
// Later this can be replaced with a Maps/Distance API.
//
// ============================================================================

/**
 * Logistics (distance / transport / wait) still come from demo seeds when a
 * name matches. Unknown markets/centres get conservative defaults so newly
 * added procurement centres are never dropped from recommendations.
 * Core score math is unchanged — only inputs to SellingOption.
 *
 * Returns ONLY logistics fields so an APMC name match cannot leak an APMC
 * id/type onto a government procurement option.
 */
function defaultLogistics(optionType: "APMC" | "GOVERNMENT_PROCUREMENT") {
  return {
    distance: optionType === "GOVERNMENT_PROCUREMENT" ? 55 : 80,
    transportCost: optionType === "GOVERNMENT_PROCUREMENT" ? 7500 : 10000,
    waitingMinutes: optionType === "GOVERNMENT_PROCUREMENT" ? 180 : 150,
    availability: "Medium" as const,
    status: "Open" as const,
    isDemoData: true,
  };
}

function logisticsFor(
  marketName: string,
  optionType: "APMC" | "GOVERNMENT_PROCUREMENT"
) {
  const found = DEMO_SELLING_OPTIONS.find(
    (option) => option.name === marketName && option.type === optionType
  ) ?? DEMO_SELLING_OPTIONS.find(
    (option) => option.name === marketName
  );
  if (found) {
    return {
      distance: found.distance,
      transportCost: found.transportCost,
      waitingMinutes: found.waitingMinutes,
      availability: found.availability,
      status: found.status ?? "Open",
      isDemoData: true,
    };
  }
  return defaultLogistics(optionType);
}

function publishOptions(options: SellingOption[]): SellingOption[] {
  if (isDemoMode()) {
    syncCentresFromOptions(options);
  }
  return options;
}

// ============================================================================
// GET SELLING OPTIONS
// ============================================================================
//
// This is the ONLY function the UI should need.
//
// It combines:
//
//   Market prices
//        +
//   Procurement prices
//        +
//   Logistics
//        ↓
//   SellingOption[]
//
// ============================================================================

export async function getSellingOptions(
  cropName: string
): Promise<SellingOption[]> {
  if (isDemoMode()) {
    const options = DEMO_SELLING_OPTIONS.map((option) => ({
      ...option,
      crop: cropName,
    }));
    return publishOptions(options);
  }

  const [
    marketPrices,
    procurementPrices,
  ] = await Promise.all([
    getMarketPrices(cropName),
    getProcurementPrices(cropName),
  ]);

  console.log(
    "MARKET PRICES:",
    marketPrices
  );

  console.log(
    "PROCUREMENT PRICES:",
    procurementPrices
  );

  const options: SellingOption[] = [];

  // --------------------------------------------------------------------------
  // Market options
  // --------------------------------------------------------------------------

  for (const price of marketPrices) {
    const logistics = logisticsFor(price.market_name, "APMC");

    options.push({
      ...logistics,
      id: price.market_id,
      name: price.market_name,
      type: "APMC",
      price: price.modal_price,
      crop: cropName,
      isDemoData: price.source === "demo",
    });
  }

  // --------------------------------------------------------------------------
  // Procurement options
  // --------------------------------------------------------------------------

  for (const price of procurementPrices) {
    const logistics = logisticsFor(
      price.centre_name,
      "GOVERNMENT_PROCUREMENT"
    );

    options.push({
      ...logistics,
      id: price.procurement_centre_id,
      name: price.centre_name,
      price: price.procurement_price,
      crop: cropName,
      type: "GOVERNMENT_PROCUREMENT",
      isDemoData: price.source === "demo",
    });
  }

  // --------------------------------------------------------------------------
  // Fallback to demo data
  // --------------------------------------------------------------------------

  if (options.length === 0) {
    console.warn(
      "No usable Supabase options found. Using demo data."
    );

    return publishOptions(DEMO_SELLING_OPTIONS.map((option) => ({
      ...option,
      crop: cropName,
    })));
  }

  return publishOptions(options);
}