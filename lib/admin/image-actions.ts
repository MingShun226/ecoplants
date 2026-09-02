"use server";

import { revalidatePath } from "next/cache";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/admin/enums";
import { getSessionAdmin } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/admin/actions";

/**
 * Product photography.
 *
 * Two things have to stay in step: the bytes in the `product-images` bucket and
 * the `product_images` row that gives them meaning — which product, which
 * variant, what kind of shot, what order. Storage does not cascade, so deleting
 * a row without deleting the object leaves an orphan nobody will ever find, and
 * deleting the object without the row leaves a broken image on the storefront.
 * Every action here does both, in the order that fails safe.
 *
 * Uploads go through the signed-in admin's own session, so the storage policies
 * from migration 0027 apply exactly as the table policies do elsewhere. No
 * service_role key (ADR 0006).
 */

const BUCKET = "product-images";

/** Matches the bucket's own limits, so a bad file is refused before upload. */
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];


export type ImageKind = "catalog" | "lifestyle" | "detail" | "scale";

async function guard() {
  const admin = await getSessionAdmin();
  return admin ? null : ({ ok: false, error: "Not signed in." } as const);
}

export async function uploadProductImage(form: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const file = form.get("file");
  const productId = String(form.get("productId") ?? "");
  const productRef = String(form.get("productRef") ?? "");
  const variantId = String(form.get("variantId") ?? "") || null;
  const kind = (String(form.get("kind") ?? "catalog") || "catalog") as ImageKind;

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB — resize it first.`,
    };
  }

  const supabase = await createClient();

  // Counted before the bytes are sent anywhere, so a refused upload leaves
  // nothing behind in the bucket to clean up.
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  if ((count ?? 0) >= MAX_IMAGES_PER_PRODUCT) {
    return {
      ok: false,
      error: `This product already has ${MAX_IMAGES_PER_PRODUCT} photos. Delete one before adding another.`,
    };
  }

  // Grouped by product ref so the bucket stays legible in the dashboard, and
  // suffixed randomly so re-uploading the same filename never collides or
  // silently overwrites a photo that is already live.
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `products/${productRef}/${crypto.randomUUID()}.${ext}`;

  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (upload.error) return { ok: false, error: upload.error.message };

  // Position after whatever is already there.
  const { data: siblings } = await supabase
    .from("product_images")
    .select("position, is_primary")
    .eq("product_id", productId);

  const rows = (siblings ?? []) as { position: number; is_primary: boolean }[];
  const nextPosition = rows.reduce((n, r) => Math.max(n, r.position), -1) + 1;
  const isFirst = rows.length === 0;

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    variant_id: variantId,
    storage_path: path,
    kind,
    position: nextPosition,
    // The first photo a product ever gets becomes its card image, because a
    // product with photos and no primary would show none.
    is_primary: isFirst,
  });

  if (error) {
    // The row is the thing that makes the object findable. Without it the
    // upload is litter, so it goes back.
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: image } = await supabase
    .from("product_images")
    .select("id, product_id, storage_path, is_primary")
    .eq("id", imageId)
    .maybeSingle();

  if (!image) return { ok: false, error: "That image is already gone." };
  const row = image as { id: string; product_id: string; storage_path: string; is_primary: boolean };

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return { ok: false, error: error.message };

  // Row first, then bytes. If this half fails the storefront is already
  // correct and the leftover object is invisible, which is the harmless way
  // round to fail.
  await supabase.storage.from(BUCKET).remove([row.storage_path]);

  // Removing the primary would leave a product with photos and no card image.
  if (row.is_primary) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", row.product_id)
      .order("position")
      .limit(1)
      .maybeSingle();

    if (next) {
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", (next as { id: string }).id);
    }
  }

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The gallery order, written whole.
 *
 * Position and "is this the cover" used to be able to disagree: the storefront
 * sorted the primary to the front regardless of its position, so moving the
 * second photo ahead of the first appeared to do nothing. There is only one
 * order now — the one on screen — and the photo at the front of it is the
 * cover. That makes "first" and "cover" the same fact instead of two facts that
 * can contradict each other.
 *
 * A partial unique index allows one primary per product, so every primary is
 * cleared before the new one is set. Positions carry no such constraint, which
 * is why they can be rewritten in place without a temporary shuffle.
 */
async function writeOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const cleared = await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .eq("is_primary", true);
  if (cleared.error) return { ok: false, error: cleared.error.message };

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("product_images")
      .update({ position: index })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  if (orderedIds.length > 0) {
    const { error } = await supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", orderedIds[0]);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The current order, as both the panel and the shop display it. */
async function currentOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("product_images")
    .select("id, position, is_primary")
    .eq("product_id", productId);

  return ((data ?? []) as { id: string; position: number; is_primary: boolean }[])
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
    .map((r) => r.id);
}

export async function setPrimaryImage(imageId: string, productId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const order = await currentOrder(supabase, productId);
  if (!order.includes(imageId)) return { ok: false, error: "That image is already gone." };

  // Making a photo the cover moves it to the front, because the cover is the
  // front. Leaving it where it was is what let the two disagree.
  return writeOrder(supabase, productId, [imageId, ...order.filter((id) => id !== imageId)]);
}

/** Nudge one photo one place through the gallery. */
export async function moveProductImage(
  imageId: string,
  productId: string,
  direction: "back" | "forward",
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const order = await currentOrder(supabase, productId);

  const index = order.indexOf(imageId);
  const swapWith = direction === "back" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= order.length) {
    return { ok: false, error: "That photo is already at the end." };
  }

  const next = [...order];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return writeOrder(supabase, productId, next);
}

export async function updateImageMeta(
  imageId: string,
  fields: { kind: ImageKind; variantId: string | null; alt: string },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();

  const { error } = await supabase
    .from("product_images")
    .update({ kind: fields.kind, variant_id: fields.variantId })
    .eq("id", imageId);
  if (error) return { ok: false, error: error.message };

  const alt = fields.alt.trim();
  if (alt) {
    // English only for now: alt text is the one piece of copy where a wrong
    // translation is worse than none, and the storefront falls back to the
    // product name for locales that have none.
    const t = await supabase
      .from("product_image_translations")
      .upsert({ image_id: imageId, locale: "en", alt }, { onConflict: "image_id,locale" });
    if (t.error) return { ok: false, error: t.error.message };
  } else {
    await supabase
      .from("product_image_translations")
      .delete()
      .eq("image_id", imageId)
      .eq("locale", "en");
  }

  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}
