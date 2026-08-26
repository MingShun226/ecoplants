/**
 * Where this deployment thinks it lives.
 *
 * `metadataBase` turns every relative canonical, hreflang alternate and OG
 * image into an absolute URL. Hardcoding the production domain means a preview
 * deployment publishes canonicals pointing at a site that may not exist yet, and
 * OG cards that fetch images from it — so a link shared from a preview renders
 * blank, and search engines are told the real page is somewhere else.
 *
 * Resolution order, most explicit first:
 *
 *  1. `NEXT_PUBLIC_SITE_URL` — set this to the real domain once it resolves.
 *     Nothing else overrides it, so on Vercel scope it to the **Production**
 *     environment only. Set for all environments, it would make every preview
 *     claim the live domain again.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL`, **only when `VERCEL_ENV` is production**
 *     — the stable domain, so production is right before a custom domain is
 *     attached. Vercel sets this variable on previews too, which is why the
 *     environment has to be checked alongside it.
 *  3. `VERCEL_URL` — the per-deployment URL. Previews become self-referential,
 *     which is what makes an OG card work when someone shares a preview link.
 *  4. `http://localhost:3000` for local work.
 *
 * These are read server-side, so the Vercel ones do not need a `NEXT_PUBLIC_`
 * prefix. Only `NEXT_PUBLIC_SITE_URL` does, and only because it is the one a
 * human sets by hand and might reasonably expect to reach the browser.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    // Tolerate a bare host — someone will paste `ecoplants.my` sooner or later.
    return new URL(explicit.startsWith("http") ? explicit : `https://${explicit}`);
  }

  // Vercel sets VERCEL_PROJECT_PRODUCTION_URL on *every* deployment, previews
  // included, so it can only be trusted once we know this is production.
  // Reading it first made previews claim the production domain — the exact
  // thing this function exists to prevent.
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  // Previews: self-referential, so a shared preview link renders its own OG
  // card instead of fetching one from a site that may not be live.
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);

  return new URL("http://localhost:3000");
}

/**
 * Only the real production deployment should be indexable.
 *
 * Vercel preview URLs are public and, left alone, get crawled — which competes
 * with the live site for the same content and is a well-worn way to lose
 * ranking to your own staging environment.
 */
export function isIndexable(): boolean {
  // Not on Vercel at all (local, or self-hosted): trust the explicit setting.
  if (!process.env.VERCEL_ENV) return Boolean(process.env.NEXT_PUBLIC_SITE_URL);
  return process.env.VERCEL_ENV === "production";
}
