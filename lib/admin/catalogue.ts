import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Catalogue reads for the admin panel.
 *
 * Separate from `lib/data/queries.ts` on purpose. That module is the
 * storefront's boundary: it reads as `anon`, sees only active products, and
 * shapes everything for display. This one reads through the admin's session,
 * sees drafts and deactivated rows, and returns the catalogue as it actually
 * is — including the things a shopper must never see.
 */

// The vocabulary lives in a client-safe module so the forms can import it
// without dragging this file — and its database client — into the browser.
import type {
  CareDifficulty,
  CategoryKind,
  LightLevel,
  LocaleCode,
  PlantPlacement,
  WaterFrequency,
} from "@/lib/admin/enums";
import { LOCALES } from "@/lib/admin/enums";

export type {
  CareDifficulty,
  CategoryKind,
  LightLevel,
  LocaleCode,
  PlantPlacement,
  WaterFrequency,
} from "@/lib/admin/enums";
export { DIFFICULTIES, LIGHT_LEVELS, LOCALES, PLACEMENTS, WATER_FREQUENCIES } from "@/lib/admin/enums";

export interface ProductTranslation {
  locale: LocaleCode;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  careSummary: string | null;
  climateNote: string | null;
  toxicityNote: string | null;
}

export interface VariantRow {
  id: string;
  sku: string;
  sizeKey: string;
  potColorKey: string | null;
  potMaterialKey: string | null;
  priceSen: number;
  compareAtSen: number | null;
  weightGrams: number | null;
  heightCm: number | null;
  potDiameterCm: number | null;
  position: number;
  onHand: number;
  reserved: number;
}

export interface ProductImageRow {
  id: string;
  src: string;
  storagePath: string;
  kind: "catalog" | "lifestyle" | "detail" | "scale";
  variantId: string | null;
  position: number;
  isPrimary: boolean;
  alt: string;
}

export interface ProductSummary {
  id: string;
  ref: string;
  nameBotanical: string | null;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  badges: string[];
  rating: number | null;
  reviewCount: number;
  variantCount: number;
  priceFromSen: number | null;
  onHand: number;
  /** Locales with a translation row. Anything short of three is a gap. */
  locales: LocaleCode[];
}

export interface PlantAttributes {
  light: LightLevel | null;
  water: WaterFrequency | null;
  petSafe: boolean | null;
  difficulty: CareDifficulty | null;
  matureHeightCm: number | null;
  placement: PlantPlacement | null;
  airPurifying: boolean | null;
}

export interface ProductDetail extends ProductSummary {
  peninsularOnly: boolean;
  translations: ProductTranslation[];
  variants: VariantRow[];
  images: ProductImageRow[];
  attributes: PlantAttributes | null;
}

/** The bucket is public read (0027), so this is a plain CDN URL. */
function imageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/product-images/${storagePath}`;
}

const LIST_SELECT = `
  id, ref, name_botanical, category_id, badges, rating, review_count, is_active,
  product_translations ( locale, name ),
  product_variants ( id, price_sen, inventory ( quantity_on_hand ) )
`;

interface ListRow {
  id: string;
  ref: string;
  name_botanical: string | null;
  category_id: string | null;
  badges: string[] | null;
  rating: number | null;
  review_count: number | null;
  is_active: boolean;
  product_translations: { locale: LocaleCode; name: string }[];
  product_variants: {
    id: string;
    price_sen: number;
    inventory: { quantity_on_hand: number } | { quantity_on_hand: number }[] | null;
  }[];
}

/** PostgREST returns a to-one embed as an object, but types it loosely. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * The detail row. Declared standalone rather than as an intersection with
 * ListRow: intersecting keeps the list row's narrow `product_translations` and
 * `product_variants` on the shared keys, so the extra columns stay invisible to
 * the type checker even though PostgREST returns them.
 */
interface DetailRow extends Omit<ListRow, "product_translations" | "product_variants"> {
  peninsular_only: boolean;
  product_translations: {
    locale: LocaleCode;
    name: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    care_summary: string | null;
    climate_note: string | null;
    toxicity_note: string | null;
  }[];
  product_variants: {
    id: string;
    sku: string;
    size_key: string;
    pot_color_key: string | null;
    pot_material_key: string | null;
    price_sen: number;
    compare_at_sen: number | null;
    weight_grams: number | null;
    height_cm: number | null;
    pot_diameter_cm: number | null;
    position: number;
    inventory:
      | { quantity_on_hand: number; reserved: number }
      | { quantity_on_hand: number; reserved: number }[]
      | null;
  }[];
  product_images: {
    id: string;
    storage_path: string;
    kind: ProductImageRow["kind"];
    variant_id: string | null;
    position: number;
    is_primary: boolean;
    product_image_translations: { locale: LocaleCode; alt: string }[];
  }[];
  plant_attributes: Record<string, unknown> | Record<string, unknown>[] | null;
}

function toSummary(row: ListRow, categoryNames: Map<string, string>): ProductSummary {
  const locales = row.product_translations.map((t) => t.locale);
  const prices = row.product_variants.map((v) => v.price_sen).filter((n) => Number.isFinite(n));

  return {
    id: row.id,
    ref: row.ref,
    nameBotanical: row.name_botanical,
    // English is the source language, so it is the panel's label. A product
    // with no English row at all is broken, and showing the ref says so.
    name: row.product_translations.find((t) => t.locale === "en")?.name ?? row.ref,
    categoryId: row.category_id,
    categoryName: row.category_id ? (categoryNames.get(row.category_id) ?? null) : null,
    isActive: row.is_active,
    badges: row.badges ?? [],
    rating: row.rating,
    reviewCount: row.review_count ?? 0,
    variantCount: row.product_variants.length,
    priceFromSen: prices.length ? Math.min(...prices) : null,
    onHand: row.product_variants.reduce(
      (n, v) => n + (one(v.inventory)?.quantity_on_hand ?? 0),
      0,
    ),
    locales,
  };
}

async function categoryNameMap(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("category_translations")
    .select("category_id, name")
    .eq("locale", "en");

  return new Map(((data ?? []) as { category_id: string; name: string }[]).map((r) => [r.category_id, r.name]));
}

export async function listProducts(options: {
  search?: string;
  categoryId?: string;
  state?: "all" | "active" | "inactive" | "untranslated";
} = {}): Promise<ProductSummary[]> {
  const supabase = await createClient();

  let query = supabase.from("products").select(LIST_SELECT).order("ref").limit(500);

  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.state === "active") query = query.eq("is_active", true);
  if (options.state === "inactive") query = query.eq("is_active", false);

  const { data, error } = await query;
  if (error) throw new Error(`listProducts: ${error.message}`);

  const names = await categoryNameMap();
  let rows = ((data ?? []) as unknown as ListRow[]).map((r) => toSummary(r, names));

  // Searching and the translation-gap filter run here rather than in the query:
  // both need the translation rows already joined, and fourteen products is not
  // a set worth a second round trip to narrow.
  const search = options.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.ref.toLowerCase().includes(search) ||
        (p.nameBotanical ?? "").toLowerCase().includes(search),
    );
  }
  if (options.state === "untranslated") {
    rows = rows.filter((p) => p.locales.length < LOCALES.length);
  }

  return rows;
}

export async function getProduct(ref: string): Promise<ProductDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id, ref, name_botanical, category_id, badges, rating, review_count,
      is_active, peninsular_only,
      product_translations ( locale, name, slug, tagline, description, care_summary, climate_note, toxicity_note ),
      product_variants ( id, sku, size_key, pot_color_key, pot_material_key, price_sen, compare_at_sen, weight_grams, height_cm, pot_diameter_cm, position, inventory ( quantity_on_hand, reserved ) ),
      product_images ( id, storage_path, kind, variant_id, position, is_primary, product_image_translations ( locale, alt ) ),
      plant_attributes ( light, water, pet_safe, difficulty, mature_height_cm, placement, air_purifying )
    `)
    .eq("ref", ref)
    .maybeSingle();

  if (error) throw new Error(`getProduct: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;

  const names = await categoryNameMap();
  const attrs = one(row.plant_attributes);

  return {
    ...toSummary(row as unknown as ListRow, names),
    peninsularOnly: row.peninsular_only,
    translations: row.product_translations
      .map((t) => ({
        locale: t.locale,
        name: t.name,
        slug: t.slug,
        tagline: t.tagline,
        description: t.description,
        careSummary: t.care_summary,
        climateNote: t.climate_note,
        toxicityNote: t.toxicity_note,
      }))
      .sort((a, b) => LOCALES.indexOf(a.locale) - LOCALES.indexOf(b.locale)),
    variants: row.product_variants
      .map((v) => {
        const inv = one(v.inventory);
        return {
          id: v.id,
          sku: v.sku,
          sizeKey: v.size_key,
          potColorKey: v.pot_color_key,
          potMaterialKey: v.pot_material_key,
          priceSen: v.price_sen,
          compareAtSen: v.compare_at_sen,
          weightGrams: v.weight_grams,
          heightCm: v.height_cm,
          potDiameterCm: v.pot_diameter_cm,
          position: v.position,
          onHand: inv?.quantity_on_hand ?? 0,
          reserved: inv?.reserved ?? 0,
        };
      })
      .sort((a, b) => a.position - b.position),
    // Primary first: it is the card image, so it should be the one an operator
    // sees at the top of the strip.
    images: [...(row.product_images ?? [])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
      .map((img) => ({
        id: img.id,
        src: imageUrl(img.storage_path),
        storagePath: img.storage_path,
        kind: img.kind,
        variantId: img.variant_id,
        position: img.position,
        isPrimary: img.is_primary,
        alt: img.product_image_translations.find((t) => t.locale === "en")?.alt ?? "",
      })),
    attributes: attrs
      ? {
          light: (attrs.light as LightLevel) ?? null,
          water: (attrs.water as WaterFrequency) ?? null,
          petSafe: (attrs.pet_safe as boolean | null) ?? null,
          difficulty: (attrs.difficulty as CareDifficulty) ?? null,
          matureHeightCm: (attrs.mature_height_cm as number | null) ?? null,
          placement: (attrs.placement as PlantPlacement) ?? null,
          airPurifying: (attrs.air_purifying as boolean | null) ?? null,
        }
      : null,
  };
}

// ------------------------------------------------------------- categories --

export interface CategoryRow {
  id: string;
  slug: string;
  kind: CategoryKind;
  position: number;
  isDerived: boolean;
  productCount: number;
  translations: { locale: LocaleCode; name: string; description: string | null }[];
  name: string;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();

  const [{ data: cats, error }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, kind, position, is_derived, category_translations ( locale, name, description )")
      .order("position"),
    supabase.from("products").select("category_id"),
  ]);

  if (error) throw new Error(`listCategories: ${error.message}`);

  const counts = new Map<string, number>();
  for (const p of (products ?? []) as { category_id: string | null }[]) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }

  return ((cats ?? []) as unknown as {
    id: string;
    slug: string;
    kind: CategoryKind;
    position: number;
    is_derived: boolean;
    category_translations: { locale: LocaleCode; name: string; description: string | null }[];
  }[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    kind: c.kind,
    position: c.position,
    isDerived: c.is_derived,
    // A derived category ("pet safe") is computed from attributes, so it has no
    // rows pointing at it and a count of zero would read as broken.
    productCount: c.is_derived ? -1 : (counts.get(c.id) ?? 0),
    translations: c.category_translations.sort(
      (a, b) => LOCALES.indexOf(a.locale) - LOCALES.indexOf(b.locale),
    ),
    name: c.category_translations.find((t) => t.locale === "en")?.name ?? c.slug,
  }));
}
