"use server";

import { revalidatePath } from "next/cache";
import { getSessionAdmin } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/admin/actions";
import type { LocaleCode } from "@/lib/admin/catalogue";

/**
 * Catalogue, stock, review and settings mutations.
 *
 * Split from `actions.ts` only to keep that file about orders. The rules are
 * identical: every action re-checks the session, because a server action is a
 * public HTTP endpoint and the guarded layout protects the page, not the
 * endpoint. RLS refuses the write underneath regardless.
 */

async function guard(): Promise<{ ok: false; error: string } | null> {
  const admin = await getSessionAdmin();
  return admin ? null : { ok: false, error: "Not signed in." };
}

/** Postgres messages are the useful ones; strip our own function prefix. */
function clean(message: string): string {
  return message.replace(/^.*?(adjust_stock|transition_order): /, "");
}

// --------------------------------------------------------------- products --

export async function setProductActive(productId: string, isActive: boolean): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", productId);
  if (error) return { ok: false, error: error.message };

  // The storefront prerenders products, so a deactivation that does not
  // invalidate them leaves a buyable page for something we just pulled.
  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProductFacts(
  productId: string,
  fields: {
    nameBotanical: string;
    categoryId: string | null;
    badges: string[];
  },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name_botanical: fields.nameBotanical.trim() || null,
      category_id: fields.categoryId,
      badges: fields.badges,
    })
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTranslation(
  productId: string,
  locale: LocaleCode,
  fields: {
    name: string;
    slug: string;
    tagline: string;
    description: string;
    careSummary: string;
    climateNote: string;
    toxicityNote: string;
  },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const name = fields.name.trim();
  const slug = fields.slug.trim().toLowerCase();

  if (!name) return { ok: false, error: "A name is required." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: "Slug must be lowercase words separated by single hyphens." };
  }

  const supabase = await createClient();
  const blank = (s: string) => s.trim() || null;

  // upsert, not update: a product may have no row for a locale yet, and the
  // translation screen is exactly where that gap gets filled.
  const { error } = await supabase.from("product_translations").upsert(
    {
      product_id: productId,
      locale,
      name,
      slug,
      tagline: blank(fields.tagline),
      description: blank(fields.description),
      care_summary: blank(fields.careSummary),
      climate_note: blank(fields.climateNote),
      toxicity_note: blank(fields.toxicityNote),
    },
    { onConflict: "product_id,locale" },
  );

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Another product already uses the slug "${slug}" in ${locale}.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAttributes(
  productId: string,
  fields: {
    light: string | null;
    water: string | null;
    difficulty: string | null;
    placement: string | null;
    petSafe: boolean | null;
    airPurifying: boolean | null;
    matureHeightCm: number | null;
  },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("plant_attributes").upsert(
    {
      product_id: productId,
      light: fields.light,
      water: fields.water,
      difficulty: fields.difficulty,
      placement: fields.placement,
      // Deliberately three-state. NULL means nobody has verified it, and the
      // storefront must never render that as "safe".
      pet_safe: fields.petSafe,
      air_purifying: fields.airPurifying,
      mature_height_cm: fields.matureHeightCm,
    },
    { onConflict: "product_id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateVariant(
  variantId: string,
  fields: { priceSen: number; compareAtSen: number | null },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (!Number.isInteger(fields.priceSen) || fields.priceSen < 0) {
    return { ok: false, error: "Price must be a whole number of sen, zero or more." };
  }
  if (fields.compareAtSen !== null && fields.compareAtSen <= fields.priceSen) {
    return { ok: false, error: "A “was” price has to be higher than the price being charged." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({ price_sen: fields.priceSen, compare_at_sen: fields.compareAtSen })
    .eq("id", variantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------ stock --

export async function adjustStock(
  variantId: string,
  delta: number,
  reason: string,
  note?: string,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "Enter a whole number of plants to add or remove." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    p_note: note?.trim() || null,
  });

  if (error) return { ok: false, error: clean(error.message) };

  revalidatePath("/admin/inventory");
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- reviews --

export async function setReviewApproved(reviewId: string, approved: boolean): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ is_approved: approved }).eq("id", reviewId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------- categories --

export async function updateCategoryTranslation(
  categoryId: string,
  locale: LocaleCode,
  fields: { name: string; description: string },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const name = fields.name.trim();
  if (!name) return { ok: false, error: "A name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("category_translations").upsert(
    { category_id: categoryId, locale, name, description: fields.description.trim() || null },
    { onConflict: "category_id,locale" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reorderCategory(categoryId: string, direction: "up" | "down"): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, position").order("position");
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as { id: string; position: number }[];
  const index = rows.findIndex((r) => r.id === categoryId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= rows.length) {
    return { ok: false, error: "That category is already at the end." };
  }

  // Two writes rather than a swap in one statement: `position` has no unique
  // constraint, so an intermediate collision is harmless and the pair is small
  // enough that a half-applied swap would be obvious and trivially re-run.
  const a = rows[index];
  const b = rows[swapWith];
  const first = await supabase.from("categories").update({ position: b.position }).eq("id", a.id);
  if (first.error) return { ok: false, error: first.error.message };
  const second = await supabase.from("categories").update({ position: a.position }).eq("id", b.id);
  if (second.error) return { ok: false, error: second.error.message };

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true };
}

// --------------------------------------------------------------- settings --

export async function updateSettings(fields: {
  freeShippingThresholdSen: number;
  standardShippingSen: number;
  guaranteeDays: number;
  whatsappNumber: string;
  lowStockThreshold: number;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const whole = (n: number) => Number.isInteger(n) && n >= 0;
  if (!whole(fields.freeShippingThresholdSen) || !whole(fields.standardShippingSen)) {
    return { ok: false, error: "Shipping amounts must be whole sen, zero or more." };
  }
  if (!whole(fields.guaranteeDays) || !whole(fields.lowStockThreshold)) {
    return { ok: false, error: "Guarantee days and the low-stock level must be whole numbers." };
  }
  // E.164 without the plus, which is what wa.me expects.
  if (!/^60\d{8,11}$/.test(fields.whatsappNumber.replace(/[^0-9]/g, ""))) {
    return { ok: false, error: "WhatsApp number should be Malaysian, digits only, starting 60." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_settings")
    .update({
      free_shipping_threshold_sen: fields.freeShippingThresholdSen,
      standard_shipping_sen: fields.standardShippingSen,
      guarantee_days: fields.guaranteeDays,
      whatsapp_number: fields.whatsappNumber.replace(/[^0-9]/g, ""),
      low_stock_threshold: fields.lowStockThreshold,
    })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings");
  // Shipping rules and the WhatsApp number appear on nearly every storefront
  // page, so the whole tree has to go.
  revalidatePath("/", "layout");
  return { ok: true };
}
