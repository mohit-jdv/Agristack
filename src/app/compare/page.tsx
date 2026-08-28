import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ComparisonTable } from "@/components/ComparisonTable";
import { RecommendationCard } from "@/components/RecommendationCard";
import { getSellingOptions } from "@/lib/data/markets";
import { generateRecommendation } from "@/lib/recommendation-engine";
import type { CropDetails } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ComparePageProps {
  searchParams: { crop?: string; quantity?: string; location?: string; name?: string };
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const crop = searchParams.crop?.trim() || "Onion";
  const quantity = Number(searchParams.quantity);
  const location = searchParams.location?.trim() || "Nashik, Maharashtra";
  const farmerName = searchParams.name?.trim() || "";

  const validQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 50;

  const cropDetails: CropDetails = { crop, quantity: validQuantity, location };
  const sellingOptions = await getSellingOptions(crop);
  const result = generateRecommendation(cropDetails, sellingOptions);

  return (
    <main>
      <Navbar />
      <div className="mx-auto max-w-4xl px-6 py-14">
        <Link href="/dashboard" className="text-sm font-medium text-leaf-700 hover:underline">
          ← Back to dashboard
        </Link>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-soil-900">
          Best option for {cropDetails.quantity} quintals of {cropDetails.crop}
        </h1>
        <p className="mt-1 text-soil-600">
          {farmerName ? (
            <>
              Welcome {farmerName} · selling from {cropDetails.location}.
            </>
          ) : (
            <>Selling from {cropDetails.location}.</>
          )}
        </p>

        <div className="mt-4 rounded-xl border border-wheat-200 bg-wheat-50 px-4 py-3 text-sm text-soil-700">
          Market and procurement figures below are <strong>sample data</strong> for this
          prototype (Nashik-area mandis). Real-time e-NAM and government procurement
          data will replace these values in a later milestone.
        </div>

        <div className="mt-8 space-y-8">
          <RecommendationCard result={result} farmerName={farmerName} />
          <ComparisonTable
            options={result.rankedOptions}
            quantity={cropDetails.quantity}
            crop={cropDetails.crop}
            location={cropDetails.location}
            farmerName={farmerName}
          />
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-soil-100 bg-white p-6 text-center">
          <p className="text-sm font-medium text-soil-800">
            Want to ask why, or explore &quot;what if I had more quintals&quot;?
          </p>
          <p className="mt-1 text-xs text-soil-600">
            The AgriStack AI Assistant arrives in the next milestone.
          </p>
        </div>
      </div>
    </main>
  );
}
