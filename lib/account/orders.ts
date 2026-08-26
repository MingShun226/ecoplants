import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * A customer's own orders.
 *
 * No filtering by customer id here on purpose. The read goes through the
 * signed-in session, and the RLS policy on `orders` is
 * `is_admin() or auth.uid() = customer_id` — so the database decides what comes
 * back. Adding a `.eq("customer_id", …)` would look like the security and
 * quietly become the only security the day someone edits the policy.
 */

export interface MyOrder {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  totalSen: number;
  itemCount: number;
  placedAt: string;
  courier: string | null;
  trackingNo: string | null;
  /** First line's name, so the list reads as plants rather than reference numbers. */
  summary: string;
}

interface Row {
  id: string;
  order_no: string;
  status: string;
  payment_status: string;
  total_sen: number | string;
  placed_at: string;
  courier: string | null;
  tracking_no: string | null;
  order_items: { quantity: number; product_name: string }[];
}

export async function listMyOrders(): Promise<MyOrder[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_no, status, payment_status, total_sen, placed_at, courier, tracking_no,
      order_items ( quantity, product_name )
    `)
    .order("placed_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`listMyOrders: ${error.message}`);

  return ((data ?? []) as unknown as Row[]).map((o) => {
    const names = o.order_items.map((l) => l.product_name);
    const first = names[0] ?? "";
    const extra = names.length - 1;

    return {
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      paymentStatus: o.payment_status,
      totalSen: Number(o.total_sen),
      itemCount: o.order_items.reduce((n, l) => n + l.quantity, 0),
      placedAt: o.placed_at,
      courier: o.courier,
      trackingNo: o.tracking_no,
      summary: extra > 0 ? `${first} and ${extra} more` : first,
    };
  });
}

/**
 * Does the signed-in customer already own this order?
 *
 * Asked through their own session, so RLS answers it: a row comes back only
 * when `orders.customer_id` is theirs. No `.eq("customer_id", …)` here for the
 * same reason as above — the policy is the security, and a filter beside it
 * would look like the security instead.
 */
export async function ownsOrder(orderId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("id").eq("id", orderId).maybeSingle();
  return data !== null;
}
