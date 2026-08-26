"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Use this in Client Components only.
 *
 * Mixing this with the server client is the classic App Router mistake — the
 * server client reads cookies through `next/headers` and throws
 * "localStorage is not defined" the moment it runs in a browser, and this one
 * silently has no session on the server.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
