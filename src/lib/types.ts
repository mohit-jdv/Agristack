// Core domain types shared across the app.
// Keep these in sync with the eventual Supabase schema (farmers, crops, markets,
// procurement_centres, market_prices, procurement_prices, ...).

export type Availability = "High" | "Medium" | "Low";
export type CentreStatus = "Open" | "Busy" | "Closed";
export type OptionType = "APMC" | "GOVERNMENT_PROCUREMENT";

/**
 * A single place a farmer could sell to — an APMC mandi or a government
 * procurement centre — normalized to one shape so the recommendation engine
 * doesn't need to special-case either kind.
 */
export interface SellingOption {
  id: string;
  name: string;
  type: OptionType;
  /** ₹ per quintal */
  price: number;
  /** km from the farmer's entered location */
  distance: number;
  /** ₹ total estimated cost to transport the full quantity there */
  transportCost: number;
  /** Estimated waiting time in minutes at the centre */
  waitingMinutes: number;
  availability: Availability;
  status?: CentreStatus;
  /** true until real market-price / procurement APIs are wired up (Milestone 3+) */
  isDemoData: boolean;
  /**
   * India-wide location context, optional so existing Milestone 1 call sites
   * (and demo data) keep compiling unchanged. Populated once options are
   * sourced from Supabase (lib/data/*.ts) or a real API.
   */
  state?: string;
  district?: string;
  /** Commodity name this price/option is for, e.g. "Onion". */
  crop?: string;
}

export interface CropDetails {
  crop: string;
  /** in quintals */
  quantity: number;
  location: string;
  /** Optional India-wide context — not required so Milestone 1 usage is unaffected. */
  state?: string;
  district?: string;
}

/** Output of the pure calculation functions in calculations.ts */
export interface FinancialSummary {
  grossRevenue: number;
  transportCost: number;
  otherCosts: number;
  netReturn: number;
}

/** One scored + explained selling option, as produced by the recommendation engine */
export interface ScoredOption extends SellingOption {
  financials: FinancialSummary;
  /** 0-100, higher is better. Transparent, rule-based — never LLM-generated. */
  score: number;
  /** Human-readable factor breakdown backing the score, for the explanation UI */
  scoreFactors: ScoreFactor[];
  rank: number;
}

export interface ScoreFactor {
  label: string;
  /** Positive = helped the score, negative = hurt it */
  impact: number;
  detail: string;
}

export interface RecommendationResult {
  cropDetails: CropDetails;
  rankedOptions: ScoredOption[];
  recommended: ScoredOption;
  generatedAt: string;
}

/** Live token / queue entry status */
export type QueueStatus =
  | "WAITING"
  | "ACCEPTED"
  | "HOLD"
  | "PROCESSING"
  | "DONE"
  | "CANCELLED"
  | "NO_SHOW";

/** How a queue entry was created — a farmer online, or an admin entering a walk-in. */
export type QueueEntrySource = "ONLINE" | "OFFLINE_ADMIN";

export type AdminQueueAction =
  | "ACCEPT"
  | "HOLD"
  | "RESUME"
  | "PROCESS"
  | "DONE"
  | "DEQUEUE"
  | "CANCEL"
  | "MOVE_UP"
  | "MOVE_DOWN";

export interface QueueEntry {
  id: string;
  token: string;
  procurementCentreId: string;
  centreName?: string;
  farmerId: string;
  farmerName?: string;
  farmerPhone?: string | null;
  commodityName: string;
  quantityQuintals: number;
  status: QueueStatus;
  position: number;
  estimatedWaitMinutes: number | null;
  joinedAt: string;
  acceptedAt: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  /** Defaults to "ONLINE" for existing/legacy entries that predate this field. */
  source?: QueueEntrySource;
}

export interface QueueNotification {
  id: string;
  queueEntryId: string;
  message: string;
  kind: "info" | "success" | "warning" | "action";
  eventKey?: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface JoinQueueResult {
  entryId: string;
  token: string;
  position: number;
  estimatedWaitMinutes: number;
  status: QueueStatus;
  centreName: string;
}

export interface CentreDashboardStats {
  centreId: string;
  centreName: string;
  status: CentreStatus;
  waitingCount: number;
  processingCount: number;
  doneToday: number;
  avgProcessingMinutes: number;
  activeEntries: QueueEntry[];
  /** Number of completed processing records the average/prediction is based on. */
  historyCount: number;
  /** people currently ahead (waiting + processing) × avgProcessingMinutes */
  predictedWaitMinutes: number;
}

export interface ProcessingRecordPoint {
  completedAt: string;
  durationMinutes: number;
  queueSizeSnapshot?: number | null;
}
