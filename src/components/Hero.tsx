import Link from "next/link";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <div className="grid items-center gap-12 sm:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-leaf-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Smart India Hackathon 2026
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-soil-900 sm:text-5xl">
            Sell smarter.
            <br />
            <span className="text-leaf-600">Earn better.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-soil-600">
            AgriStack compares mandis and government procurement centres on price,
            transport cost, waiting time and availability — then tells you the
            option with the highest expected net benefit, not just the highest price. Join a live token queue at recommended procurement centres.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-leaf-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-700"
            >
              Find my best option
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-soil-100 px-6 py-3 text-sm font-semibold text-soil-800 transition hover:border-leaf-400"
            >
              How it works
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-soil-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-soil-600">
            Expected net benefit
          </p>
          <div className="mt-3 space-y-3">
            <BenefitRow label="Gross revenue" value="₹2,20,000" tone="neutral" />
            <BenefitRow label="Transport cost" value="− ₹6,500" tone="negative" />
            <div className="my-1 border-t border-dashed border-soil-100" />
            <BenefitRow label="Net return" value="₹2,13,500" tone="positive" bold />
          </div>
          <p className="mt-4 text-xs text-soil-600">
            Sample calculation — Lasalgaon APMC, 50 quintals of onion.
          </p>
        </div>
      </div>
    </section>
  );
}

function BenefitRow({
  label,
  value,
  tone,
  bold = false,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  bold?: boolean;
}) {
  const toneClass =
    tone === "positive" ? "text-leaf-700" : tone === "negative" ? "text-red-600" : "text-soil-800";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-soil-600">{label}</span>
      <span className={`${toneClass} ${bold ? "text-lg font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
