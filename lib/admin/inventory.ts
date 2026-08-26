import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Stock reads for the admin panel.
 *
 * `available` is what the storefront will sell: on hand minus what checkouts in
 * flight have reserved. Every screen here shows all three numbers, because the
 * difference between them is exactly what someone is trying to understand when
 * they open this page.
 */

export interface StockRow {
  variantId: string;
  sku: string;
  sizeKey: string;
  productRef: string;
  productName: string;
  priceSen: number;
  onHand: number;
  reserved: number;
  available: number;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  delta: number;
  quantityAfter: number;
  reason: string;
  note: string | null;
  actorName: string;
  createdAt: string;
}

export { ADJUST_REASONS } from "@/lib/admin/enums";
export type { AdjustReason } from "@/lib/admin/enums";

interface StockQueryRow {
  id: string;
  sku: string;
  size_key: string;
  price_sen: number;
  products: { ref: string; is_active: boolean; product_translations: { name: string }[] } | null;
  inventory: { quantity_on_hand: number; reserved: number } | { quantity_on_hand: number; reserved: number }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function listStock(options: {
  search?: string;
  view?: "all" | "low" | "out" | "reserved";
  lowStockThreshold?: number;
} = {}): Promise<StockRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select(`
      id, sku, size_key, price_sen,
      products!inner ( ref, is_active, product_translations!inner ( name ) ),
      inventory ( quantity_on_hand, reserved )
    `)
    .eq("products.product_translations.locale", "en")
    .order("sku")
    .limit(500);

  if (error) throw new Error(`listStock: ${error.message}`);

  let rows: StockRow[] = ((data ?? []) as unknown as StockQueryRow[]).map((v) => {
    const inv = one(v.inventory);
    const onHand = inv?.quantity_on_hand ?? 0;
    const reserved = inv?.reserved ?? 0;
    return {
      variantId: v.id,
      sku: v.sku,
      sizeKey: v.size_key,
      productRef: v.products?.ref ?? "",
      productName: v.products?.product_translations?.[0]?.name ?? v.sku,
      priceSen: v.price_sen,
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
      isActive: v.products?.is_active ?? false,
    };
  });

  const threshold = options.lowStockThreshold ?? 5;
  if (options.view === "low") rows = rows.filter((r) => r.available > 0 && r.available <= threshold);
  if (options.view === "out") rows = rows.filter((r) => r.available === 0);
  if (options.view === "reserved") rows = rows.filter((r) => r.reserved > 0);

  const search = options.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (r) => r.sku.toLowerCase().includes(search) || r.productName.toLowerCase().includes(search),
    );
  }

  return rows;
}

export async function listMovements(options: { variantId?: string; limit?: number } = {}): Promise<StockMovement[]> {
  const supabase = await createClient();

  let query = supabase
    .from("stock_movements")
    .select(`
      id, variant_id, delta, quantity_after, reason, note, actor_name, created_at,
      product_variants!inner ( sku, products!inner ( product_translations!inner ( name ) ) )
    `)
    .eq("product_variants.products.product_translations.locale", "en")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.variantId) query = query.eq("variant_id", options.variantId);

  const { data, error } = await query;
  if (error) throw new Error(`listMovements: ${error.message}`);

  return ((data ?? []) as unknown as {
    id: string;
    variant_id: string;
    delta: number;
    quantity_after: number;
    reason: string;
    note: string | null;
    actor_name: string;
    created_at: string;
    product_variants: { sku: string; products: { product_translations: { name: string }[] } } | null;
  }[]).map((m) => ({
    id: m.id,
    variantId: m.variant_id,
    sku: m.product_variants?.sku ?? "",
    productName: m.product_variants?.products?.product_translations?.[0]?.name ?? "",
    delta: m.delta,
    quantityAfter: m.quantity_after,
    reason: m.reason,
    note: m.note,
    actorName: m.actor_name,
    createdAt: m.created_at,
  }));
}

export interface StockTotals {
  skus: number;
  onHand: number;
  reserved: number;
  low: number;
  out: number;
}

export function totals(rows: StockRow[], threshold: number): StockTotals {
  return {
    skus: rows.length,
    onHand: rows.reduce((n, r) => n + r.onHand, 0),
    reserved: rows.reduce((n, r) => n + r.reserved, 0),
    low: rows.filter((r) => r.available > 0 && r.available <= threshold).length,
    out: rows.filter((r) => r.available === 0).length,
  };
}
