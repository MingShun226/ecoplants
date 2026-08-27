"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { FilterBar } from "@/components/features/filter-bar";
import { PlantGrid } from "@/components/features/plant-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  applyFacets,
  facetCounts,
  facetGroups,
  parseFacets,
  sortProducts,
  type SortKey,
} from "@/lib/data/facets";
import type { Product } from "@/types/catalog";

/**
 * Filtering, sorting and counting for a category listing — on the client.
 *
 * This used to happen on the server, which meant the page read `searchParams`,
 * which opts a route out of static rendering entirely. Every category view was
 * then rendered on demand: a function cold start, a round trip to Postgres, and
 * the full pipeline again for every filter click. Against a database in another
 * region that is most of a second before anything paints, and the category
 * pages are where the primary navigation points.
 *
 * The whole catalogue is fourteen plants. Shipping a category's slice to the
 * browser costs a few kilobytes once, and buys back a fully static page plus
 * filtering that applies without a network round trip at all.
 *
 * `FilterBar` still writes only to the query string, so a filtered listing
 * stays shareable, backable and bookmarkable. The difference is who reads it.
 */
export function CategoryResults({
  products,
  basePath,
}: {
  products: Product[];
  basePath: string;
}) {
  const t = useTranslations("plp");
  const ta = useTranslations("actions");
  const ts = useTranslations("shipping");
  const searchParams = useSearchParams();

  // `parseFacets` takes the server's `searchParams` shape, where a repeated key
  // arrives as an array. `getAll` reproduces that faithfully rather than
  // silently keeping only the first value of a multi-select facet.
  const query = useMemo(() => {
    const record: Record<string, string | string[] | undefined> = {};
    for (const group of facetGroups) {
      const values = searchParams.getAll(group.param);
      if (values.length) record[group.param] = values.length > 1 ? values : values[0];
    }
    const sort = searchParams.get("sort");
    if (sort) record.sort = sort;
    return record;
  }, [searchParams]);

  const { results, counts } = useMemo(() => {
    const selected = parseFacets(query);
    const sort = (typeof query.sort === "string" ? query.sort : "featured") as SortKey;
    return {
      results: sortProducts(applyFacets(products, selected), sort),
      // Counted from the same list the results come from, so the numbers on the
      // filter chips cannot drift from what the grid actually shows.
      counts: facetCounts(products, selected),
    };
  }, [products, query]);

  return (
    <>
      <FilterBar
        basePath={basePath}
        counts={counts}
        resultCount={results.length}
        totalCount={products.length}
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
          <strong className="font-medium text-text-primary">{t("deliveryNoteLabel")}</strong>{" "}
          {ts("eastMalaysia")}
        </p>
      ) : null}
    </>
  );
}
