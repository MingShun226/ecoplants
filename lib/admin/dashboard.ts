import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/admin/orders";

/**
 * The opening screen.
 *
 * It answers four questions in the order someone actually asks them: what needs
 * doing right now, what is about to run out, how is trade going, and what is
 * selling. Anything that is merely interesting is left off — a dashboard that
 * has to be scanned is a dashboard that gets skipped.
 */

export interface DashboardData {
  needsPacking: number;
  awaitingPayment: number;
  inTransit: number;
  unmoderatedReviews: number;
  revenue: { last7Sen: number; prev7Sen: number; last30Sen: number; ordersLast7: number };
  lowStock: { sku: string; productName: string; available: number }[];
  outOfStock: number;
  topSellers: { productName: string; sku: string; units: number; revenueSen: number }[];
  recentOrders: {
    orderNo: string;
    fullName: string;
    status: OrderStatus;
    totalSen: number;
    placedAt: string;
  }[];
}

/** Only money that was actually taken. Cancelled and refunded are not trade. */
const REVENUE_STATUSES: OrderStatus[] = ["paid", "packing", "shipped", "delivered"];

export async function getDashboard(lowStockThreshold: number): Promise<DashboardData> {
  const supabase = await createClient();

  const [orders, reviews, stock] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        order_no, full_name, status, total_sen, placed_at,
        order_items ( quantity, unit_price_sen, sku, product_name )
      `)
      .order("placed_at", { ascending: false })
      .limit(1000),
    supabase.from("reviews").select("id").eq("is_approved", false),
    supabase
      .from("product_variants")
      .select("sku, products!inner ( is_active, product_translations!inner ( name ) ), inventory ( quantity_on_hand, reserved )")
      .eq("products.product_translations.locale", "en")
      .eq("products.is_active", true)
      .limit(500),
  ]);

  if (orders.error) throw new Error(`getDashboard orders: ${orders.error.message}`);

  const rows = (orders.data ?? []) as unknown as {
    order_no: string;
    full_name: string;
    status: OrderStatus;
    total_sen: number | string;
    placed_at: string;
    order_items: { quantity: number; unit_price_sen: number | string; sku: string; product_name: string }[];
  }[];

  const now = Date.now();
  const days = (n: number) => now - n * 86_400_000;
  const at = (iso: string) => new Date(iso).getTime();

  const counted = rows.filter((o) => REVENUE_STATUSES.includes(o.status));
  const sum = (list: typeof counted) => list.reduce((n, o) => n + Number(o.total_sen), 0);

  const last7 = counted.filter((o) => at(o.placed_at) >= days(7));
  const prev7 = counted.filter((o) => at(o.placed_at) < days(7) && at(o.placed_at) >= days(14));
  const last30 = counted.filter((o) => at(o.placed_at) >= days(30));

  // Units shifted in the last 30 days, by SKU. Revenue, not just count: three
  // cheap plants moving is not the same signal as three expensive ones.
  const bySku = new Map<string, { productName: string; sku: string; units: number; revenueSen: number }>();
  for (const o of last30) {
    for (const line of o.order_items) {
      const entry = bySku.get(line.sku) ?? {
        productName: line.product_name,
        sku: line.sku,
        units: 0,
        revenueSen: 0,
      };
      entry.units += line.quantity;
      entry.revenueSen += Number(line.unit_price_sen) * line.quantity;
      bySku.set(line.sku, entry);
    }
  }

  const stockRows = ((stock.data ?? []) as unknown as {
    sku: string;
    products: { product_translations: { name: string }[] } | null;
    inventory: { quantity_on_hand: number; reserved: number } | { quantity_on_hand: number; reserved: number }[] | null;
  }[]).map((v) => {
    const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
    return {
      sku: v.sku,
      productName: v.products?.product_translations?.[0]?.name ?? v.sku,
      available: Math.max(0, (inv?.quantity_on_hand ?? 0) - (inv?.reserved ?? 0)),
    };
  });

  const countStatus = (s: OrderStatus) => rows.filter((o) => o.status === s).length;

  return {
    needsPacking: countStatus("paid") + countStatus("packing"),
    awaitingPayment: countStatus("pending"),
    inTransit: countStatus("shipped"),
    unmoderatedReviews: reviews.data?.length ?? 0,
    revenue: {
      last7Sen: sum(last7),
      prev7Sen: sum(prev7),
      last30Sen: sum(last30),
      ordersLast7: last7.length,
    },
    lowStock: stockRows
      .filter((r) => r.available > 0 && r.available <= lowStockThreshold)
      .sort((a, b) => a.available - b.available)
      .slice(0, 8),
    outOfStock: stockRows.filter((r) => r.available === 0).length,
    topSellers: [...bySku.values()].sort((a, b) => b.revenueSen - a.revenueSen).slice(0, 6),
    recentOrders: rows.slice(0, 6).map((o) => ({
      orderNo: o.order_no,
      fullName: o.full_name,
      status: o.status,
      totalSen: Number(o.total_sen),
      placedAt: o.placed_at,
    })),
  };
}
