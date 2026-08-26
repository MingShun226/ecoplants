import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Anonymous client for public catalogue reads.
 *
 * Deliberately NOT the cookie-bound server client. Calling `cookies()` opts the
 * whole route out of static rendering, and the catalogue is the same for
 * everyone — turning 42 prerendered product pages into 42 per-request renders
 * to read data that carries no session would be a strange trade.
 *
 * RLS still applies: this connects as `anon`, which can read active products
 * and nothing else. The key is public by design.
 */
// Annotated rather than inferred: `ReturnType<typeof createClient>` resolves
// the generic parameters to their defaults, which narrows `rpc()` arguments to
// `never` and makes every stored-procedure call a type error.
let cached: SupabaseClient | null = null;

export function createPublicClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "createPublicClient: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "Copy them into .env.local — see README.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
