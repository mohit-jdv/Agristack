// ============================================================================
// Queue / token data access layer
// Mirrors markets.ts conventions: explicit casts for hand-written Database types.
// ============================================================================

import {
  getSupabaseServerReadClient,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
import * as demoQueue from "@/lib/demo/queue-engine";
import type { Database } from "@/lib/supabase/types";
import type {
  AdminQueueAction,
  CentreDashboardStats,
  JoinQueueResult,
  ProcessingRecordPoint,
  QueueEntry,
  QueueEntrySource,
  QueueNotification,
  QueueStatus,
} from "@/lib/types";

type QueueEntryRow = Database["public"]["Tables"]["queue_entries"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type ProcessingRow = Database["public"]["Tables"]["processing_records"]["Row"];
type CentreRow = Database["public"]["Tables"]["procurement_centres"]["Row"];
type FarmerRow = Database["public"]["Tables"]["farmers"]["Row"];

type JoinQueueRpcResult = {
  entry_id: string;
  token: string;
  position: number;
  estimated_wait_minutes: number;
  status: string;
  centre_name: string;
};

type AdminActionRpcResult = {
  entry_id: string;
  token: string;
  status: string;
  position: number;
  estimated_wait_minutes: number | null;
};

function mapEntry(
  row: QueueEntryRow,
  extras?: {
    centreName?: string;
    farmerName?: string;
    farmerPhone?: string | null;
  }
): QueueEntry {
  return {
    id: row.id,
    token: row.token,
    procurementCentreId: row.procurement_centre_id,
    centreName: extras?.centreName,
    farmerId: row.farmer_id,
    farmerName: extras?.farmerName,
    farmerPhone: extras?.farmerPhone ?? null,
    commodityName: row.commodity_name,
    quantityQuintals: Number(row.quantity_quintals),
    status: row.status as QueueStatus,
    position: row.position,
    estimatedWaitMinutes: row.estimated_wait_minutes,
    joinedAt: row.joined_at,
    acceptedAt: row.accepted_at,
    processingStartedAt: row.processing_started_at,
    completedAt: row.completed_at,
    notes: row.notes,
  };
}

export async function joinQueue(params: {
  centreId: string;
  centreName?: string;
  displayName: string;
  phone?: string;
  location?: string;
  commodityName: string;
  quantity: number;
  notes?: string;
  /** "ONLINE" (default) for a farmer joining directly, "OFFLINE_ADMIN" for an admin-entered walk-in. */
  source?: QueueEntrySource;
}): Promise<{ data: JoinQueueResult | null; error: string | null }> {
  if (isDemoMode()) {
    return demoQueue.joinQueue(params);
  }

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) {
    return {
      data: null,
      error:
        "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY for queue joins.",
    };
  }

  const { data, error } = await supabase.rpc("join_centre_queue", {
    p_centre_id: params.centreId,
    p_display_name: params.displayName,
    p_phone: params.phone ?? "",
    p_location: params.location ?? "",
    p_commodity_name: params.commodityName,
    p_quantity: params.quantity,
    p_notes: params.notes ?? "",
    p_source: params.source ?? "ONLINE",
  } as never);

  if (error) {
    console.error("join_centre_queue failed:", error);
    return { data: null, error: error.message };
  }

  // Hand-written Database types can cause rpc results to infer poorly.
  const raw = data as unknown as JoinQueueRpcResult;
  if (!raw || !raw.token) {
    return { data: null, error: "Unexpected response from join_centre_queue." };
  }

  return {
    data: {
      entryId: raw.entry_id,
      token: raw.token,
      position: raw.position,
      estimatedWaitMinutes: raw.estimated_wait_minutes,
      status: raw.status as QueueStatus,
      centreName: raw.centre_name,
    },
    error: null,
  };
}

export async function getQueueEntryByToken(
  token: string
): Promise<QueueEntry | null> {
  if (isDemoMode()) {
    return demoQueue.getQueueEntryByToken(token);
  }

  const supabase = getSupabaseServerReadClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("queue_entries")
    .select("*")
    .eq("token", token)
    .limit(1);

  if (error || !data || data.length === 0) {
    if (error) console.error("getQueueEntryByToken:", error);
    return null;
  }

  const row = (data as unknown as QueueEntryRow[])[0]!;

  let centreName: string | undefined;
  let farmerName: string | undefined;
  let farmerPhone: string | null | undefined;

  const { data: centreData } = await supabase
    .from("procurement_centres")
    .select("name")
    .eq("id", row.procurement_centre_id)
    .limit(1);
  if (centreData && centreData.length > 0) {
    centreName = (centreData as unknown as { name: string }[])[0]!.name;
  }

  const { data: farmerData } = await supabase
    .from("farmers")
    .select("display_name, phone")
    .eq("id", row.farmer_id)
    .limit(1);
  if (farmerData && farmerData.length > 0) {
    const f = (
      farmerData as unknown as Pick<FarmerRow, "display_name" | "phone">[]
    )[0]!;
    farmerName = f.display_name;
    farmerPhone = f.phone;
  }

  return mapEntry(row, { centreName, farmerName, farmerPhone });
}

export async function getNotificationsForEntry(
  entryId: string
): Promise<QueueNotification[]> {
  if (isDemoMode()) {
    return demoQueue.getNotificationsForEntry(entryId);
  }

  const supabase = getSupabaseServerReadClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("queue_entry_id", entryId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    if (error) console.error("getNotificationsForEntry:", error);
    return [];
  }

  const rows = data as unknown as NotificationRow[];
  return rows.map((n) => ({
    id: n.id,
    queueEntryId: n.queue_entry_id,
    message: n.message,
    kind: n.kind,
    eventKey: (n as NotificationRow & { event_key?: string | null }).event_key ?? null,
    createdAt: n.created_at,
    readAt: n.read_at,
  }));
}

export async function adminQueueAction(
  entryId: string,
  action: AdminQueueAction
): Promise<{ data: AdminActionRpcResult | null; error: string | null }> {
  if (isDemoMode()) {
    return demoQueue.adminQueueAction(entryId, action);
  }

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) {
    return {
      data: null,
      error:
        "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY for admin actions.",
    };
  }

  const { data, error } = await supabase.rpc("admin_queue_action", {
    p_entry_id: entryId,
    p_action: action,
  } as never);

  if (error) {
    console.error("admin_queue_action failed:", error);
    return { data: null, error: error.message };
  }

  return { data: data as unknown as AdminActionRpcResult, error: null };
}

export async function listProcurementCentresForAdmin(): Promise<
  Array<{ id: string; name: string; status: string; district?: string }>
> {
  if (isDemoMode()) {
    return demoQueue.listProcurementCentresForAdmin();
  }

  const supabase = getSupabaseServerReadClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("procurement_centres")
    .select("id, name, status, districts(name)")
    .order("name");

  if (error || !data) {
    if (error) console.error("listProcurementCentresForAdmin:", error);
    return [];
  }

  type Row = {
    id: string;
    name: string;
    status: string;
    districts: { name: string } | null;
  };

  const rows = data as unknown as Row[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    district: r.districts?.name,
  }));
}

export async function getCentreDashboard(
  centreId: string
): Promise<CentreDashboardStats | null> {
  if (isDemoMode()) {
    return demoQueue.getCentreDashboard(centreId);
  }

  const supabase = getSupabaseServerReadClient();
  if (!supabase) return null;

  const { data: centreData, error: centreError } = await supabase
    .from("procurement_centres")
    .select("*")
    .eq("id", centreId)
    .limit(1);

  if (centreError || !centreData || centreData.length === 0) {
    if (centreError) console.error("getCentreDashboard centre:", centreError);
    return null;
  }

  const centre = (centreData as unknown as CentreRow[])[0]!;

  const { data: entriesData, error: entriesError } = await supabase
    .from("queue_entries")
    .select("*")
    .eq("procurement_centre_id", centreId)
    .in("status", ["WAITING", "ACCEPTED", "HOLD", "PROCESSING"])
    .order("position", { ascending: true });

  if (entriesError) {
    console.error("getCentreDashboard entries:", entriesError);
  }

  const entryRows = (entriesData ?? []) as unknown as QueueEntryRow[];

  const farmerIds = [...new Set(entryRows.map((e) => e.farmer_id))];
  const farmerMap = new Map<string, { name: string; phone: string | null }>();
  if (farmerIds.length > 0) {
    const { data: farmersData } = await supabase
      .from("farmers")
      .select("id, display_name, phone")
      .in("id", farmerIds);
    const farmers = (farmersData ?? []) as unknown as FarmerRow[];
    for (const f of farmers) {
      farmerMap.set(f.id, { name: f.display_name, phone: f.phone });
    }
  }

  const activeEntries = entryRows.map((row) =>
    mapEntry(row, {
      centreName: centre.name,
      farmerName: farmerMap.get(row.farmer_id)?.name,
      farmerPhone: farmerMap.get(row.farmer_id)?.phone ?? null,
    })
  );

  const waitingCount = activeEntries.filter(
    (e) => e.status === "WAITING" || e.status === "HOLD"
  ).length;
  const processingCount = activeEntries.filter(
    (e) => e.status === "PROCESSING" || e.status === "ACCEPTED"
  ).length;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: doneData } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("procurement_centre_id", centreId)
    .eq("status", "DONE")
    .gte("completed_at", startOfDay.toISOString());

  const doneToday =
    (doneData as unknown as { id: string }[] | null)?.length ?? 0;

  const { data: avgData } = await supabase.rpc("average_processing_minutes", {
    p_centre_id: centreId,
  } as never);
  const avgProcessingMinutes = Number(avgData ?? 15);

  const { count: historyCountRaw } = await supabase
    .from("processing_records")
    .select("id", { count: "exact", head: true })
    .eq("procurement_centre_id", centreId);
  const historyCount = historyCountRaw ?? 0;

  return {
    centreId: centre.id,
    centreName: centre.name,
    status: centre.status,
    waitingCount,
    processingCount,
    doneToday,
    avgProcessingMinutes,
    activeEntries,
    historyCount,
    predictedWaitMinutes: Math.max(
      0,
      Math.round(activeEntries.length * avgProcessingMinutes)
    ),
  };
}

export async function getProcessingHistory(
  centreId: string,
  limit = 30
): Promise<ProcessingRecordPoint[]> {
  if (isDemoMode()) {
    return demoQueue.getProcessingHistory(centreId, limit);
  }

  const supabase = getSupabaseServerReadClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("processing_records")
    .select("completed_at, duration_minutes")
    .eq("procurement_centre_id", centreId)
    .order("completed_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("getProcessingHistory:", error);
    return [];
  }

  const rows = data as unknown as Pick<
    ProcessingRow,
    "completed_at" | "duration_minutes"
  >[];
  return rows.map((r) => ({
    completedAt: r.completed_at,
    durationMinutes: r.duration_minutes,
  }));
}

/** Resolve a selling-option id to a live procurement-centre id. */
export async function resolveProcurementCentreId(
  optionId: string,
  optionName?: string
): Promise<string | null> {
  if (isDemoMode()) {
    return demoQueue.resolveCentreId(optionId, optionName);
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(optionId)) {
    return optionId;
  }

  const supabase = getSupabaseServerReadClient();
  if (!supabase) return null;

  const name = optionName?.trim() || optionId;

  const { data, error } = await supabase
    .from("procurement_centres")
    .select("id, name")
    .limit(50);

  if (error || !data || data.length === 0) {
    if (error) console.error("resolveProcurementCentreId:", error);
    return null;
  }

  const rows = data as unknown as { id: string; name: string }[];
  const exact = rows.find((r) => r.id === optionId || r.name === name);
  if (exact) return exact.id;

  const needle = name.toLowerCase();
  const fuzzy = rows.find(
    (r) =>
      r.name.toLowerCase() === needle ||
      r.name.toLowerCase().includes(needle) ||
      needle.includes(r.name.toLowerCase())
  );
  return fuzzy?.id ?? null;
}
