import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client for Server Components, Route Handlers and Server Actions.
 *
 * Two rules that are easy to get wrong and expensive to get wrong:
 *
 *  1. **Always `getUser()`, never `getSession()`** in server code. `getSession`
 *     reads a cookie that the client can forge and does not revalidate the
 *     token; `getUser` verifies it against the auth server.
 *  2. Server Components cannot write cookies. The `setAll` below is a no-op
 *     there by design — the refreshed token is written by `proxy.ts`, which is
 *     the only place that can. Swallowing the error is correct, not lazy.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // proxy.ts refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
