import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { RuledEyebrow } from "@/components/brand/primitives";
import { CategoryResults } from "@/components/features/category-results";
import { RevealSection } from "@/components/features/reveal-section";
import { Link } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";
import { categoryHref } from "@/lib/data/facets";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/data/queries";

/**
 * Prerendered per locale, from whatever the table holds at build time.
 *
 * A category created in the panel after a build has no entry here, and is
 * rendered on demand instead — which is correct rather than a gap: the route
 * still resolves, it just is not baked.
 */
export async function generateStaticParams() {
  const all = await Promise.all(
    routing.locales.map(async (locale) => {
      const cats = await getCategories(locale);
      return cats.map((category) => ({ locale, slug: category.slug }));
    }),
  );
  return all.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategory(slug, locale as Locale);
  if (!category) return {};
  const tcd = await getTranslations({ locale, namespace: "categoryDescriptions" });
  return { title: category.name, description: tcd.has(category.slug) ? tcd(category.slug) : "" };
}

/**
 * Deliberately does not read `searchParams`.
 *
 * Reading it — even once, even for a default — opts the whole route out of
 * static rendering, and these are the pages the primary navigation points at.
 * The filter state lives in the query string exactly as before; it is read in
 * `CategoryResults` on the client instead, so this page prerenders to a file
 * and a filter click costs no round trip.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const category = await getCategory(slug, locale as Locale);
  if (!category) notFound();

  /*
   * The plant categories are facets now.
   *
   * Each was a filtered catalogue wearing a route — "indoor" is a placement,
   * "pet-safe" a pet-safety flag, "hard to kill" a difficulty — so splitting
   * them across pages meant the combinations could not be expressed at all, and
   * it made `/category/indoor` the de facto front door of the shop: "Shop now"
   * opened a list with the garden plants already excluded and nothing on screen
   * saying so.
   *
   * The pages are gone; the URLs are not. They are in Google, in order emails
   * and in whatever a customer bookmarked, so each lands on the same plants it
   * always did. A 308 rather than a 302, because they are not coming back and
   * the ranking should move to the listing rather than split between two URLs
   * showing the same thing.
   *
   * Pots and soil are not plants and have no facet to land on, so they keep a
   * listing of their own — which is what the rest of this page still renders.
   */
  if (category.type === "plants") permanentRedirect(`/${locale}${categoryHref(slug)}`);
  const tcd = await getTranslations("categoryDescriptions");
  const tn = await getTranslations("nav");
  const activeLocale = await getLocale();

  const all = await getProductsByCategory(slug);
  const basePath = `/${activeLocale}/category/${slug}`;

  return (
    <div className="section-y pt-8 md:pt-12">
      <div className="container-page">
        <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-text-primary">
                EcoPlants
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-text-secondary">{category.name}</li>
          </ol>
        </nav>

        <RevealSection className="mt-6 flex max-w-2xl flex-col items-start gap-4">
          <RuledEyebrow>{tn("allPlants")}</RuledEyebrow>
          <DisplayHeading as="h1" lead={category.name} size="md" />
          <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary">
            {tcd.has(category.slug) ? tcd(category.slug) : ""}
          </p>
        </RevealSection>

        <div className="mt-12">
          {/* `useSearchParams` suspends during prerender. Without this boundary
              Next cannot statically render the page at all and falls back to
              rendering the whole route on demand — which is the thing being
              fixed here. */}
          <Suspense fallback={<div className="min-h-[60vh]" />}>
            <CategoryResults products={all} basePath={basePath} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
