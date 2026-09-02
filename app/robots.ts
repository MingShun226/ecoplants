import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site-url";

/**
 * robots.txt, generated per deployment rather than written by hand.
 *
 * The per-page `robots` metadata in the locale layout already tells crawlers
 * not to index previews, but that only helps once a page has been fetched and
 * parsed. This stops the crawl at the door, which matters because Vercel
 * preview URLs are public: left open they get indexed and compete with the live
 * site for the same content.
 *
 * `/admin` and `/checkout` are disallowed on production too. Neither is secret —
 * the panel is behind auth and RLS — but neither belongs in a search index, and
 * a crawler walking checkout is just noise in the logs.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  if (!isIndexable()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/checkout", "/account", "/order/", "/pay/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.host,
  };
}
