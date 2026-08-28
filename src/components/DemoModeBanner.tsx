import { isDemoMode } from "@/lib/config";

/** Visible SIH label: mock/in-memory data, not live government systems. */
export function DemoModeBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="bg-wheat-500 px-4 py-2 text-center text-xs font-semibold text-soil-900">
      SIH demo mode — sample market data and an in-memory procurement queue.
      Not connected to live e-NAM or government systems.
    </div>
  );
}
