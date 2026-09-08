"use server";

import { revalidatePath } from "next/cache";
import { getSessionAdmin } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/admin/actions";
import type { LocaleCode } from "@/lib/admin/catalogue";
import { CATEGORY_KINDS, POT_COLOR_KEYS, POT_MATERIAL_KEYS } from "@/lib/admin/enums";

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
  fields: {
    sku: string;
    sizeKey: string;
    potColorKey: string;
    potMaterialKey: string;
    priceSen: number;
    compareAtSen: number | null;
    weightGrams: number | null;
    heightCm: number | null;
    potDiameterCm: number | null;
  },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const sku = fields.sku.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(sku)) {
    return { ok: false, error: "SKU should be 3–32 characters: letters, digits and hyphens." };
  }
  if (!fields.sizeKey.trim()) {
    return { ok: false, error: "A size is required — it is what the customer picks between." };
  }
  // The storefront renders these through a message lookup, so a key it has no
  // word for reaches a shopper as "pot_color_key" rather than as a colour.
  if (!(POT_COLOR_KEYS as readonly string[]).includes(fields.potColorKey)) {
    return { ok: false, error: "That is not a pot colour the shop knows." };
  }
  if (!(POT_MATERIAL_KEYS as readonly string[]).includes(fields.potMaterialKey)) {
    return { ok: false, error: "That is not a pot material the shop knows." };
  }
  if (!Number.isInteger(fields.priceSen) || fields.priceSen < 0) {
    return { ok: false, error: "Price must be a whole number of sen, zero or more." };
  }
  if (fields.compareAtSen !== null && fields.compareAtSen <= fields.priceSen) {
    return { ok: false, error: "A “was” price has to be higher than the price being charged." };
  }

  // Dimensions drive courier quotes and the "how big is it really" panel, so a
  // negative one is a data-entry slip rather than a meaningful value.
  for (const [label, value] of [
    ["Weight", fields.weightGrams],
    ["Height", fields.heightCm],
    ["Pot diameter", fields.potDiameterCm],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return { ok: false, error: `${label} cannot be negative.` };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({
      sku,
      size_key: fields.sizeKey.trim(),
      pot_color_key: fields.potColorKey,
      pot_material_key: fields.potMaterialKey,
      price_sen: fields.priceSen,
      compare_at_sen: fields.compareAtSen,
      weight_grams: fields.weightGrams,
      height_cm: fields.heightCm,
      pot_diameter_cm: fields.potDiameterCm,
    })
    .eq("id", variantId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Another variant already uses the SKU ${sku}.` };
    }
    return { ok: false, error: error.message };
  }
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

// --------------------------------------------------------- new arrivals --

/**
 * Mark a product as newly arrived for a number of days, or clear it.
 *
 * A date rather than a flag, so it stops being true on its own. Nobody has to
 * remember to un-tick it, which is how a New Arrivals page ends up two years
 * stale.
 */
export async function setNewArrival(productId: string, days: number | null): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
    return { ok: false, error: "Choose between 1 and 365 days." };
  }

  const until =
    days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ new_until: until })
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------ category images --

export async function uploadCategoryImage(form: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const file = form.get("file");
  const categoryId = String(form.get("categoryId") ?? "");
  const slug = String(form.get("slug") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "The limit is 5 MB — resize it first." };
  }

  const supabase = await createClient();

  // Same bucket as product photography, different prefix. One bucket means one
  // set of policies to reason about.
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `categories/${slug}/${crypto.randomUUID()}.${ext}`;

  const upload = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (upload.error) return { ok: false, error: upload.error.message };

  // Read the old path first so the replaced file can be removed after the row
  // points at the new one — never before, or a failure leaves a broken image.
  const { data: existing } = await supabase
    .from("categories")
    .select("image_path")
    .eq("id", categoryId)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .update({ image_path: path })
    .eq("id", categoryId);

  if (error) {
    await supabase.storage.from("product-images").remove([path]);
    return { ok: false, error: error.message };
  }

  const previous = (existing as { image_path: string | null } | null)?.image_path;
  if (previous) await supabase.storage.from("product-images").remove([previous]);

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeCategoryImage(categoryId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("image_path")
    .eq("id", categoryId)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .update({ image_path: null })
    .eq("id", categoryId);
  if (error) return { ok: false, error: error.message };

  const path = (data as { image_path: string | null } | null)?.image_path;
  if (path) await supabase.storage.from("product-images").remove([path]);

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------- add & drop a size --

/**
 * Add a size to a plant that already exists.
 *
 * Until this existed, the only way to get a variant was to create one in the
 * same breath as the product — so a shop that later stocked a second pot size
 * had no way to say so, and the page said as much. Creating the plant and
 * deciding what sizes it comes in are two jobs, done at different times by
 * someone holding different information.
 *
 * The dimensions and the pot get the same defaults the first variant always
 * got, and are corrected in the row this opens. Asking for weight, height and
 * pot diameter before the plant is even listed is how a form stops being
 * filled in.
 */
export async function createVariant(
  productId: string,
  input: { sizeKey: string; sku: string; priceSen: number; quantityOnHand: number },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const sku = input.sku.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(sku)) {
    return { ok: false, error: "SKU should be 3–32 characters: letters, digits and hyphens." };
  }
  if (!input.sizeKey.trim()) {
    return { ok: false, error: "A size is required — it is what the customer picks between." };
  }

  const supabase = await createClient();

  // After whatever is already there, so a new size lands at the end of the
  // picker rather than in the middle of an order somebody arranged.
  const { data: siblings } = await supabase
    .from("product_variants")
    .select("position")
    .eq("product_id", productId);

  const position =
    ((siblings ?? []) as { position: number }[]).reduce((n, r) => Math.max(n, r.position), -1) + 1;

  const { data: created, error } = await supabase
    .from("product_variants")
    .insert({
      product_id: productId,
      sku,
      size_key: input.sizeKey.trim(),
      pot_color_key: "terracotta",
      pot_material_key: "plastic",
      price_sen: input.priceSen,
      weight_grams: 1500,
      height_cm: 40,
      pot_diameter_cm: 14,
      position,
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? `The SKU ${sku} is already in use.`
        : error.message,
    };
  }

  // The inventory row is created by a trigger at zero, so opening stock is an
  // ordinary movement and the first plants to arrive appear in the audit trail
  // exactly like every delivery after them.
  const variantId = (created as { id: string }).id;
  if (input.quantityOnHand > 0) {
    const { error: stockError } = await supabase.rpc("adjust_stock", {
      p_variant_id: variantId,
      p_delta: input.quantityOnHand,
      p_reason: "received",
      p_note: "Opening stock",
    });
    if (stockError) {
      await supabase.from("product_variants").delete().eq("id", variantId);
      return { ok: false, error: clean(stockError.message) };
    }
  }

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Remove a size.
 *
 * Safe to do even after it has sold, and deliberately so: an order line
 * snapshots the price, the product name, the variant label and the SKU at the
 * moment of sale, and `order_items.variant_id` is nullable `on delete set
 * null` precisely so a discontinued size can go without rewriting what was
 * bought. The receipt keeps saying what it always said; the line simply stops
 * pointing at a row that no longer exists.
 *
 * The one refusal is the last one. A plant with no sizes cannot be bought and
 * the page says so, but walking into that while tidying up is not the same as
 * choosing it — so it takes the deliberate act of hiding the plant instead.
 */
export async function deleteVariant(variantId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("product_variants")
    .select("product_id")
    .eq("id", variantId)
    .maybeSingle();

  if (!row) return { ok: false, error: "That size no longer exists." };

  const { count } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", (row as { product_id: string }).product_id);

  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error:
        "This is the only size, and a plant with no sizes cannot be bought. " +
        "Add another first, or hide the plant from the shop.",
    };
  }

  const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------- create & delete category --

/**
 * Add a category.
 *
 * English only, and never derived. A derived collection — pet-safe, new
 * arrivals — is computed from the plants themselves by code that has to know
 * what it is computing, so one cannot be invented from a name. What this makes
 * is a category products are filed into by hand, which is the only kind a name
 * is enough to define.
 *
 * Malay and Chinese are added afterwards on the same screen, exactly as they
 * are for a plant. Until they exist the storefront falls back to English rather
 * than showing a blank chip in the navigation.
 */
export async function createCategory(
  name: string,
  kind: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const denied = await guard();
  if (denied) return denied;

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give it a name." };

  const base = slugify(trimmed);
  if (!SLUG.test(base)) {
    return { ok: false, error: "The name needs at least one letter or number in it." };
  }
  if (!(CATEGORY_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "That is not a kind the shop knows." };
  }

  const supabase = await createClient();

  // The slug is in the URL of the filtered listing, so it has to be unique.
  // Names repeat more often than anyone expects — "Gifts" twice in a year —
  // and taking the next free suffix beats refusing over a value the operator
  // never typed and cannot see.
  const { data: taken } = await supabase.from("categories").select("slug").like("slug", `${base}%`);
  const used = new Set(((taken ?? []) as { slug: string }[]).map((r) => r.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;

  // Last, so a new one lands at the end of the menu rather than in the middle
  // of an order somebody arranged.
  const { data: lastRow } = await supabase
    .from("categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((lastRow as { position: number } | null)?.position ?? 0) + 1;

  const { data: created, error } = await supabase
    .from("categories")
    .insert({ slug, kind, position, is_derived: false })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const id = (created as { id: string }).id;

  const { error: copyError } = await supabase
    .from("category_translations")
    .insert({ category_id: id, locale: "en", name: trimmed, description: "" });

  if (copyError) {
    // A category with no copy renders as its slug in the navigation. Roll the
    // row back rather than leave that in the menu.
    await supabase.from("categories").delete().eq("id", id);
    return { ok: false, error: copyError.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true, id };
}

/**
 * Remove a category, but never one holding plants.
 *
 * The row's own deletes cascade — its copy goes with it — but `products.
 * category_id` does not, and should not: deleting a category that holds
 * products either orphans them or takes them off the shop, and neither is
 * something to do behind a confirm dialog. So it is refused, and the message
 * says how many and where to move them.
 *
 * A derived collection has nothing filed into it and is always removable. What
 * goes with it is the filter itself — the shop stops offering "pet-safe" as a
 * way to browse — which is the shop owner's call to make.
 */
export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (countError) return { ok: false, error: countError.message };

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        `${count} ${count === 1 ? "plant is" : "plants are"} filed under this category. ` +
        "Move them to another one first — open each plant and change its category under Classification.",
    };
  }

  const { data: existing } = await supabase
    .from("categories")
    .select("image_path")
    .eq("id", categoryId)
    .maybeSingle();

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return { ok: false, error: error.message };

  // After the row, never before: a failed delete that had already removed the
  // artwork leaves a category pointing at nothing.
  const path = (existing as { image_path: string | null } | null)?.image_path;
  if (path) await supabase.storage.from("product-images").remove([path]);

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true };
}

// -------------------------------------------------------- create & delete --

/** Mirrors the database's own slug check, so a bad value is refused with a sentence. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export interface NewProductInput {
  categoryId: string;
  name: string;
  slug: string;
}

/**
 * Add a product.
 *
 * It arrives hidden, always. A plant needs photographs, three translations,
 * care attributes and a price before it is fit to sell, and none of that can be
 * true at the instant the row is created — so publishing stays a separate,
 * deliberate act on the detail page rather than a side effect of typing a name.
 *
 * Only the fields with no sensible default are asked for. Sizes, Malay and
 * Chinese copy, the care attributes and badges are all added afterwards on a
 * screen built for it. A create form that asks for everything is a form nobody
 * finishes.
 *
 * Sizes in particular. This used to create the first one here, on the
 * reasoning that a product with no variant cannot be bought — true, and it put
 * a SKU, a price and a stock count in front of someone whose next act is to go
 * and photograph the plant. It arrives with no sizes and says so, which is the
 * same information without the form.
 *
 * PostgREST has no multi-table transaction, so these inserts run in dependency
 * order and the product is rolled back by hand if a later one fails. A
 * half-made product is worse than none: invisible in the shop, but holding its
 * ref, so the next attempt collides with something nobody can see.
 *
 * The ref is derived from the name here rather than typed. Nobody outside the
 * admin ever sees it, so the create form does not ask; two plants sharing a
 * name take the first free suffix instead of refusing the create over a value
 * the operator has no field to correct. The botanical name is not asked for
 * either — it starts as the English name and is corrected afterwards.
 */
export async function createProduct(
  input: NewProductInput,
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const denied = await guard();
  if (denied) return denied;

  const base = slugify(input.name);
  const slug = slugify(input.slug || input.name);
  const name = input.name.trim();

  if (!name) return { ok: false, error: "Give it a name." };
  if (!SLUG.test(base)) {
    return { ok: false, error: "The name needs at least one letter or number in it." };
  }
  if (!SLUG.test(slug)) {
    return { ok: false, error: "The web address needs to be lowercase letters, numbers and hyphens." };
  }
  if (!input.categoryId) return { ok: false, error: "Choose a category." };

  const supabase = await createClient();

  // Membership of a derived category follows from the plant's own facts —
  // `new_until` for New arrivals, the care attributes for Pet-safe and
  // Beginner. Filing a product into one directly puts it somewhere no shopper
  // browses, and it would then be missing from the category it belongs in.
  const { data: category } = await supabase
    .from("categories")
    .select("is_derived")
    .eq("id", input.categoryId)
    .maybeSingle();

  if (!category) return { ok: false, error: "That category no longer exists." };
  if ((category as { is_derived: boolean }).is_derived) {
    return { ok: false, error: "That category fills itself from the plants in it. Pick another." };
  }

  // Names repeat — two pot sizes of the same plant, a restock under a tidier
  // name. Take the first suffix nothing holds rather than refuse the create.
  const { data: siblings } = await supabase
    .from("products")
    .select("ref")
    .like("ref", `${base}%`);

  const taken = new Set(((siblings ?? []) as { ref: string }[]).map((r) => r.ref));
  let ref = base;
  for (let n = 2; taken.has(ref); n += 1) ref = `${base}-${n}`;

  const { data: created, error: productError } = await supabase
    .from("products")
    .insert({
      ref,
      // Not asked for at create time. The column is required, so it starts as
      // the English name and is corrected on the detail page beside the
      // translations — the screen where someone has the plant's papers to hand.
      name_botanical: name,
      category_id: input.categoryId,
      is_active: false,
    })
    .select("id, ref")
    .single();

  if (productError) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(productError.message)
        ? "Something else was saved under that name a moment ago. Try again."
        : productError.message,
    };
  }

  const product = created as { id: string; ref: string };

  /** Undo the product row, so a failed create leaves no ref behind. */
  const rollback = async (error: string) => {
    await supabase.from("products").delete().eq("id", product.id);
    return { ok: false as const, error };
  };

  // English only. It is the source locale the storefront falls back to, so a
  // product with just this row renders correctly in all three languages.
  const translation = await supabase.from("product_translations").insert({
    product_id: product.id,
    locale: "en",
    name,
    slug,
  });
  if (translation.error) {
    return rollback(
      /duplicate|unique/i.test(translation.error.message)
        ? `Another plant already lives at /plants/${slug}.`
        : translation.error.message,
    );
  }

  // Middle-of-the-road care, so the filters and the quiz have something to work
  // with before anyone opens the attributes panel. Pet safety stays null —
  // "not verified", which the storefront never renders as safe.
  const attributes = await supabase.from("plant_attributes").insert({
    product_id: product.id,
    light: "bright-indirect",
    water: "when-dry",
    pet_safe: null,
    difficulty: "easy",
    mature_height_cm: 60,
    placement: "indoor",
  });
  if (attributes.error) return rollback(attributes.error.message);

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true, ref: product.ref };
}

/**
 * Delete a product outright — but only one that has never been sold.
 *
 * Everything belonging to a product cascades away with it, including its
 * `stock_movements`, which is the account of what was received, damaged and
 * died. For a plant nobody ever bought, that history is worth nothing. For one
 * that appears on somebody's order it is the only record of stock that money
 * changed hands over, and no panel button should be able to erase it.
 *
 * So a sold product is refused and pointed at "Hide from shop", which takes it
 * off the storefront and leaves the record intact. That is what an archive is
 * for, and it already exists.
 *
 * Storage does not cascade. The image rows go with the product, so their files
 * are removed first — after the rows are gone nothing names them, and they
 * become litter no one can find.
 */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  const variantIds = ((variants ?? []) as { id: string }[]).map((v) => v.id);

  if (variantIds.length > 0) {
    const { count, error } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .in("variant_id", variantIds);

    if (error) return { ok: false, error: error.message };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          `This plant is on ${count} order line${count === 1 ? "" : "s"}, so deleting it would take ` +
          `the stock history with it. Hide it from the shop instead — it leaves the catalogue and ` +
          `the record survives.`,
      };
    }
  }

  // Bytes first, while the rows that name them still exist.
  const { data: images } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  const paths = ((images ?? []) as { storage_path: string }[]).map((i) => i.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from("product-images").remove(paths);
  }

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}
