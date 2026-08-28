// ============================================================================
// Server-only Supabase clients.
// This file must NEVER be imported from a Client Component ("use client").
// Two clients are exported for two different trust levels:
//
//   getSupabaseServerReadClient() — anon key, used by the data-access layer
//     (lib/data/*.ts) for ordinary public reads (markets, prices, ...) from
//     Server Components. Subject to the same RLS "public read" policies as
//     the browser client.
//
//   getSupabaseServiceRoleClient() — service-role key, bypasses RLS. Reserved
//     for trusted, server-only operations (seed/admin scripts, the future
//     queue-data ingestion job). Throws loudly if it's ever evaluated in a
//     browser bundle, as a defense-in-depth check on top of Next.js already
//     stripping non-NEXT_PUBLIC_ env vars from client bundles.
// ============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "lib/supabase/server.ts was imported into browser code. This must only run server-side."
    );
  }
}

let serverReadClient: SupabaseClient<Database> | null = null;

/** Public-read client for the data-access layer. Returns null if unconfigured. */
export function getSupabaseServerReadClient(): SupabaseClient<Database> | null {
  assertServerOnly();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Missing Supabase URL or service role key");
    return null;
  }

  if (!serverReadClient) {
    serverReadClient = createClient<Database>(
      url,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );
  }

  return serverReadClient;
}

let serviceRoleClient: SupabaseClient<Database> | null = null;

/** Privileged client. Never call this from anything reachable by the browser. */
export function getSupabaseServiceRoleClient(): SupabaseClient<Database> | null {
  assertServerOnly();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (!serviceRoleClient) {
    serviceRoleClient = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return serviceRoleClient;
}
