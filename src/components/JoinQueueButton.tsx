"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinQueueAction } from "@/app/actions/queue";
import { readFarmerSession, writeFarmerSession } from "@/lib/demo/farmer-session";
import type { OptionType } from "@/lib/types";

interface JoinQueueButtonProps {
  centreId: string;
  centreName: string;
  optionType: OptionType;
  commodityName: string;
  quantity: number;
  location?: string;
  farmerName?: string;
  compact?: boolean;
}

export function JoinQueueButton({
  centreId,
  centreName,
  optionType,
  commodityName,
  quantity,
  location = "",
  farmerName = "",
  compact = false,
}: JoinQueueButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(farmerName);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const session = readFarmerSession();
    const fromSession = session?.name?.trim() ?? "";
    const next = (farmerName || fromSession).trim();
    if (next) setDisplayName(next);
  }, [farmerName]);

  // Queue is available for government procurement centres and APMC/mandi markets.
  if (optionType !== "GOVERNMENT_PROCUREMENT" && optionType !== "APMC") {
    return null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = displayName.trim();
    if (!name) {
      setError("Please enter your name.");
      return;
    }
    const session = readFarmerSession();
    writeFarmerSession({
      name,
      crop: session?.crop ?? commodityName,
      quantity: session?.quantity ?? quantity,
      location: session?.location ?? location,
    });
    startTransition(() => {
      void (async () => {
        const result = await joinQueueAction({
          centreId,
          centreName,
          displayName: name,
          phone: phone.trim() || undefined,
          location,
          commodityName,
          quantity,
        });
        if (result.error || !result.data) {
          setError(result.error ?? "Could not join queue.");
          return;
        }
        router.push(`/queue/${result.data.token}`);
      })();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "rounded-full bg-leaf-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-leaf-700"
            : "mt-4 rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-leaf-700"
        }
      >
        Join queue
      </button>
    );
  }

  return (
    <div
      className={
        compact
          ? "mt-2 rounded-xl border border-soil-100 bg-white p-3 shadow-sm"
          : "mt-4 rounded-2xl border border-soil-100 bg-white p-4 shadow-sm"
      }
    >
      <p className="text-sm font-medium text-soil-900">
        Join queue at {centreName}
      </p>
      <p className="mt-0.5 text-xs text-soil-600">
        You will receive a live token for this centre / market.
      </p>
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <input
          type="text"
          required
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg border border-soil-100 px-3 py-2 text-sm outline-none focus:border-leaf-400"
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-soil-100 px-3 py-2 text-sm outline-none focus:border-leaf-400"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-leaf-600 px-4 py-2 text-xs font-semibold text-white hover:bg-leaf-700 disabled:opacity-60"
          >
            {pending ? "Joining…" : "Get token"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-soil-100 px-4 py-2 text-xs font-semibold text-soil-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
