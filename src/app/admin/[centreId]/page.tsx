import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AdminQueueTable } from "@/components/AdminQueueTable";
import {
  getCentreDashboard,
  getProcessingHistory,
} from "@/lib/data/queue";
import { ProcessingChart } from "@/components/ProcessingChart";
import { isDemoMode } from "@/lib/config";
import { DemoLiveRefresher } from "@/components/DemoLiveRefresher";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { AddOfflineFarmerForm } from "@/components/AddOfflineFarmerForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { centreId: string };
}

export default async function AdminCentrePage({ params }: PageProps) {
  const centreId = decodeURIComponent(params.centreId);
  const dashboard = await getCentreDashboard(centreId);
  if (!dashboard) {
    notFound();
  }

  const history = await getProcessingHistory(params.centreId, 40);
  const demo = isDemoMode();

  return (
    <main>
      <Navbar />
      <DemoLiveRefresher enabled={demo} />
      <div className="mx-auto max-w-5xl px-6 py-14">
        <Link href="/admin" className="text-sm font-medium text-leaf-700 hover:underline">
          ← All centres
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-soil-900">
            {dashboard.centreName}
          </h1>
          {demo && <DemoDataBadge label="In-memory queue" />}
        </div>
        <p className="mt-1 text-sm text-soil-600">
          Live procurement queue · status {dashboard.status}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Current queue" value={String(dashboard.activeEntries.length)} />
          <Kpi label="Waiting" value={String(dashboard.waitingCount)} />
          <Kpi label="In process" value={String(dashboard.processingCount)} />
          <Kpi label="Done today" value={String(dashboard.doneToday)} />
          <Kpi
            label="Avg process"
            value={`${Math.round(dashboard.avgProcessingMinutes)} min`}
          />
          <Kpi
            label="Predicted wait (new farmer)"
            value={`~${dashboard.predictedWaitMinutes} min`}
          />
        </div>
        <p className="mt-2 text-xs text-soil-600">
          {dashboard.historyCount > 0
            ? `Estimate based on ${dashboard.historyCount} completed processing record${
                dashboard.historyCount === 1 ? "" : "s"
              } at this centre.`
            : "Insufficient historical data — using the default 15-minute processing estimate."}
        </p>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-soil-600">
            Active queue
          </h2>
          <AddOfflineFarmerForm
            centreId={dashboard.centreId}
            centreName={dashboard.centreName}
          />
        </div>
        <div className="mt-3">
          <AdminQueueTable
            entries={dashboard.activeEntries}
            centreId={dashboard.centreId}
          />
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-soil-600">
            Processing time (recent) &amp; predicted wait
          </h2>
          <ProcessingChart
            points={history}
            avgProcessingMinutes={dashboard.avgProcessingMinutes}
            currentQueueLength={dashboard.activeEntries.length}
            predictedWaitMinutes={dashboard.predictedWaitMinutes}
            historyCount={dashboard.historyCount}
          />
        </div>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-soil-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-soil-600">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-soil-900">{value}</p>
    </div>
  );
}