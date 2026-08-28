"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminQueueActionServer } from "@/app/actions/queue";
import type { AdminQueueAction, QueueEntry } from "@/lib/types";

const ACTIONS: { key: AdminQueueAction; label: string; forStatus: string[] }[] = [
  { key: "ACCEPT", label: "Accept", forStatus: ["WAITING", "HOLD"] },
  { key: "HOLD", label: "Hold", forStatus: ["WAITING", "ACCEPTED"] },
  { key: "RESUME", label: "Resume", forStatus: ["HOLD"] },
  { key: "PROCESS", label: "Process", forStatus: ["ACCEPTED", "WAITING"] },
  { key: "DONE", label: "Done", forStatus: ["PROCESSING", "ACCEPTED"] },
  { key: "MOVE_UP", label: "Up", forStatus: ["WAITING", "ACCEPTED", "HOLD"] },
  { key: "MOVE_DOWN", label: "Down", forStatus: ["WAITING", "ACCEPTED", "HOLD"] },
  {
    key: "DEQUEUE",
    label: "Remove",
    forStatus: ["WAITING", "ACCEPTED", "HOLD", "PROCESSING"],
  },
];

export function AdminQueueTable({
  entries,
  centreId,
}: {
  entries: QueueEntry[];
  centreId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(entryId: string, action: AdminQueueAction) {
    const key = `${entryId}:${action}`;
    setPending(key);
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await adminQueueActionServer(entryId, action, centreId);
        if (result.error) {
          setError(result.error);
          setPending(null);
          return;
        }
        setPending(null);
        router.refresh();
      })();
    });
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-soil-100 bg-white p-8 text-center text-sm text-soil-600">
        No active tokens in this centre queue.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-soil-100 bg-white shadow-sm">
      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-soil-100 text-left text-xs uppercase tracking-wide text-soil-600">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3">Farmer</th>
              <th className="px-4 py-3">Crop</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const busy = pending?.startsWith(entry.id + ":") ?? false;
              return (
                <tr key={entry.id} className="border-b border-soil-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-soil-800">
                    {entry.position}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-soil-900">
                    {entry.token}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-soil-900">
                        {entry.farmerName ?? "—"}
                      </span>
                      {entry.source === "OFFLINE_ADMIN" && (
                        <span className="rounded-full bg-soil-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-soil-700">
                          Offline / Admin Added
                        </span>
                      )}
                    </div>
                    {entry.farmerPhone && (
                      <div className="text-xs text-soil-600">{entry.farmerPhone}</div>
                    )}
                    {entry.notes && (
                      <div className="text-xs italic text-soil-500">{entry.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{entry.commodityName}</td>
                  <td className="px-4 py-3">{entry.quantityQuintals} q</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3">
                    {entry.estimatedWaitMinutes != null
                      ? `~${entry.estimatedWaitMinutes} min`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ACTIONS.filter((a) =>
                        a.forStatus.includes(entry.status)
                      ).map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          disabled={busy}
                          onClick={() => run(entry.id, a.key)}
                          className="rounded-full border border-soil-100 px-2 py-0.5 text-xs font-medium text-soil-800 hover:border-leaf-400 hover:text-leaf-700 disabled:opacity-50"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    WAITING: "bg-wheat-50 text-wheat-600",
    ACCEPTED: "bg-leaf-100 text-leaf-700",
    HOLD: "bg-soil-100 text-soil-800",
    PROCESSING: "bg-leaf-600 text-white",
    DONE: "bg-leaf-50 text-leaf-700",
    CANCELLED: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        styles[status] ?? "bg-soil-100 text-soil-800"
      }`}
    >
      {status}
    </span>
  );
}
