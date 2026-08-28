import { formatINR, formatWaitingTime } from "@/lib/calculations";
import type { ScoredOption } from "@/lib/types";
import { DemoDataBadge } from "./DemoDataBadge";
import { JoinQueueButton } from "./JoinQueueButton";

export function ComparisonTable({
  options,
  quantity,
  crop,
  location,
  farmerName,
}: {
  options: ScoredOption[];
  quantity: number;
  crop: string;
  location?: string;
  farmerName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-soil-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-soil-100 px-5 py-4">
        <h2 className="font-semibold text-soil-900">All options compared</h2>
        <DemoDataBadge />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-soil-100 text-left text-xs uppercase tracking-wide text-soil-600">
              <th className="px-5 py-3">Rank</th>
              <th className="px-5 py-3">Centre</th>
              <th className="px-5 py-3">Price / quintal</th>
              <th className="px-5 py-3">Distance</th>
              <th className="px-5 py-3">Transport</th>
              <th className="px-5 py-3">Wait</th>
              <th className="px-5 py-3">Net return</th>
              <th className="px-5 py-3">Score</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option) => (
              <tr
                key={option.id}
                className={`border-b border-soil-100 last:border-0 ${
                  option.rank === 1 ? "bg-leaf-50" : ""
                }`}
              >
                <td className="px-5 py-3 font-semibold text-soil-800">#{option.rank}</td>
                <td className="px-5 py-3">
                  <div className="font-medium text-soil-900">{option.name}</div>
                  <div className="text-xs text-soil-600">
                    {option.type === "APMC" ? "APMC Mandi" : "Govt. Procurement"}
                  </div>
                </td>
                <td className="px-5 py-3">₹{option.price.toLocaleString("en-IN")}</td>
                <td className="px-5 py-3">{option.distance} km</td>
                <td className="px-5 py-3">{formatINR(option.transportCost)}</td>
                <td className="px-5 py-3">{formatWaitingTime(option.waitingMinutes)}</td>
                <td className="px-5 py-3 font-semibold text-soil-900">
                  {formatINR(option.financials.netReturn)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      option.rank === 1
                        ? "bg-leaf-600 text-white"
                        : "bg-soil-100 text-soil-800"
                    }`}
                  >
                    {option.score}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <JoinQueueButton
                    centreId={option.id}
                    centreName={option.name}
                    optionType={option.type}
                    commodityName={crop}
                    quantity={quantity}
                    location={location}
                    farmerName={farmerName}
                    compact
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
