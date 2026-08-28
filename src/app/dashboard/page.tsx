"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { CropForm } from "@/components/CropForm";
import { DEMO_FARMER } from "@/lib/demo-data";
import {
  readFarmerSession,
  writeFarmerSession,
} from "@/lib/demo/farmer-session";

export default function DashboardPage() {
  const [name, setName] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const session = readFarmerSession();
    if (session?.name) setName(session.name);
    setHydrated(true);
  }, []);

  const displayName = name.trim();

  return (
    <main>
      <Navbar />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm font-medium text-leaf-700">
          Welcome {hydrated && displayName ? displayName : "Farmer"}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-soil-900">
          What are you selling today?
        </h1>
        <p className="mt-2 text-soil-600">
          Tell us your name, crop, quantity and location — we'll compare every nearby
          mandi and procurement centre for you.
        </p>

        <div className="mt-8">
          <CropForm
            defaultLocation={DEMO_FARMER.location}
            name={name}
            onNameChange={(value) => {
              setName(value);
              const session = readFarmerSession();
              if (value.trim()) {
                writeFarmerSession({
                  name: value,
                  crop: session?.crop ?? "Onion",
                  quantity: session?.quantity ?? 50,
                  location: session?.location ?? DEMO_FARMER.location,
                });
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}
