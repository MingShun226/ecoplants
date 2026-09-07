import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { RuledEyebrow } from "@/components/brand/primitives";
import { CategoryResults } from "@/components/features/category-results";
import { RevealSection } from "@/components/features/reveal-section";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getProducts } from "@/lib/data/queries";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "plp" });
  return { title: t("allPlantsTitle"), description: t("allPlantsLead") };
}

/**
 * The shop.
 *
 * There used to be no such page. "Shop now" pointed at `/category/indoor`,
 * which meant the front door of the catalogue was a filtered view — a shopper
 * who wanted a plant for the porch landed on a list that excluded it, with
 * nothing on screen saying so.
 *
 * The categories that used to be pages are facets here, and always were
 * underneath: "indoor" is a placement, "pet-safe" a pet-safety flag,
 * "hard to kill" a difficulty. Keeping them as separate routes meant a shopper
 * who wanted pet-safe *outdoor* plants had to pick one of the two and then
 * filter down to the other, and the two lists could not be combined at all.
 * One list with facets can express every one of those, and their combinations.
 *
 * Like the category pages before it, this deliberately does not read
 * `searchParams` — that would opt the route out of static rendering, and this
 * is the page the primary navigation points at. The filter state lives in the
 * query string and is read on the client in `CategoryResults`.
 */
export default async function AllPlantsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("plp");
  const tn = await getTranslations("nav");
  const activeLocale = await getLocale();

  const all = await getProducts();

  return (
    <div className="section-y pt-8 md:pt-12">
      <div className="container-page">
        <nav
          aria-label="Breadcrumb"
          className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-text-primary">
                EcoPlants
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-text-secondary">{tn("allPlants")}</li>
          </ol>
        </nav>

        <RevealSection className="mt-6 flex max-w-2xl flex-col items-start gap-4">
          <RuledEyebrow>{tn("catalogue")}</RuledEyebrow>
          <DisplayHeading as="h1" lead={t("allPlantsTitle")} size="md" />
          <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary">
            {t("allPlantsLead")}
          </p>
        </RevealSection>

        <div className="mt-12">
          {/* `useSearchParams` suspends during prerender. Without this boundary
              Next cannot statically render the page at all and falls back to
              rendering the whole route on demand. */}
          <Suspense fallback={<div className="min-h-[60vh]" />}>
            <CategoryResults products={all} basePath={`/${activeLocale}/plants`} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
