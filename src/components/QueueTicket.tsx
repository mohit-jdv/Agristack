"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QueueEntry, QueueNotification, QueueStatus } from "@/lib/types";
import { formatWaitingTime } from "@/lib/calculations";

interface QueueTicketProps {
  initialEntry: QueueEntry;
  initialNotifications: QueueNotification[];
  /** When true, poll the in-memory demo API instead of Supabase Realtime. */
  demoLive?: boolean;
}

export function QueueTicket({
  initialEntry,
  initialNotifications,
  demoLive = false,
}: QueueTicketProps) {
  const [entry, setEntry] = useState(initialEntry);
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    setEntry(initialEntry);
    setNotifications(initialNotifications);
  }, [initialEntry, initialNotifications]);

  useEffect(() => {
    if (demoLive) {
      const id = window.setInterval(async () => {
        try {
          const res = await fetch(
            `/api/demo/queue/${encodeURIComponent(initialEntry.token)}`,
            { cache: "no-store" }
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            entry: QueueEntry;
            notifications: QueueNotification[];
          };
          setEntry(data.entry);
          setNotifications(data.notifications);
        } catch {
          /* demo poll is best-effort */
        }
      }, 1500);
      return () => window.clearInterval(id);
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`queue-entry-${entry.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "queue_entries",
          filter: `id=eq.${entry.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as {
            status: QueueStatus;
            position: number;
            estimated_wait_minutes: number | null;
            accepted_at: string | null;
            processing_started_at: string | null;
            completed_at: string | null;
          };
          setEntry((prev) => ({
            ...prev,
            status: row.status,
            position: row.position,
            estimatedWaitMinutes: row.estimated_wait_minutes,
            acceptedAt: row.accepted_at,
            processingStartedAt: row.processing_started_at,
            completedAt: row.completed_at,
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `queue_entry_id=eq.${entry.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const n = payload.new as {
            id: string;
            queue_entry_id: string;
            message: string;
            kind: QueueNotification["kind"];
            created_at: string;
            read_at: string | null;
          };
          setNotifications((prev) => [
            {
              id: n.id,
              queueEntryId: n.queue_entry_id,
              message: n.message,
              kind: n.kind,
              createdAt: n.created_at,
              readAt: n.read_at,
            },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [entry.id, demoLive, initialEntry.token]);

  const terminal = entry.status === "DONE" || entry.status === "CANCELLED";

  return (
    <div className="space-y-6">
      {/* Ticket stub */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-leaf-400 bg-white shadow-sm">
        <div className="bg-leaf-600 px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-white">
          Agri-Track · Procurement token
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-soil-600">
            Token number
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-soil-900 sm:text-4xl">
            {entry.token}
          </p>
          <p className="mt-2 text-sm text-soil-600">
            {entry.centreName ?? "Procurement centre"}
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-soil-100 text-center sm:grid-cols-4">
          <div className="border-r border-soil-100 px-3 py-4">
            <p className="text-xs uppercase text-soil-600">Position</p>
            <p className="mt-1 text-xl font-bold text-soil-900">
              {terminal ? "—" : `#${entry.position}`}
            </p>
          </div>
          <div className="border-r border-soil-100 px-3 py-4">
            <p className="text-xs uppercase text-soil-600">People ahead</p>
            <p className="mt-1 text-xl font-bold text-soil-900">
              {terminal ? "—" : Math.max(0, entry.position - 1)}
            </p>
          </div>
          <div className="border-r border-soil-100 px-3 py-4">
            <p className="text-xs uppercase text-soil-600">Status</p>
            <p className="mt-1 text-sm font-bold text-leaf-700">{entry.status}</p>
          </div>
          <div className="px-3 py-4">
            <p className="text-xs uppercase text-soil-600">ETA</p>
            <p className="mt-1 text-sm font-bold text-soil-900">
              {terminal
                ? "—"
                : entry.estimatedWaitMinutes != null
                  ? formatWaitingTime(entry.estimatedWaitMinutes)
                  : "—"}
            </p>
          </div>
        </div>
        <div className="border-t border-soil-100 px-6 py-3 text-center text-xs text-soil-600">
          {entry.commodityName} · {entry.quantityQuintals} quintals
          {entry.farmerName ? ` · ${entry.farmerName}` : ""}
        </div>
      </div>

      {/* Live updates */}
      <div className="rounded-2xl border border-soil-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-soil-900">Live updates</h2>
        {notifications.length === 0 ? (
          <p className="mt-2 text-sm text-soil-600">No updates yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-soil-100 bg-soil-50 px-3 py-2 text-sm text-soil-800"
              >
                <span className="text-xs text-soil-600">
                  {new Date(n.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <p className="mt-0.5">{n.message}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-soil-600">
          This page updates automatically when the centre changes your token
          status
          {demoLive ? " (demo live poll — in-memory queue)." : "."}
        </p>
      </div>
    </div>
  );
}
