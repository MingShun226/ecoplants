import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Next.js 16 replaces `middleware.ts` with `proxy.ts`. This runs on every
 * matched request and stays deliberately thin: locale negotiation, plus the
 * Supabase session cookie refresh.
 *
 * The refresh has to happen here and nowhere else. Server Components cannot
 * write cookies, so an access token that expires mid-session would leave the
 * user silently signed out on their next navigation — the single most common
 * bug in this stack. The `getUser()` call below is what triggers the rotation:
 * it looks redundant and is not.
 *
 * No authorisation decisions belong here. Route guards go in the layouts, where
 * they can read roles, with RLS backing them independently.
 */
const intl = createMiddleware(routing);

/** `/en/admin/orders` -> `/admin/orders`, for any locale. */
const LOCALE_PREFIXED_ADMIN = new RegExp(
  "^/(?:" + routing.locales.join("|") + ")(/admin(?:/.*)?)$",
);

/** `/en/account`, for any locale. */
const ACCOUNT = new RegExp("^/(" + routing.locales.join("|") + ")/account(?:/.*)?$");

export default async function proxy(request: NextRequest) {
  // The panel lives outside [locale], so `/en/admin` matches no route and fell
  // through to the root 404. It is the obvious thing to type when every other
  // URL on the site carries a locale, so it redirects to the real address
  // rather than punishing the guess. Permanent: the locale-prefixed form is
  // never correct for the panel.
  const misprefixed = request.nextUrl.pathname.match(LOCALE_PREFIXED_ADMIN);
  if (misprefixed) {
    const target = new URL(misprefixed[1], request.url);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  const response = intl(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // The storefront renders fine without auth configured, so a missing env is a
  // no-op rather than a 500 on every route.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Send a signed-out visitor to the login page *here*, before the account
  // route renders anything.
  //
  // This is not the guard — `/account` still checks the session itself, and RLS
  // refuses the data regardless. It is here because the guard alone produces a
  // visible defect: the page has to render the storefront layout before it can
  // throw its redirect, so clicking the header's account icon flashed a header
  // and footer wrapped around an empty page. The header links to `/account`
  // unconditionally on purpose — reading the session there would opt all 42
  // prerendered product pages out of static rendering (ADR 0008) — so the
  // short-circuit belongs at the edge instead.
  if (!user) {
    const account = request.nextUrl.pathname.match(ACCOUNT);
    if (account) {
      return NextResponse.redirect(new URL(`/${account[1]}/login`, request.url));
    }
  }

  return response;
}

export const config = {
  // `admin` is excluded deliberately: the panel is English-only and lives
  // outside the [locale] segment, so it must not be locale-negotiated. See
  // ADR 0006. Locale-prefixed admin paths (`/en/admin`) are NOT excluded —
  // they match this pattern and are redirected above.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
