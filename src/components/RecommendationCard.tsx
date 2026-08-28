import { formatINR, formatWaitingTime } from "@/lib/calculations";
import type { RecommendationResult } from "@/lib/types";
import { DemoDataBadge } from "./DemoDataBadge";
import { JoinQueueButton } from "./JoinQueueButton";

export function RecommendationCard({
  result,
  farmerName,
}: {
  result: RecommendationResult;
  farmerName?: string;
}) {
  const { recommended, cropDetails } = result;

  return (
    <div className="rounded-2xl border border-leaf-600 bg-leaf-50 p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-leaf-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Recommended
        </span>
        <DemoDataBadge />
      </div>

      <h2 className="mt-3 text-2xl font-bold text-soil-900">{recommended.name}</h2>
      <p className="text-sm text-soil-600">
        Best expected net benefit for {cropDetails.quantity} quintals of{" "}
        {cropDetails.crop.toLowerCase()}, based on price, transport cost and waiting
        time.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Gross revenue" value={formatINR(recommended.financials.grossRevenue)} />
        <Stat
          label="Transport cost"
          value={`− ${formatINR(recommended.financials.transportCost)}`}
        />
        <Stat
          label="Net return"
          value={formatINR(recommended.financials.netReturn)}
          highlight
        />
      </div>

      <div className="mt-6 border-t border-leaf-600/20 pt-5">
        <h3 className="text-sm font-semibold text-soil-900">Why this option?</h3>
        <ul className="mt-3 space-y-2">
          {recommended.scoreFactors.map((factor) => (
            <li key={factor.label} className="flex items-start gap-2 text-sm text-soil-700">
              <span
                className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
                  factor.impact >= 0 ? "bg-leaf-500" : "bg-red-400"
                }`}
              />
              <span>
                <span className="font-medium text-soil-900">{factor.label}:</span>{" "}
                {factor.detail}
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-sm text-soil-700">
            <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-soil-600" />
            <span>
              <span className="font-medium text-soil-900">Distance & waiting:</span>{" "}
              {recommended.distance} km away, estimated wait of{" "}
              {formatWaitingTime(recommended.waitingMinutes)}, availability{" "}
              {recommended.availability.toLowerCase()}.
            </span>
          </li>
        </ul>
      </div>

      <JoinQueueButton
        centreId={recommended.id}
        centreName={recommended.name}
        optionType={recommended.type}
        commodityName={cropDetails.crop}
        quantity={cropDetails.quantity}
        location={cropDetails.location}
        farmerName={farmerName}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-soil-600">{label}</p>
      <p className={`mt-1 font-bold ${highlight ? "text-xl text-leaf-700" : "text-lg text-soil-900"}`}>
        {value}
      </p>
    </div>
  );
}
