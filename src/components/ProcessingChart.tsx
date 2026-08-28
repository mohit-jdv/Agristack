"use client";

import type { ProcessingRecordPoint } from "@/lib/types";

/**
 * Lightweight SVG chart — avoids a hard dependency on recharts so the
 * project typechecks offline without installing chart libraries.
 * If recharts is available in a richer environment, this component can be
 * swapped for a Recharts line chart without changing the page contract.
 */
export function ProcessingChart({
  points,
  avgProcessingMinutes,
  currentQueueLength,
  predictedWaitMinutes,
  historyCount,
}: {
  points: ProcessingRecordPoint[];
  avgProcessingMinutes: number;
  currentQueueLength: number;
  predictedWaitMinutes: number;
  historyCount: number;
}) {
  const avgLabel = `${Math.round(avgProcessingMinutes)} min`;

  const summary = (
    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-soil-100 pt-3 text-sm sm:grid-cols-4">
      <SummaryStat
        label="Current queue"
        value={`${currentQueueLength} farmer${currentQueueLength === 1 ? "" : "s"}`}
      />
      <SummaryStat label="Average processing time" value={avgLabel} />
      <SummaryStat label="Predicted wait (new farmer)" value={`~${predictedWaitMinutes} min`} />
      <SummaryStat
        label="Estimate based on"
        value={
          historyCount > 0
            ? `${historyCount} record${historyCount === 1 ? "" : "s"}`
            : "fallback (no history)"
        }
      />
    </div>
  );

  if (historyCount === 0 || points.length === 0) {
    return (
      <div className="rounded-2xl border border-soil-100 bg-white p-6 shadow-sm">
        <div className="rounded-xl border border-dashed border-soil-100 bg-wheat-50/50 p-6 text-center text-sm font-medium text-soil-700">
          Insufficient historical data — using the default {avgLabel} processing-time
          estimate rather than fabricating a trend.
        </div>
        {summary}
      </div>
    );
  }

  const widths = 620;
  const height = 220;
  const padL = 44;
  const padR = 16;
  const padT = 20;
  const padB = 34;
  const plotW = widths - padL - padR;
  const plotH = height - padT - padB;

  const maxY = Math.max(...points.map((p) => p.durationMinutes), avgProcessingMinutes, 1);
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  const xFor = (i: number) => padL + i * stepX;
  const yFor = (v: number) => padT + plotH - (v / maxY) * plotH;

  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.durationMinutes).toFixed(1)}`
    )
    .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  // Show at most ~6 x-axis labels so the axis stays readable with many points.
  const xLabelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="rounded-2xl border border-soil-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-soil-700">
          Processing duration per completed token (minutes)
        </p>
        <div className="flex items-center gap-3 text-[11px] text-soil-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-leaf-600" /> Duration
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-wheat-500" />{" "}
            Average ({avgLabel})
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${widths} ${height}`} className="mt-2 h-56 w-full">
        {/* Y gridlines + labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              y1={yFor(t)}
              x2={widths - padR}
              y2={yFor(t)}
              stroke="#eae4d4"
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={yFor(t) + 3}
              textAnchor="end"
              fontSize="10"
              className="fill-soil-600"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Axis titles */}
        <text
          x={-(padT + plotH / 2)}
          y={12}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="10"
          className="fill-soil-600"
        >
          Minutes
        </text>
        <text
          x={padL + plotW / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          className="fill-soil-600"
        >
          Completed processing runs (oldest → most recent)
        </text>

        {/* Average reference line */}
        <line
          x1={padL}
          y1={yFor(avgProcessingMinutes)}
          x2={widths - padR}
          y2={yFor(avgProcessingMinutes)}
          stroke="#c9973a"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* Duration line + points */}
        <path d={path} fill="none" stroke="#3e7229" strokeWidth="2.5" />
        {points.map((p, i) => (
          <g key={`${p.completedAt}-${i}`}>
            <circle cx={xFor(i)} cy={yFor(p.durationMinutes)} r={4} fill="#3e7229">
              <title>
                {`#${i + 1} · ${p.durationMinutes} min · completed ${formatTime(p.completedAt)}`}
              </title>
            </circle>
            {i % xLabelEvery === 0 && (
              <text
                x={xFor(i)}
                y={height - padB + 14}
                textAnchor="middle"
                fontSize="9"
                className="fill-soil-600"
              >
                {i + 1}
              </text>
            )}
          </g>
        ))}
      </svg>

      {summary}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-soil-600">{label}</p>
      <p className="mt-0.5 text-base font-bold text-soil-900">{value}</p>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
