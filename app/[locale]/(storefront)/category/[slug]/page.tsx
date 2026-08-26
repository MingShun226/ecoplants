import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { RuledEyebrow } from "@/components/brand/primitives";
import { FilterBar } from "@/components/features/filter-bar";
import { PlantGrid } from "@/components/features/plant-card";
import { RevealSection } from "@/components/features/reveal-section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  applyFacets,
  facetCounts,
  parseFacets,
  sortProducts,
  type SortKey,
} from "@/lib/data/facets";
import { categories, getCategory, getProductsByCategory } from "@/lib/data/queries";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    categories.map((category) => ({ locale, slug: category.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  const tc = await getTranslations({ locale, namespace: "categories" });
  const tcd = await getTranslations({ locale, namespace: "categoryDescriptions" });
  return { title: tc(category.key), description: tcd(category.key) };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // params and searchParams are async in Next.js 16.
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const query = await searchParams;

  const category = getCategory(slug);
  if (!category) notFound();

  const t = await getTranslations("plp");
  const tc = await getTranslations("categories");
  const tcd = await getTranslations("categoryDescriptions");
  const tn = await getTranslations("nav");
  const ta = await getTranslations("actions");
  const ts = await getTranslations("shipping");
  const activeLocale = await getLocale();

  const selected = parseFacets(query);
  const sort = (typeof query.sort === "string" ? query.sort : "featured") as SortKey;

  const all = await getProductsByCategory(slug);
  const results = sortProducts(applyFacets(all, selected), sort);
  // Counted here rather than in the client so the numbers come from the same
  // source as the results, and cannot drift from them.
  const counts = facetCounts(all, selected);
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
            <li className="text-text-secondary">{tc(category.key)}</li>
          </ol>
        </nav>

        <RevealSection className="mt-6 flex max-w-2xl flex-col items-start gap-4">
          <RuledEyebrow>{tn("allPlants")}</RuledEyebrow>
          <DisplayHeading as="h1" lead={tc(category.key)} size="md" />
          <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary">
            {tcd(category.key)}
          </p>
        </RevealSection>

        <div className="mt-12">
          <FilterBar
            basePath={basePath}
            counts={counts}
            resultCount={results.length}
            totalCount={all.length}
          />

          {results.length > 0 ? (
            <PlantGrid products={results} className="mt-12" />
          ) : (
            <div className="mt-12 rounded-xl border border-dashed border-border-default bg-surface-sunken px-6 py-20 text-center">
              <h2 className="font-display text-xl">{t("emptyTitle")}</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
                {t("emptyBody")}
              </p>
              <Button asChild className="mt-7 px-6">
                <Link href="/quiz">{ta("takeQuiz")}</Link>
              </Button>
            </div>
          )}

          {results.some((p) => p.peninsularOnly) ? (
            <p className="mt-14 rounded-lg border border-border-subtle bg-surface-sunken p-5 text-sm leading-relaxed text-text-secondary">
              <strong className="font-medium text-text-primary">
                {t("deliveryNoteLabel")}
              </strong>{" "}
              {ts("eastMalaysia")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
