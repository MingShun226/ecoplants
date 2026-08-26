import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. **Bypasses RLS entirely.**
 *
 * Only for server-side work that RLS deliberately forbids: admin catalogue
 * writes, stock reservation, and payment webhooks. Never import this into
 * anything that reaches the browser — the `server-only` import above turns that
 * into a build error rather than a silent key leak.
 *
 * A leaked service_role key is a total database compromise, which is why it has
 * no NEXT_PUBLIC_ prefix and is read lazily: importing this module must not
 * crash a build that has no admin env configured.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
