// ============================================================================
// In-memory queue engine for SIH DEMO MODE.
// Mirrors supabase/migrations/0003 + 0005 business rules:
//   join → advisory-style lock → insert → recalculate all ETAs
//   MOVE_UP / MOVE_DOWN swap + recalculate
//   position 1/2 / processing / done notifications with event_key dedupe
// Farmer and admin views share this singleton (survives Next.js HMR via globalThis).
//
// Centres are generic: any GOVERNMENT_PROCUREMENT or APMC option from the
// recommendation engine can join. Unknown centres are auto-registered under a
// stable ID (never display-name matching as the primary key).
// ============================================================================

import type {
  AdminQueueAction,
  CentreDashboardStats,
  CentreStatus,
  JoinQueueResult,
  ProcessingRecordPoint,
  QueueEntry,
  QueueEntrySource,
  QueueNotification,
  QueueStatus,
  SellingOption,
} from "../types";
import {
  centreMatchKey,
  humanizeCentreName,
  inferDistrict,
  isStableCentreId,
  stableCentreId,
} from "./centre-id";

const ACTIVE: QueueStatus[] = ["WAITING", "ACCEPTED", "HOLD", "PROCESSING"];

export type DemoCentre = {
  id: string;
  name: string;
  district: string;
  status: CentreStatus;
};

/** Seeded centres — original Nashik walkthrough plus every demo procurement location. */
export const DEMO_CENTRES: DemoCentre[] = [
  {
    id: "govt-procurement-lasalgaon",
    name: "Lasalgaon Government Procurement Centre",
    district: "Nashik",
    status: "Open",
  },
  {
    id: "govt-procurement-manmad",
    name: "Manmad Government Procurement Centre",
    district: "Nashik",
    status: "Open",
  },
  {
    id: "govt-procurement-nashik",
    name: "Nashik Government Procurement Centre",
    district: "Nashik",
    status: "Busy",
  },
  {
    id: "govt-procurement-pune",
    name: "Pune Government Procurement Centre",
    district: "Pune",
    status: "Open",
  },
  {
    id: "govt-procurement-nagpur",
    name: "Nagpur Government Procurement Centre",
    district: "Nagpur",
    status: "Open",
  },
  {
    id: "govt-procurement-jalgaon",
    name: "Jalgaon Government Procurement Centre",
    district: "Jalgaon",
    status: "Open",
  },
];

type DemoFarmer = {
  id: string;
  displayName: string;
  phone: string | null;
  location: string | null;
};

type DemoProcessing = {
  id: string;
  centreId: string;
  entryId: string | null;
  commodityName: string;
  quantityQuintals: number;
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
};

type DemoStore = {
  centres: DemoCentre[];
  farmers: DemoFarmer[];
  entries: QueueEntry[];
  notifications: QueueNotification[];
  processing: DemoProcessing[];
  tokenSeq: Record<string, number>;
  seq: number;
};

const g = globalThis as typeof globalThis & { __agristackDemoStore?: DemoStore };
const locks = new Map<string, Promise<void>>();

function nid(prefix: string): string {
  const store = getStore();
  store.seq += 1;
  return `${prefix}-${store.seq.toString(16)}`;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function seedCentres(): DemoCentre[] {
  return DEMO_CENTRES.map((c) => ({ ...c }));
}

function seedStore(): DemoStore {
  const store: DemoStore = {
    centres: seedCentres(),
    farmers: [],
    entries: [],
    notifications: [],
    processing: [],
    tokenSeq: {},
    seq: 0,
  };
  // Bind temporarily so nid() works during seed
  g.__agristackDemoStore = store;

  const nashik =
    store.centres.find((c) => c.id === "govt-procurement-nashik") ?? store.centres[0];
  if (!nashik) return store;
  const lasalgaon = store.centres.find((c) => c.id === "govt-procurement-lasalgaon");
  const now = Date.now();

  const historyCentres = lasalgaon ? [nashik, lasalgaon] : [nashik];
  for (const centre of historyCentres) {
    for (let i = 0; i < 15; i++) {
      const duration = 12 + (i % 8);
      const completed = new Date(now - (i + 1) * 60 * 60 * 1000);
      const started = new Date(completed.getTime() - duration * 60 * 1000);
      store.processing.push({
        id: nid("pr"),
        centreId: centre.id,
        entryId: null,
        commodityName: "Onion",
        quantityQuintals: 10 + (i % 5) * 5,
        startedAt: started.toISOString(),
        completedAt: completed.toISOString(),
        durationMinutes: duration,
      });
    }
  }

  const seedFarmers: Array<{ name: string; phone: string; qty: number }> = [
    { name: "Savita More", phone: "9876500001", qty: 40 },
    { name: "Ramesh Patil", phone: "9876500002", qty: 50 },
  ];

  const queueSeedCentres = lasalgaon ? [nashik, lasalgaon] : [nashik];
  for (const centre of queueSeedCentres) {
    for (const f of seedFarmers) {
      const farmerId = nid("farmer");
      store.farmers.push({
        id: farmerId,
        displayName: f.name,
        phone: f.phone,
        location: "Nashik, Maharashtra",
      });
      const token = nextToken(centre.id);
      const entryId = nid("entry");
      store.entries.push({
        id: entryId,
        token,
        procurementCentreId: centre.id,
        centreName: centre.name,
        farmerId,
        farmerName: f.name,
        farmerPhone: f.phone,
        commodityName: "Onion",
        quantityQuintals: f.qty,
        status: "WAITING",
        position: 0,
        estimatedWaitMinutes: null,
        joinedAt: new Date(now - 8 * 60 * 1000).toISOString(),
        acceptedAt: null,
        processingStartedAt: null,
        completedAt: null,
        notes: null,
        source: "ONLINE",
      });
      notify(entryId, "joined", `Joined queue at ${centre.name}. Token ${token}.`, "success");
    }
    recalculate(centre.id);
  }

  return store;
}

function getStore(): DemoStore {
  if (!g.__agristackDemoStore) {
    g.__agristackDemoStore = seedStore();
  }
  return g.__agristackDemoStore;
}

/** Test-only: wipe and reseed. */
export function resetDemoStore(): void {
  g.__agristackDemoStore = undefined;
  getStore();
}

async function withCentreLock<T>(centreId: string, fn: () => T | Promise<T>): Promise<T> {
  const prev = locks.get(centreId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    centreId,
    prev.then(() => current)
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function nextToken(_centreId: string): string {
  const store = getStore();
  // Global daily sequence so tokens stay unique across every centre.
  const key = `global:${todayKey()}`;
  store.tokenSeq[key] = (store.tokenSeq[key] ?? 0) + 1;
  return `PC-${todayKey()}-${String(store.tokenSeq[key]).padStart(4, "0")}`;
}

function averageProcessingMinutes(centreId: string): number {
  const recs = getStore().processing.filter((p) => p.centreId === centreId);
  if (recs.length === 0) return 15;
  const sum = recs.reduce((acc, p) => acc + p.durationMinutes, 0);
  return sum / recs.length;
}

function statusRank(status: QueueStatus): number {
  switch (status) {
    case "PROCESSING":
      return 0;
    case "ACCEPTED":
      return 1;
    case "WAITING":
      return 2;
    case "HOLD":
      return 3;
    default:
      return 4;
  }
}

function notify(
  entryId: string,
  eventKey: string | null,
  message: string,
  kind: QueueNotification["kind"]
): void {
  const store = getStore();
  if (eventKey) {
    const exists = store.notifications.some(
      (n) => n.queueEntryId === entryId && n.eventKey === eventKey
    );
    if (exists) return;
  }
  store.notifications.unshift({
    id: nid("n"),
    queueEntryId: entryId,
    message,
    kind,
    eventKey,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function dropEventKey(entryId: string, eventKey: string): void {
  const store = getStore();
  store.notifications = store.notifications.filter(
    (n) => !(n.queueEntryId === entryId && n.eventKey === eventKey)
  );
}

function recalculate(centreId: string): void {
  const store = getStore();
  const avg = averageProcessingMinutes(centreId);
  const active = store.entries
    .filter((e) => e.procurementCentreId === centreId && ACTIVE.includes(e.status))
    .sort((a, b) => {
      const sr = statusRank(a.status) - statusRank(b.status);
      if (sr !== 0) return sr;
      if (a.position !== b.position) return a.position - b.position;
      return a.joinedAt.localeCompare(b.joinedAt);
    });

  let pos = 0;
  for (const entry of active) {
    pos += 1;
    const oldPos = entry.position;
    entry.position = pos;
    entry.estimatedWaitMinutes = Math.max(0, Math.round((pos - 1) * avg));

    if (pos !== 1 && oldPos === 1) dropEventKey(entry.id, "you_are_next");
    if (pos !== 2 && oldPos === 2) dropEventKey(entry.id, "approaching");

    if (pos === 1 && (entry.status === "WAITING" || entry.status === "ACCEPTED" || entry.status === "HOLD")) {
      notify(
        entry.id,
        "you_are_next",
        "You are next. Please proceed to the procurement centre.",
        "action"
      );
    } else if (
      pos === 2 &&
      (entry.status === "WAITING" || entry.status === "ACCEPTED" || entry.status === "HOLD")
    ) {
      notify(
        entry.id,
        "approaching",
        "Your turn is approaching. Please prepare to proceed to the procurement centre.",
        "action"
      );
    }
  }
}

function findExistingCentre(optionId?: string, optionName?: string): DemoCentre | null {
  const store = getStore();
  const id = optionId?.trim();
  if (id) {
    const byId = store.centres.find((c) => c.id === id);
    if (byId) return byId;
    const stable = stableCentreId(id, optionName);
    const byStable = store.centres.find((c) => c.id === stable);
    if (byStable) return byStable;
    // Stable IDs that are not yet registered must not fall through to place-name
    // matching — that would merge e.g. "lasalgaon-apmc" into
    // "govt-procurement-lasalgaon" because both normalize to the same place key.
    if (isStableCentreId(id) || isStableCentreId(stable)) {
      return null;
    }
  }

  const keys = [optionId, optionName]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => centreMatchKey(v))
    .filter((k) => k.length > 0);

  for (const key of keys) {
    const matches = store.centres.filter(
      (c) => centreMatchKey(c.id) === key || centreMatchKey(c.name) === key
    );
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      const prefer = matches.find((c) => c.id === id) ?? matches[0];
      if (prefer) return prefer;
    }
  }
  return null;
}

/**
 * Resolve or auto-create a demo procurement centre.
 * Primary key is a stable ID; names are only used to find/label.
 */
export function ensureCentre(params: {
  id?: string;
  name?: string;
  district?: string;
  status?: CentreStatus;
}): DemoCentre {
  const store = getStore();
  const existing = findExistingCentre(params.id, params.name);
  if (existing) {
    if (params.name && params.name.trim() && existing.name !== params.name.trim()) {
      // Keep the canonical name if the incoming one is a short alias.
      if (params.name.trim().length > existing.name.length) {
        existing.name = params.name.trim();
      }
    }
    if (params.district && !existing.district) existing.district = params.district;
    return existing;
  }

  const id = stableCentreId(params.id, params.name);
  const again = store.centres.find((c) => c.id === id);
  if (again) return again;

  const name = humanizeCentreName(id, params.name);
  const centre: DemoCentre = {
    id,
    name,
    district:
      params.district ??
      inferDistrict(params.name ?? "") ??
      inferDistrict(id) ??
      "Maharashtra",
    status: params.status ?? "Open",
  };
  store.centres.push(centre);
  return centre;
}

function centreById(id: string): DemoCentre | null {
  return findExistingCentre(id) ?? null;
}

export function resolveCentreId(optionId: string, optionName?: string): string | null {
  if (!optionId?.trim() && !optionName?.trim()) return null;
  return ensureCentre({ id: optionId, name: optionName }).id;
}

/** Register every government-procurement and APMC selling option as a demo centre. */
export function syncCentresFromOptions(options: SellingOption[]): void {
  for (const option of options) {
    if (option.type !== "GOVERNMENT_PROCUREMENT" && option.type !== "APMC") continue;
    ensureCentre({
      id: option.id,
      name: option.name,
      district: option.district,
      status: option.status,
    });
  }
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
  if (!params.centreId?.trim() && !params.centreName?.trim()) {
    return { data: null, error: "Procurement centre is required." };
  }
  const centre = ensureCentre({ id: params.centreId, name: params.centreName });
  const centreId = centre.id;
  if (!params.quantity || params.quantity <= 0) {
    return { data: null, error: "quantity must be positive" };
  }

  return withCentreLock(centreId, () => {
    const store = getStore();
    const farmerId = nid("farmer");
    store.farmers.push({
      id: farmerId,
      displayName: params.displayName.trim() || "Farmer",
      phone: params.phone?.trim() || null,
      location: params.location?.trim() || null,
    });

    const token = nextToken(centreId);
    const entryId = nid("entry");
    const tempPos =
      store.entries.filter(
        (e) => e.procurementCentreId === centreId && ACTIVE.includes(e.status)
      ).length + 1;

    store.entries.push({
      id: entryId,
      token,
      procurementCentreId: centreId,
      centreName: centre.name,
      farmerId,
      farmerName: params.displayName.trim() || "Farmer",
      farmerPhone: params.phone?.trim() || null,
      commodityName: params.commodityName,
      quantityQuintals: params.quantity,
      status: "WAITING",
      position: tempPos,
      estimatedWaitMinutes: null,
      joinedAt: new Date().toISOString(),
      acceptedAt: null,
      processingStartedAt: null,
      completedAt: null,
      notes: params.notes?.trim() || null,
      source: params.source ?? "ONLINE",
    });

    notify(
      entryId,
      "joined",
      params.source === "OFFLINE_ADMIN"
        ? `Added by centre staff. Token ${token}.`
        : `Joined queue at ${centre.name}. Token ${token}.`,
      "success"
    );
    recalculate(centreId);

    const entry = store.entries.find((e) => e.id === entryId)!;
    return {
      data: {
        entryId: entry.id,
        token: entry.token,
        position: entry.position,
        estimatedWaitMinutes: entry.estimatedWaitMinutes ?? 0,
        status: entry.status,
        centreName: centre.name,
      },
      error: null,
    };
  });
}

export function getQueueEntryByToken(token: string): QueueEntry | null {
  return getStore().entries.find((e) => e.token === token) ?? null;
}

export function getNotificationsForEntry(entryId: string): QueueNotification[] {
  return getStore()
    .notifications.filter((n) => n.queueEntryId === entryId)
    .slice(0, 20);
}

export async function adminQueueAction(
  entryId: string,
  action: AdminQueueAction
): Promise<{
  data: {
    entry_id: string;
    token: string;
    status: string;
    position: number;
    estimated_wait_minutes: number | null;
  } | null;
  error: string | null;
}> {
  const store = getStore();
  const found = store.entries.find((e) => e.id === entryId);
  if (!found) return { data: null, error: "queue entry not found" };
  const centreId = found.procurementCentreId;

  return withCentreLock(centreId, () => {
    const entry = store.entries.find((e) => e.id === entryId);
    if (!entry) return { data: null, error: "queue entry not found" };

    const act = action.toUpperCase() as AdminQueueAction | "PUSH" | "PUSH_UP" | "PUSH_DOWN" | "CANCEL";
    let eventKey: string | null = null;
    let msg: string | null = null;
    let kind: QueueNotification["kind"] = "info";

    try {
      switch (act) {
        case "ACCEPT": {
          if (entry.status !== "WAITING" && entry.status !== "HOLD") {
            throw new Error(`cannot ACCEPT from status ${entry.status}`);
          }
          entry.status = "ACCEPTED";
          entry.acceptedAt = entry.acceptedAt ?? new Date().toISOString();
          eventKey = "accepted";
          msg = "Your token was accepted. Please proceed when called.";
          kind = "success";
          break;
        }
        case "HOLD": {
          if (entry.status !== "WAITING" && entry.status !== "ACCEPTED") {
            throw new Error(`cannot HOLD from status ${entry.status}`);
          }
          entry.status = "HOLD";
          eventKey = "hold";
          msg = "Your token is on hold. Please wait for further instructions.";
          kind = "warning";
          break;
        }
        case "RESUME": {
          if (entry.status !== "HOLD") {
            throw new Error(`cannot RESUME from status ${entry.status}`);
          }
          entry.status = "WAITING";
          eventKey = "resume";
          msg = "Your token is active again in the queue.";
          break;
        }
        case "PROCESS": {
          if (entry.status !== "ACCEPTED" && entry.status !== "WAITING") {
            throw new Error(`cannot PROCESS from status ${entry.status}`);
          }
          entry.status = "PROCESSING";
          entry.processingStartedAt = new Date().toISOString();
          entry.acceptedAt = entry.acceptedAt ?? new Date().toISOString();
          eventKey = "processing";
          msg = "Your procurement is now being processed.";
          kind = "action";
          break;
        }
        case "DONE": {
          if (entry.status !== "PROCESSING" && entry.status !== "ACCEPTED") {
            throw new Error(`cannot DONE from status ${entry.status}`);
          }
          const started = new Date(
            entry.processingStartedAt ?? entry.acceptedAt ?? entry.joinedAt
          );
          const duration = Math.max(
            0,
            Math.round((Date.now() - started.getTime()) / 60000)
          );
          entry.status = "DONE";
          entry.completedAt = new Date().toISOString();
          store.processing.push({
            id: nid("pr"),
            centreId,
            entryId: entry.id,
            commodityName: entry.commodityName,
            quantityQuintals: entry.quantityQuintals,
            startedAt: started.toISOString(),
            completedAt: entry.completedAt,
            durationMinutes: duration,
          });
          eventKey = "done";
          msg = "Your procurement has been completed.";
          kind = "success";
          break;
        }
        case "DEQUEUE":
        case "CANCEL": {
          entry.status = "CANCELLED";
          entry.completedAt = new Date().toISOString();
          eventKey = "cancelled";
          msg = "Your token was removed from the queue.";
          kind = "warning";
          break;
        }
        case "MOVE_UP":
        case "PUSH_UP": {
          if (!["WAITING", "ACCEPTED", "HOLD"].includes(entry.status)) {
            throw new Error(`cannot MOVE_UP from status ${entry.status}`);
          }
          const swap = store.entries
            .filter(
              (e) =>
                e.procurementCentreId === centreId &&
                ACTIVE.includes(e.status) &&
                e.position < entry.position
            )
            .sort((a, b) => b.position - a.position)[0];
          if (swap) {
            const tmp = entry.position;
            entry.position = swap.position;
            swap.position = tmp;
            eventKey = "moved";
            msg = "Your position in the queue was updated.";
          }
          break;
        }
        case "MOVE_DOWN":
        case "PUSH_DOWN":
        case "PUSH": {
          if (!["WAITING", "ACCEPTED", "HOLD"].includes(entry.status)) {
            throw new Error(`cannot MOVE_DOWN from status ${entry.status}`);
          }
          const swap = store.entries
            .filter(
              (e) =>
                e.procurementCentreId === centreId &&
                ACTIVE.includes(e.status) &&
                e.position > entry.position
            )
            .sort((a, b) => a.position - b.position)[0];
          if (swap) {
            const tmp = entry.position;
            entry.position = swap.position;
            swap.position = tmp;
            eventKey = "moved";
            msg = "Your position in the queue was updated.";
          }
          break;
        }
        default:
          throw new Error(`unknown action: ${action}`);
      }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : String(err) };
    }

    recalculate(centreId);
    if (eventKey && msg) notify(entry.id, eventKey, msg, kind);

    return {
      data: {
        entry_id: entry.id,
        token: entry.token,
        status: entry.status,
        position: entry.position,
        estimated_wait_minutes: entry.estimatedWaitMinutes,
      },
      error: null,
    };
  });
}

export function listProcurementCentresForAdmin(): Array<{
  id: string;
  name: string;
  status: string;
  district?: string;
}> {
  getStore();
  return getStore().centres.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    district: c.district,
  }));
}

export function getCentreDashboard(centreId: string): CentreDashboardStats | null {
  if (!centreId?.trim()) return null;
  const centre = ensureCentre({ id: centreId });
  const store = getStore();
  const activeEntries = store.entries
    .filter((e) => e.procurementCentreId === centre.id && ACTIVE.includes(e.status))
    .sort((a, b) => a.position - b.position);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const doneToday = store.entries.filter(
    (e) =>
      e.procurementCentreId === centre.id &&
      e.status === "DONE" &&
      e.completedAt &&
      new Date(e.completedAt) >= startOfDay
  ).length;

  const avgProcessingMinutes = averageProcessingMinutes(centre.id);
  const historyCount = store.processing.filter((p) => p.centreId === centre.id).length;

  return {
    centreId: centre.id,
    centreName: centre.name,
    status: centre.status,
    waitingCount: activeEntries.filter((e) => e.status === "WAITING" || e.status === "HOLD")
      .length,
    processingCount: activeEntries.filter(
      (e) => e.status === "PROCESSING" || e.status === "ACCEPTED"
    ).length,
    doneToday,
    avgProcessingMinutes,
    activeEntries,
    historyCount,
    // Same rule the live queue uses per-entry (position - 1) × avg, applied to
    // a farmer who would join at the back of the current active queue.
    predictedWaitMinutes: Math.max(0, Math.round(activeEntries.length * avgProcessingMinutes)),
  };
}

export function getProcessingHistory(
  centreId: string,
  limit = 30
): ProcessingRecordPoint[] {
  const resolved = resolveCentreId(centreId) ?? centreId;
  return getStore()
    .processing.filter((p) => p.centreId === resolved)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .slice(-limit)
    .map((p) => ({
      completedAt: p.completedAt,
      durationMinutes: p.durationMinutes,
    }));
}

/** Snapshot for the demo poll API (farmer live ticket). */
export function snapshotByToken(token: string): {
  entry: QueueEntry;
  notifications: QueueNotification[];
} | null {
  const entry = getQueueEntryByToken(token);
  if (!entry) return null;
  return { entry, notifications: getNotificationsForEntry(entry.id) };
}
