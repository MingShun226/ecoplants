import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { categories, getProducts } from "@/lib/data/queries";
import { isIndexable, siteUrl } from "@/lib/site-url";

/**
 * The sitemap.
 *
 * Every public page exists in three locales, and the three are translations of
 * each other rather than separate pages — so each entry carries `alternates.
 * languages`, which is the sitemap equivalent of the hreflang tags the layout
 * already emits. Without it a crawler can read the Malay and Chinese versions
 * as thin duplicates of the English one.
 *
 * Product slugs are per-locale (`plants/snake-plant` vs its Malay slug), so the
 * alternates are built from each product's own translations rather than by
 * swapping the locale prefix on one slug.
 *
 * Empty on a preview deployment. A sitemap is an invitation to crawl, and the
 * one thing a preview must not do is invite that.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return [];

  const base = siteUrl();
  const abs = (path: string) => new URL(path, base).toString();

  /** One entry per page, with its siblings listed as language alternates. */
  const entry = (
    pathFor: (locale: string) => string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap[number] => ({
    url: abs(pathFor(routing.defaultLocale)),
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, abs(pathFor(locale))]),
      ),
    },
  });

  const staticPages: MetadataRoute.Sitemap = [
    entry((l) => `/${l}`, 1, "weekly"),
    entry((l) => `/${l}/quiz`, 0.7, "monthly"),
    entry((l) => `/${l}/guarantee`, 0.5, "yearly"),
  ];

  const categoryPages = categories.map((category) =>
    entry((l) => `/${l}/category/${category.slug}`, 0.8, "weekly"),
  );

  const products = await getProducts();
  const productPages = products.map((product) =>
    entry((l) => `/${l}/plants/${product.t[l as keyof typeof product.t].slug}`, 0.9, "weekly"),
  );

  return [...staticPages, ...categoryPages, ...productPages];
}
