// ============================================================================
// Data-mode switch: DEMO (in-memory SIH prototype) vs SUPABASE (production).
//
// Set AGRISTACK_DATA_MODE=demo | supabase
// (NEXT_PUBLIC_AGRISTACK_DATA_MODE is mirrored for Client Components.)
//
// Default is DEMO so the SIH walkthrough works with no credentials.
// Production: AGRISTACK_DATA_MODE=supabase plus the usual Supabase env vars.
// ============================================================================

export type DataMode = "demo" | "supabase";

function readMode(): string {
  return (
    process.env.AGRISTACK_DATA_MODE ||
    process.env.NEXT_PUBLIC_AGRISTACK_DATA_MODE ||
    ""
  ).toLowerCase();
}

export function getDataMode(): DataMode {
  const explicit = readMode();
  if (explicit === "supabase") return "supabase";
  if (explicit === "demo") return "demo";

  const hasSupabase =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return hasSupabase ? "supabase" : "demo";
}

export function isDemoMode(): boolean {
  return getDataMode() === "demo";
}
