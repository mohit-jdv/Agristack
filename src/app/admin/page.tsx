import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { listProcurementCentresForAdmin } from "@/lib/data/queue";
import { isDemoMode } from "@/lib/config";
import { DemoDataBadge } from "@/components/DemoDataBadge";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const centres = await listProcurementCentresForAdmin();
  const demo = isDemoMode();

  return (
    <main>
      <Navbar />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-soil-900">
            Centre admin
          </h1>
          {demo && <DemoDataBadge label="Shared demo queue" />}
        </div>
        <p className="mt-1 text-soil-600">
          Select a government procurement centre to manage its live token queue.
          {demo
            ? " Farmer joins and admin actions share the same in-memory queue."
            : ""}
        </p>

        {centres.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-soil-100 bg-white p-8 text-center text-sm text-soil-600">
            No procurement centres found. Apply migrations and seed data, and
            ensure Supabase env vars are set.
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {centres.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/${c.id}`}
                  className="flex items-center justify-between rounded-2xl border border-soil-100 bg-white px-5 py-4 shadow-sm transition hover:border-leaf-400"
                >
                  <div>
                    <p className="font-semibold text-soil-900">{c.name}</p>
                    <p className="text-xs text-soil-600">
                      {c.district ?? "—"} · {c.status}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-leaf-700">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}