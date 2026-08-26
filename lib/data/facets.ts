import type { Difficulty, LightLevel, Product, WaterFrequency } from "@/types/catalog";

/**
 * Facet definitions.
 *
 * Labels are message keys, never literals — the PLP renders in three locales
 * and a hard-coded English facet label is the fastest way to break that.
 */

export const lightKeys: Record<LightLevel, string> = {
  low: "lightLow",
  medium: "lightMedium",
  "bright-indirect": "lightBrightIndirect",
  "direct-sun": "lightDirectSun",
};

export const lightDetailKeys: Record<LightLevel, string> = {
  low: "lightLowDetail",
  medium: "lightMediumDetail",
  "bright-indirect": "lightBrightIndirectDetail",
  "direct-sun": "lightDirectSunDetail",
};

export const waterKeys: Record<WaterFrequency, string> = {
  weekly: "waterWeekly",
  fortnightly: "waterFortnightly",
  "when-dry": "waterWhenDry",
  "keep-moist": "waterKeepMoist",
};

export const waterDetailKeys: Record<WaterFrequency, string> = {
  weekly: "waterWeeklyDetail",
  fortnightly: "waterFortnightlyDetail",
  "when-dry": "waterWhenDryDetail",
  "keep-moist": "waterKeepMoistDetail",
};

export const difficultyKeys: Record<Difficulty, string> = {
  beginner: "difficultyBeginner",
  easy: "difficultyEasy",
  moderate: "difficultyModerate",
  expert: "difficultyExpert",
};

/** 1–4, drives the leaf meter on the PDP. */
export const difficultyLevel: Record<Difficulty, number> = {
  beginner: 1,
  easy: 2,
  moderate: 3,
  expert: 4,
};

export type FacetKey = "light" | "difficulty" | "petSafe" | "placement" | "size";

export interface FacetGroup {
  key: FacetKey;
  /** Short query-string key — keeps shareable URLs readable. */
  param: string;
  /** Message key in the `facets` namespace. */
  labelKey: string;
  options: { value: string; labelKey: string; ns: "attributes" | "facets" }[];
}

export const facetGroups: FacetGroup[] = [
  {
    key: "light",
    param: "light",
    labelKey: "light",
    options: [
      { value: "low", labelKey: "lightLow", ns: "attributes" },
      { value: "medium", labelKey: "lightMedium", ns: "attributes" },
      { value: "bright-indirect", labelKey: "lightBrightIndirect", ns: "attributes" },
      { value: "direct-sun", labelKey: "lightDirectSun", ns: "attributes" },
    ],
  },
  {
    key: "difficulty",
    param: "care",
    labelKey: "care",
    options: [
      { value: "beginner", labelKey: "difficultyBeginner", ns: "attributes" },
      { value: "easy", labelKey: "difficultyEasy", ns: "attributes" },
      { value: "moderate", labelKey: "difficultyModerate", ns: "attributes" },
      { value: "expert", labelKey: "difficultyExpert", ns: "attributes" },
    ],
  },
  {
    key: "petSafe",
    param: "pets",
    labelKey: "pets",
    options: [{ value: "safe", labelKey: "petSafeOnly", ns: "facets" }],
  },
  {
    key: "placement",
    param: "where",
    labelKey: "where",
    options: [
      { value: "indoor", labelKey: "placementIndoor", ns: "attributes" },
      { value: "outdoor", labelKey: "placementOutdoor", ns: "attributes" },
    ],
  },
  {
    key: "size",
    param: "size",
    labelKey: "size",
    options: [
      { value: "desk", labelKey: "sizeDesk", ns: "facets" },
      { value: "floor", labelKey: "sizeFloor", ns: "facets" },
      { value: "statement", labelKey: "sizeStatement", ns: "facets" },
    ],
  },
];

export type SelectedFacets = Partial<Record<string, string[]>>;

/** Reads facet selections out of a Next.js searchParams object. */
export function parseFacets(
  searchParams: Record<string, string | string[] | undefined>,
): SelectedFacets {
  const selected: SelectedFacets = {};
  for (const group of facetGroups) {
    const raw = searchParams[group.param];
    if (!raw) continue;
    const values = Array.isArray(raw) ? raw : raw.split(",");
    const valid = values.filter((v) => group.options.some((o) => o.value === v));
    if (valid.length) selected[group.param] = valid;
  }
  return selected;
}

export function sizeBucket(cm: number): string {
  if (cm < 50) return "desk";
  if (cm <= 150) return "floor";
  return "statement";
}

/**
 * Within a group, options are OR-ed (two light levels = either is fine). Across
 * groups they are AND-ed. This is the behaviour shoppers expect and the same
 * logic the Postgres query will need to reproduce.
 */
export function applyFacets(items: Product[], selected: SelectedFacets): Product[] {
  return items.filter((p) => {
    for (const group of facetGroups) {
      const chosen = selected[group.param];
      if (!chosen?.length) continue;

      const matches = chosen.some((value) => {
        switch (group.key) {
          case "light":
            return p.attributes.light === value;
          case "difficulty":
            return p.attributes.difficulty === value;
          case "petSafe":
            return p.attributes.petSafe === true;
          case "placement":
            return p.attributes.placement === value || p.attributes.placement === "both";
          case "size":
            return sizeBucket(p.attributes.matureHeightCm) === value;
          default:
            return true;
        }
      });

      if (!matches) return false;
    }
    return true;
  });
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "rating";

export const sortOptions: { value: SortKey; labelKey: string }[] = [
  { value: "featured", labelKey: "sortFeatured" },
  { value: "price-asc", labelKey: "sortPriceAsc" },
  { value: "price-desc", labelKey: "sortPriceDesc" },
  { value: "rating", labelKey: "sortRating" },
];

export function sortProducts(items: Product[], sort: SortKey): Product[] {
  const from = (p: Product) => Math.min(...p.variants.map((v) => v.priceSen));
  const copy = [...items];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => from(a) - from(b));
    case "price-desc":
      return copy.sort((a, b) => from(b) - from(a));
    case "rating":
      // An unrated plant sorts last rather than as a zero — it has not scored
      // badly, nobody has scored it. With no reviews anywhere this sort falls
      // through to the review count and leaves the order untouched, which is
      // the honest outcome.
      return copy.sort(
        (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount,
      );
    default:
      return copy.sort((a, b) => b.reviewCount - a.reviewCount);
  }
}

export type FacetCounts = Record<string, Record<string, number>>;

/**
 * How many results each option would yield if it were the only change.
 *
 * Counted against every *other* group's current selection, not against the full
 * catalogue and not against the current result set. That is the standard
 * faceted-search contract, and it is the only version that is useful: it tells
 * you what clicking this option will actually get you, so a dead end is visible
 * before you click it rather than after.
 */
export function facetCounts(items: Product[], selected: SelectedFacets): FacetCounts {
  const counts: FacetCounts = {};

  for (const group of facetGroups) {
    // Everything the shopper has chosen except this group.
    const others: SelectedFacets = { ...selected };
    delete others[group.param];
    const base = applyFacets(items, others);

    counts[group.param] = {};
    for (const option of group.options) {
      counts[group.param][option.value] = applyFacets(base, {
        [group.param]: [option.value],
      }).length;
    }
  }

  return counts;
}

/** Total number of individual options currently selected. */
export function countSelected(selected: SelectedFacets): number {
  return facetGroups.reduce(
    (total, group) => total + (selected[group.param]?.length ?? 0),
    0,
  );
}
