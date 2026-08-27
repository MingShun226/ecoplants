import type { Locale } from "@/i18n/routing";

/**
 * Domain types for the storefront.
 *
 * These mirror the Supabase tables planned in docs/research/blueprint.md §3.3
 * so swapping the mock data layer (lib/data/*) for real queries is mechanical.
 *
 * Translations live in side tables keyed by locale rather than inline on the
 * product — the same shape the Postgres schema will use. A JSONB blob per row
 * cannot be indexed for per-locale slug lookup or full-text search.
 *
 * MONEY IS ALWAYS INTEGER SEN. 1 MYR = 100 sen. Never floats — see
 * docs/decisions/0002-money-as-integer-sen.md.
 */

export type LightLevel = "low" | "medium" | "bright-indirect" | "direct-sun";
export type WaterFrequency = "weekly" | "fortnightly" | "when-dry" | "keep-moist";
export type Difficulty = "beginner" | "easy" | "moderate" | "expert";
export type Placement = "indoor" | "outdoor" | "both";

/** Badge identifiers. Rendered through the `badges` message namespace so a
 *  badge is never a hard-coded English string in the data. */
export type BadgeKey =
  | "bestSeller"
  | "fastGrower"
  | "hardToKill"
  | "lowLight"
  | "statement"
  | "native"
  | "deskSize"
  | "hanging"
  | "fullSun"
  | "flowering"
  | "fragrant"
  | "easy";

/** plant_attributes — the facet source */
export interface PlantAttributes {
  light: LightLevel;
  water: WaterFrequency;
  /** ASPCA-referenced. `null` = not yet verified; never render as "safe". */
  petSafe: boolean | null;
  difficulty: Difficulty;
  matureHeightCm: number;
  placement: Placement;
  airPurifying: boolean;
}

/** product_variants + inventory */
export interface Variant {
  id: string;
  sku: string;
  /** Message key in the `sizes` namespace — "Small", "Hanging", "On moss pole". */
  sizeKey: string;
  /** Message key in the `potColors` namespace. */
  potColorKey: string;
  /** Message key in the `potMaterials` namespace. */
  potMaterialKey: string;
  /** Integer sen. */
  priceSen: number;
  /** Integer sen. Optional was-price for markdowns. */
  compareAtSen?: number;
  quantityOnHand: number;
  weightGrams: number;
  heightCm: number;
  potDiameterCm: number;
}

export interface ProductImage {
  src: string;
  alt: string;
  kind: "catalog" | "lifestyle" | "detail" | "scale";
}

/** product_translations — one row per (product, locale) */
export interface ProductTranslation {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  careSummary: string;
  /** Framed for Malaysia's tropical climate — never US/EU hardiness zones. */
  climateNote?: string;
  /** Only present where petSafe === false. */
  toxicityNote?: string;
}

/** The structural record — everything that does not change with locale. */
export interface ProductBase {
  id: string;
  nameBotanical: string;
  categorySlug: string;
  badges: BadgeKey[];
  attributes: PlantAttributes;
  variants: Variant[];
  images: ProductImage[];
  /**
   * While this is in the future the plant is a new arrival. A date, not a flag,
   * so it expires without anyone remembering to clear it.
   */
  newUntil: string | null;
  /**
   * `newUntil` resolved against the clock, **on the server**.
   *
   * Comparing to `Date.now()` inside a client component would give the server
   * render and the hydration one clock each, and a plant expiring between them
   * would mismatch. Resolved once here, both sides agree by construction.
   */
  isNew: boolean;
  /** Null until a product has at least one approved review. Never invented. */
  rating: number | null;
  reviewCount: number;
  /** Live plants that cannot survive 7–8 day transit to Sabah/Sarawak. */
  peninsularOnly: boolean;
  isActive: boolean;
}

/** A product joined with its full translation set. */
export interface Product extends ProductBase {
  t: Record<Locale, ProductTranslation>;
}

/** Cheapest variant, used for the "from RM x" price on listing cards. */
export function fromPriceSen(product: ProductBase): number {
  return Math.min(...product.variants.map((v) => v.priceSen));
}

export function topPriceSen(product: ProductBase): number {
  return Math.max(...product.variants.map((v) => v.priceSen));
}

export function inStock(product: ProductBase): boolean {
  return product.variants.some((v) => v.quantityOnHand > 0);
}

export function totalStock(product: ProductBase): number {
  return product.variants.reduce((sum, v) => sum + v.quantityOnHand, 0);
}

export interface Category {
  id: string;
  slug: string;
  /** Message key in the `categories` namespace. */
  key: string;
  type: "plants" | "pots" | "care" | "gifts";
}
