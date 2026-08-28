"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DEMO_CROPS } from "@/lib/demo-data";
import { readFarmerSession, writeFarmerSession } from "@/lib/demo/farmer-session";

interface CropFormProps {
  defaultLocation: string;
  name: string;
  onNameChange: (name: string) => void;
}

export function CropForm({ defaultLocation, name, onNameChange }: CropFormProps) {
  const router = useRouter();
  const [crop, setCrop] = useState<string>(DEMO_CROPS[0]);
  const [quantity, setQuantity] = useState<string>("50");
  const [location, setLocation] = useState<string>(defaultLocation);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readFarmerSession();
    if (stored) {
      if (stored.crop) setCrop(stored.crop);
      if (stored.quantity) setQuantity(String(stored.quantity));
      if (stored.location) setLocation(stored.location);
    }
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const farmerName = name.trim();

    if (!farmerName) {
      setError("Please enter your name.");
      return;
    }
    if (!crop) {
      setError("Please select a crop.");
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    if (!location.trim()) {
      setError("Enter your current location.");
      return;
    }

    setError(null);
    writeFarmerSession({
      name: farmerName,
      crop,
      quantity: parsedQuantity,
      location: location.trim(),
    });
    const params = new URLSearchParams({
      name: farmerName,
      crop,
      quantity: String(parsedQuantity),
      location: location.trim(),
    });
    router.push(`/compare?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-soil-100 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Mohit"
            autoComplete="name"
            className="w-full rounded-lg border border-soil-100 bg-white px-3 py-2.5 text-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100"
          />
        </Field>

        <Field label="Crop">
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="w-full rounded-lg border border-soil-100 bg-white px-3 py-2.5 text-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100"
          >
            {DEMO_CROPS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity (quintals)">
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-soil-100 bg-white px-3 py-2.5 text-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100"
          />
        </Field>

        <Field label="Current location" className="sm:col-span-2">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Nashik, Maharashtra"
            className="w-full rounded-lg border border-soil-100 bg-white px-3 py-2.5 text-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100"
          />
        </Field>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        className="mt-6 w-full rounded-full bg-leaf-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-700 sm:w-auto"
      >
        Compare selling options
      </button>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-soil-600">
        {label}
      </span>
      {children}
    </label>
  );
}
