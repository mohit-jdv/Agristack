"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addOfflineFarmerAction } from "@/app/actions/queue";
import { DEMO_CROPS } from "@/lib/demo-data";

export function AddOfflineFarmerForm({
  centreId,
  centreName,
}: {
  centreId: string;
  centreName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [crop, setCrop] = useState<string>(DEMO_CROPS[0]);
  const [quantity, setQuantity] = useState("50");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setPhone("");
    setQuantity("50");
    setNotes("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const displayName = name.trim();
    const parsedQuantity = Number(quantity);

    if (!displayName) {
      setError("Please enter the farmer's name.");
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await addOfflineFarmerAction({
          centreId,
          centreName,
          displayName,
          phone: phone.trim() || undefined,
          commodityName: crop,
          quantity: parsedQuantity,
          notes: notes.trim() || undefined,
        });
        if (result.error || !result.data) {
          setError(result.error ?? "Could not add farmer.");
          return;
        }
        setLastToken(result.data.token);
        reset();
        router.refresh();
      })();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-leaf-600 px-4 py-2 text-xs font-semibold text-leaf-700 hover:bg-leaf-50"
      >
        + Add offline farmer
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-soil-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-soil-900">Add offline farmer</p>
          <p className="text-xs text-soil-600">
            For farmers who arrived in person without using the website. They get a
            token in this same queue, marked{" "}
            <span className="font-medium">Offline / Admin Added</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-soil-600 hover:text-soil-900"
        >
          Close
        </button>
      </div>

      {lastToken && (
        <p className="mt-3 rounded-lg bg-leaf-50 px-3 py-2 text-xs font-medium text-leaf-700">
          Added — token {lastToken} is now in the queue.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-soil-600">
            Farmer name
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunil Jadhav"
            className="w-full rounded-lg border border-soil-100 px-3 py-2 text-sm outline-none focus:border-leaf-400"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-soil-600">
            Mobile (optional)
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit number"
            className="w-full rounded-lg border border-soil-100 px-3 py-2 text-sm outline-none focus:border-leaf-400"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-soil-600">
            Crop
          </span>
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="w-full rounded-lg border border-soil-100 px-3 py-2 text-sm outline-none focus:border-leaf-400"
          >
            {DEMO_CROPS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-soil-600">
            Quantity (quintals)
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-soil-100 px-3 py-2 text-sm outline-none focus:border-leaf-400"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-soil-600">
            Notes (optional)
          </span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. brought sample bags"
            className="w-full rounded-lg border border-soil-100 px-3 py-2 text-sm outline-none focus:border-leaf-400"
          />
        </label>

        {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-leaf-600 px-4 py-2 text-xs font-semibold text-white hover:bg-leaf-700 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add to queue"}
          </button>
        </div>
      </form>
    </div>
  );
}
