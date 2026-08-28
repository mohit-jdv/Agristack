// ============================================================================
// Browser/client-side Supabase client.
// Uses ONLY the public anon key — safe to ship to the browser. This client
// can never see or use the service-role key (see ./server.ts for that).
// RLS policies (supabase/migrations/0002_row_level_security.sql) are what
// actually keep this client read-only and public-data-only, not this file.
// ============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Returns a singleton Supabase client for use in Client Components.
 * Returns null (rather than throwing) when env vars aren't configured, so
 * the app can fall back to demo data instead of crashing — see
 * lib/data/*.ts for how callers use this.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient<Database>(url, anonKey);
  }
  return browserClient;
}
