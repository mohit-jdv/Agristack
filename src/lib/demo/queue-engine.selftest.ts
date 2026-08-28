/**
 * Static SIH queue simulation (no Next, no Supabase).
 * Run: node --experimental-strip-types --no-warnings src/lib/demo/queue-engine.selftest.ts
 */
import {
  adminQueueAction,
  getCentreDashboard,
  getNotificationsForEntry,
  getQueueEntryByToken,
  joinQueue,
  listProcurementCentresForAdmin,
  resetDemoStore,
  resolveCentreId,
} from "./queue-engine.ts";

const CENTRE = "govt-procurement-nashik";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function keys(entryId: string): string[] {
  return getNotificationsForEntry(entryId)
    .map((n) => n.eventKey)
    .filter((k): k is string => Boolean(k));
}

async function main() {
  resetDemoStore();

  // Seed already has two WAITING farmers
  let dash = getCentreDashboard(CENTRE);
  assert(dash, "dashboard");
  assert(dash.activeEntries.length === 2, `seed size ${dash.activeEntries.length}`);
  const [a001, a002] = dash.activeEntries;
  assert(a001 && a002, "seed entries");
  assert(a001.position === 1 && a002.position === 2, "seed positions");
  assert(a001.estimatedWaitMinutes === 0, "A001 ETA 0");
  assert((a002.estimatedWaitMinutes ?? 0) > 0, "A002 ETA > 0");
  assert(Math.max(0, a001.position - 1) === 0, "A001 people ahead 0");
  assert(Math.max(0, a002.position - 1) === 1, "A002 people ahead 1");
  assert(keys(a001.id).includes("you_are_next"), "A001 you_are_next");
  assert(keys(a002.id).includes("approaching"), "A002 approaching");

  const join3 = await joinQueue({
    centreId: CENTRE,
    displayName: "A003 Farmer",
    commodityName: "Onion",
    quantity: 30,
  });
  assert(join3.data, join3.error ?? "join3");
  const a003 = getQueueEntryByToken(join3.data.token);
  assert(a003, "a003");
  dash = getCentreDashboard(CENTRE)!;
  assert(dash.activeEntries.map((e) => e.position).join(",") === "1,2,3", "positions after join");
  assert(new Set(dash.activeEntries.map((e) => e.position)).size === 3, "unique positions");

  // A001 PROCESS → DONE
  let r = await adminQueueAction(a001.id, "PROCESS");
  assert(!r.error, r.error ?? "");
  r = await adminQueueAction(a001.id, "DONE");
  assert(!r.error, r.error ?? "");
  dash = getCentreDashboard(CENTRE)!;
  const afterDone = dash.activeEntries;
  assert(afterDone.length === 2, `after done ${afterDone.length}`);
  assert(afterDone[0]?.id === a002.id && afterDone[0].position === 1, "A002 is pos 1");
  assert(afterDone[1]?.id === a003.id && afterDone[1].position === 2, "A003 is pos 2");
  assert(keys(a002.id).includes("you_are_next"), "A002 you_are_next after A001 done");
  assert(keys(a001.id).includes("processing") && keys(a001.id).includes("done"), "A001 process/done");
  const youAreNextCount = getNotificationsForEntry(a002.id).filter(
    (n) => n.eventKey === "you_are_next"
  ).length;
  assert(youAreNextCount === 1, `deduped you_are_next got ${youAreNextCount}`);

  // MOVE_UP A003 ahead of A002
  r = await adminQueueAction(a003.id, "MOVE_UP");
  assert(!r.error, r.error ?? "");
  dash = getCentreDashboard(CENTRE)!;
  assert(dash.activeEntries[0]?.id === a003.id, "A003 now first");
  assert(dash.activeEntries[1]?.id === a002.id, "A002 now second");
  assert(dash.activeEntries[0]?.position === 1, "moved A003 pos 1");
  assert(dash.activeEntries[1]?.position === 2, "moved A002 pos 2");
  assert(Math.max(0, dash.activeEntries[1]!.position - 1) === 1, "people ahead after move");

  // Join A004
  const join4 = await joinQueue({
    centreId: CENTRE,
    displayName: "A004 Farmer",
    commodityName: "Onion",
    quantity: 20,
  });
  assert(join4.data, join4.error ?? "join4");
  dash = getCentreDashboard(CENTRE)!;
  const positions = dash.activeEntries.map((e) => e.position);
  assert(positions.join(",") === "1,2,3", `A004 positions ${positions}`);
  assert(new Set(positions).size === positions.length, "unique after A004");
  const a004 = getQueueEntryByToken(join4.data.token)!;
  assert((a004.estimatedWaitMinutes ?? 0) > 0, "A004 ETA recalculated");

  // Concurrent joins should not collide
  resetDemoStore();
  const [x, y] = await Promise.all([
    joinQueue({
      centreId: CENTRE,
      displayName: "Concurrent 1",
      commodityName: "Onion",
      quantity: 10,
    }),
    joinQueue({
      centreId: CENTRE,
      displayName: "Concurrent 2",
      commodityName: "Onion",
      quantity: 10,
    }),
  ]);
  assert(x.data && y.data, "concurrent joins");
  dash = getCentreDashboard(CENTRE)!;
  const posSet = new Set(dash.activeEntries.map((e) => e.position));
  assert(posSet.size === dash.activeEntries.length, "no duplicate positions after concurrent join");

  // Generic procurement centres — any recommended govt centre can join.
  resetDemoStore();
  const generic = [
    { id: "govt-procurement-lasalgaon", name: "Lasalgaon Government Procurement Centre" },
    { id: "govt-procurement-manmad", name: "Manmad Government Procurement Centre" },
    { id: "govt-procurement-nashik", name: "Nashik Government Procurement Centre" },
    { id: "govt-procurement-pune", name: "Pune Government Procurement Centre" },
    { id: "govt-procurement-nagpur", name: "Nagpur Government Procurement Centre" },
    { id: "govt-procurement-jalgaon", name: "Jalgaon Government Procurement Centre" },
  ];

  const tokens: Record<string, string> = {};
  for (const c of generic) {
    const joined = await joinQueue({
      centreId: c.id,
      centreName: c.name,
      displayName: `${c.id} farmer`,
      commodityName: "Onion",
      quantity: 12,
    });
    assert(joined.data, joined.error ?? `join ${c.id}`);
    assert(joined.data.centreName.toLowerCase().includes(c.name.split(" ")[0]!.toLowerCase()), `name ${c.id}`);
    const entry = getQueueEntryByToken(joined.data.token);
    assert(entry, `entry ${c.id}`);
    assert(entry.procurementCentreId === c.id, `centre id ${c.id} got ${entry.procurementCentreId}`);
    const centreDash = getCentreDashboard(c.id);
    assert(centreDash, `dash ${c.id}`);
    assert(
      centreDash.activeEntries.some((e) => e.token === joined.data!.token),
      `farmer on ${c.id} queue`
    );
    tokens[c.id] = joined.data.token;
  }

  // Alias / display-name resolution must reuse the stable Lasalgaon id.
  const alias = await joinQueue({
    centreId: "Lasalgaon",
    centreName: "Lasalgaon Government Procurement Centre",
    displayName: "Alias Farmer",
    commodityName: "Onion",
    quantity: 8,
  });
  assert(alias.data, alias.error ?? "alias join");
  const aliasEntry = getQueueEntryByToken(alias.data.token);
  assert(aliasEntry?.procurementCentreId === "govt-procurement-lasalgaon", "alias maps to lasalgaon id");
  const lasalgaonDash = getCentreDashboard("govt-procurement-lasalgaon")!;
  assert(lasalgaonDash.activeEntries.length >= 2, "lasalgaon has both joins");

  // Auto-create an unknown recommended centre instead of dropping it.
  const unknown = await joinQueue({
    centreId: "govt-procurement-solapur",
    centreName: "Solapur Government Procurement Centre",
    displayName: "Solapur Farmer",
    commodityName: "Onion",
    quantity: 15,
  });
  assert(unknown.data, unknown.error ?? "auto-create");
  assert(resolveCentreId("govt-procurement-solapur") === "govt-procurement-solapur", "solapur id");
  const listed = listProcurementCentresForAdmin();
  assert(
    listed.some((c) => c.id === "govt-procurement-solapur"),
    "admin list includes auto-created centre"
  );

  // Tokens must be unique across centres.
  const allTokens = Object.values(tokens);
  assert(new Set(allTokens).size === allTokens.length, "unique tokens across centres");

  console.log("DEMO QUEUE SIMULATION OK");
}

main().catch((err) => {
  console.error("DEMO QUEUE SIMULATION FAILED", err);
  process.exit(1);
});
