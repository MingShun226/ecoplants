import { cache } from "react";

import type { Locale } from "@/i18n/routing";
import { createPublicClient } from "@/lib/supabase/public";
import { routing } from "@/i18n/routing";
import type {
  BadgeKey,
  Category,
  Product,
  ProductImage,
  ProductTranslation,
  Variant,
} from "@/types/catalog";

/**
 * The data-access boundary. Every catalogue read goes through this module.
 *
 * Reads run as `anon` against RLS, which grants SELECT on active products and
 * nothing else — so a bug here cannot expose more than the storefront already
 * shows.
 *
 * These functions are async now that they hit Postgres. Everything above this
 * module still works in the same shapes: `Product`, `Category`, and the same
 * function names.
 *
 * Faceting and related-product scoring still happen in TypeScript. For fourteen
 * plants that is the right call — the facet counts need the whole category set
 * in memory anyway. Push them into SQL when the catalogue reaches the hundreds;
 * `plant_attributes` is already indexed on every facet column for that day.
 */

/** One row of the nested select below, before it is folded into a `Product`. */
interface ProductRow {
  ref: string;
  name_botanical: string;
  badges: string[] | null;
  rating: number | null;
  review_count: number;
  new_until: string | null;
  peninsular_only: boolean;
  categories: { slug: string } | null;
  product_translations: {
    locale: Locale;
    name: string;
    slug: string;
    tagline: string;
    description: string;
    care_summary: string;
    climate_note: string | null;
    toxicity_note: string | null;
  }[];
  plant_attributes: {
    light: Product["attributes"]["light"];
    water: Product["attributes"]["water"];
    pet_safe: boolean | null;
    difficulty: Product["attributes"]["difficulty"];
    mature_height_cm: number;
    placement: Product["attributes"]["placement"];
    air_purifying: boolean;
  } | null;
  product_variants: {
    id: string;
    sku: string;
    size_key: string;
    pot_color_key: string;
    pot_material_key: string;
    price_sen: number;
    compare_at_sen: number | null;
    weight_grams: number;
    height_cm: number;
    pot_diameter_cm: number;
    position: number;
    inventory: { quantity_on_hand: number; reserved: number } | null;
  }[];
  product_images: {
    storage_path: string;
    kind: ProductImage["kind"];
    position: number;
    is_primary: boolean;
    product_image_translations: { locale: Locale; alt: string }[];
  }[];
}

/**
 * Storage path to a public URL.
 *
 * The bucket is public read (migration 0027), so this is a plain CDN URL — no
 * signed request per image, which is what lets Next/Image cache and transform
 * them at the edge.
 */
function imageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/product-images/${storagePath}`;
}

function toImage(
  row: ProductRow["product_images"][number],
  locale: Locale,
  fallbackAlt: string,
): ProductImage {
  // Alt text is per-locale and optional. A missing one falls back to the
  // product's own name rather than to an empty string — a screen reader
  // announcing nothing is worse than announcing the plant.
  const alt =
    row.product_image_translations.find((t) => t.locale === locale)?.alt ??
    row.product_image_translations[0]?.alt ??
    fallbackAlt;

  return { src: imageUrl(row.storage_path), alt, kind: row.kind };
}

/**
 * One nested select rather than five round trips. PostgREST resolves the
 * embedded resources through the foreign keys, so this is a single query.
 */
const PRODUCT_SELECT = `
  ref,
  name_botanical,
  badges,
  rating,
  review_count,
  new_until,
  peninsular_only,
  categories!inner ( slug ),
  product_translations ( locale, name, slug, tagline, description, care_summary, climate_note, toxicity_note ),
  plant_attributes ( light, water, pet_safe, difficulty, mature_height_cm, placement, air_purifying ),
  product_variants ( id, sku, size_key, pot_color_key, pot_material_key, price_sen, compare_at_sen, weight_grams, height_cm, pot_diameter_cm, position, inventory ( quantity_on_hand, reserved ) ),
  product_images ( storage_path, kind, position, is_primary, product_image_translations ( locale, alt ) )
`;

function toTranslation(row: ProductRow["product_translations"][number]): ProductTranslation {
  return {
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    description: row.description,
    careSummary: row.care_summary,
    climateNote: row.climate_note ?? undefined,
    toxicityNote: row.toxicity_note ?? undefined,
  };
}

function toVariant(row: ProductRow["product_variants"][number]): Variant {
  const onHand = row.inventory?.quantity_on_hand ?? 0;
  const reserved = row.inventory?.reserved ?? 0;
  return {
    id: row.id,
    sku: row.sku,
    sizeKey: row.size_key,
    potColorKey: row.pot_color_key,
    potMaterialKey: row.pot_material_key,
    priceSen: row.price_sen,
    compareAtSen: row.compare_at_sen ?? undefined,
    // What the storefront may actually sell: on hand minus what checkouts in
    // flight are holding. Showing on-hand alone oversells.
    quantityOnHand: Math.max(0, onHand - reserved),
    weightGrams: row.weight_grams,
    heightCm: row.height_cm,
    potDiameterCm: row.pot_diameter_cm,
  };
}

function mapProduct(row: ProductRow): Product | null {
  // A product with no attributes row or no English translation is malformed,
  // not something to render half of.
  if (!row.plant_attributes) return null;

  const byLocale = Object.fromEntries(
    row.product_translations.map((t) => [t.locale, toTranslation(t)]),
  ) as Partial<Record<Locale, ProductTranslation>>;

  const fallback = byLocale.en;
  if (!fallback) return null;

  const t = Object.fromEntries(
    routing.locales.map((locale) => [locale, byLocale[locale] ?? fallback]),
  ) as Record<Locale, ProductTranslation>;

  const a = row.plant_attributes;

  return {
    // `ref` rather than the uuid: it is stable, human-readable in a URL or a
    // log, and it seeds the placeholder artwork so a plant always draws the
    // same way.
    id: row.ref,
    nameBotanical: row.name_botanical,
    categorySlug: row.categories?.slug ?? "indoor",
    badges: (row.badges ?? []) as BadgeKey[],
    attributes: {
      light: a.light,
      water: a.water,
      petSafe: a.pet_safe,
      difficulty: a.difficulty,
      matureHeightCm: a.mature_height_cm,
      placement: a.placement,
      airPurifying: a.air_purifying,
    },
    variants: [...row.product_variants]
      .sort((x, y) => x.position - y.position)
      .map(toVariant),
    // Primary first, then by position. PlantImage picks by kind and falls back
    // to the first — so the primary is what a card shows.
    images: [...(row.product_images ?? [])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
      .map((image) => toImage(image, "en", fallback.name)),
    newUntil: row.new_until,
    isNew: row.new_until !== null && new Date(row.new_until).getTime() > Date.now(),
    // Null, not 0. A product nobody has reviewed has no score; zero is the
    // worst possible one.
    rating: row.rating === null ? null : Number(row.rating),
    reviewCount: row.review_count,
    peninsularOnly: row.peninsular_only,
    isActive: true,
    t,
  };
}

async function fetchProducts(): Promise<Product[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("review_count", { ascending: false });

  if (error) {
    // Failing loudly beats rendering an empty shop that looks like it works.
    throw new Error(`Failed to load catalogue: ${error.message}`);
  }

  return ((data ?? []) as unknown as ProductRow[])
    .map(mapProduct)
    .filter((p): p is Product => p !== null);
}

/**
 * Deduped per render pass, not per process.
 *
 * The header, the hero and three sections of the home page all want the
 * catalogue; `cache` collapses that into one query. A module-level promise would
 * also do that — and would then pin stock levels for the lifetime of the server
 * process, so "only 3 left" would still say 3 long after they sold. React clears
 * this between requests, which is the behaviour stock needs.
 */
export const getProducts = cache(fetchProducts);

export async function getProductBySlug(
  slug: string,
  locale: Locale,
): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.t[locale].slug === slug);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(0, limit);
}

/**
 * Categories are static structure, not content — the slugs are baked into the
 * routes and the message keys. Their display copy lives in messages/*.json and
 * in `category_translations`; this list is the shape.
 */
export const categories: Category[] = [
  { id: "cat-new", slug: "new", key: "newArrivals", type: "plants" },
  { id: "cat-indoor", slug: "indoor", key: "indoor", type: "plants" },
  { id: "cat-outdoor", slug: "outdoor", key: "outdoor", type: "plants" },
  { id: "cat-pet-safe", slug: "pet-safe", key: "petSafe", type: "plants" },
  { id: "cat-beginner", slug: "beginner", key: "beginner", type: "plants" },
  { id: "cat-pots", slug: "pots", key: "pots", type: "pots" },
  { id: "cat-care", slug: "care", key: "care", type: "care" },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

/**
 * `pet-safe` and `beginner` are attribute-derived collections rather than
 * stored memberships — `categories.is_derived` marks them in the database for
 * the same reason.
 */
export async function getProductsByCategory(slug: string): Promise<Product[]> {
  const all = await getProducts();
  // Newest first — a "new arrivals" list ordered any other way is just a list.
  if (slug === "new") {
    return all
      .filter((p) => p.isNew)
      .sort((a, b) => new Date(b.newUntil!).getTime() - new Date(a.newUntil!).getTime());
  }
  if (slug === "pet-safe") return all.filter((p) => p.attributes.petSafe === true);
  if (slug === "beginner") return all.filter((p) => p.attributes.difficulty === "beginner");
  if (slug === "indoor") return all.filter((p) => p.attributes.placement !== "outdoor");
  if (slug === "outdoor") return all.filter((p) => p.attributes.placement !== "indoor");
  return all.filter((p) => p.categorySlug === slug);
}

export async function getRelated(product: Product, limit = 4): Promise<Product[]> {
  const score = (p: Product) =>
    (p.attributes.light === product.attributes.light ? 2 : 0) +
    (p.attributes.petSafe === product.attributes.petSafe ? 1 : 0) +
    (p.attributes.difficulty === product.attributes.difficulty ? 1 : 0);

  const all = await getProducts();
  return all
    .filter((p) => p.id !== product.id)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

/**
 * Full-text search against the `search_doc` tsvector, with a trigram fallback
 * so a typo still finds the plant. Both indexes exist; see migration 0006.
 *
 * Matching spans every locale's row, not just the active one — shoppers search
 * across languages ("monstera", "lidah jin", "虎尾兰") whichever locale they
 * happen to be browsing in. That is why there is no `locale` parameter: it
 * would only ever narrow the result set incorrectly.
 *
 * Currently unused: the header search runs client-side over a pre-built index,
 * which is right for fourteen plants. This is the seam for the day the
 * catalogue outgrows shipping it to the browser.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("product_translations")
    .select("product_id, products!inner ( ref )")
    .textSearch("search_doc", q, { type: "websearch", config: "simple" });

  let refs: string[] = [];

  if (!error && data && data.length > 0) {
    refs = (data as unknown as { products: { ref: string } | null }[])
      .map((row) => row.products?.ref)
      .filter((ref): ref is string => Boolean(ref));
  } else {
    // Nothing matched the tsvector — fall back to trigram similarity, which is
    // what turns "lidah gin" into "Pokok Lidah Jin".
    const { data: fuzzy } = await supabase
      .from("product_translations")
      .select("products!inner ( ref )")
      .ilike("name", `%${q}%`);

    refs = ((fuzzy ?? []) as unknown as { products: { ref: string } | null }[])
      .map((row) => row.products?.ref)
      .filter((ref): ref is string => Boolean(ref));
  }

  if (refs.length === 0) return [];

  const unique = new Set(refs);
  const all = await getProducts();
  // Preserve the catalogue's own ordering rather than the match order — a
  // relevance sort over fourteen plants is noise.
  return all.filter((p) => unique.has(p.id));
}
