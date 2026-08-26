import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Order reads for the admin panel.
 *
 * All through the signed-in admin's own session — no service_role key. RLS
 * grants `is_admin()` read access to orders, lines and events, and refuses
 * everyone else at the database. See ADR 0006.
 */

export type OrderStatus =
  | "pending"
  | "paid"
  | "packing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "unpaid" | "authorised" | "paid" | "failed" | "refunded";

export interface ShippingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  state: string;
}

export interface OrderLine {
  id: string;
  quantity: number;
  unitPriceSen: number;
  productName: string;
  variantLabel: string;
  sku: string;
}

export interface OrderEvent {
  id: string;
  actorName: string;
  kind: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  note: string | null;
  createdAt: string;
}

export interface OrderSummary {
  id: string;
  orderNo: string;
  fullName: string;
  email: string;
  phone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  totalSen: number;
  itemCount: number;
  isEastMalaysia: boolean;
  courier: string | null;
  trackingNo: string | null;
  placedAt: string;
}

export interface OrderDetail extends OrderSummary {
  subtotalSen: number;
  shippingFeeSen: number;
  discountSen: number;
  shippingAddress: ShippingAddress;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  lines: OrderLine[];
  events: OrderEvent[];
}

/**
 * The queue's default view. "Needs attention" is the whole point of the screen:
 * paid and packing orders are money that has arrived and nothing has shipped.
 */
export const ACTIONABLE: OrderStatus[] = ["paid", "packing"];

/** Scalars shared by both selects. Kept separate because the two embed
 *  `order_items` at different depths, and composing the strings would give the
 *  row type two conflicting shapes for the same key. */
const ORDER_SCALARS = `
  id, order_no, full_name, email, phone, status, payment_status, payment_method,
  total_sen, is_east_malaysia, courier, tracking_no, placed_at
`;

const SUMMARY_SELECT = `${ORDER_SCALARS}, order_items ( quantity )`;

const DETAIL_SELECT = `
  ${ORDER_SCALARS},
  subtotal_sen, shipping_fee_sen, discount_sen, shipping_address,
  paid_at, shipped_at, delivered_at,
  order_items ( id, quantity, unit_price_sen, product_name, variant_label, sku ),
  order_events ( id, actor_name, kind, from_status, to_status, note, created_at )
`;

interface SummaryRow {
  id: string;
  order_no: string;
  full_name: string;
  email: string;
  phone: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  total_sen: number | string;
  is_east_malaysia: boolean;
  courier: string | null;
  tracking_no: string | null;
  placed_at: string;
  order_items: { quantity: number }[];
}

function toSummary(row: SummaryRow): OrderSummary {
  return {
    id: row.id,
    orderNo: row.order_no,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    // bigint arrives from PostgREST as a string; Number() it once, here, rather
    // than discovering NaN in a total three components later.
    totalSen: Number(row.total_sen),
    itemCount: row.order_items.reduce((n, l) => n + l.quantity, 0),
    isEastMalaysia: row.is_east_malaysia,
    courier: row.courier,
    trackingNo: row.tracking_no,
    placedAt: row.placed_at,
  };
}

export async function listOrders(options: {
  status?: OrderStatus[];
  search?: string;
}): Promise<OrderSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(SUMMARY_SELECT)
    .order("placed_at", { ascending: false })
    .limit(200);

  if (options.status?.length) {
    query = query.in("status", options.status);
  }

  const search = options.search?.trim();
  if (search) {
    // Order number, name, email or phone — the four things someone reads off a
    // WhatsApp message while the customer waits.
    const term = `%${search}%`;
    query = query.or(
      `order_no.ilike.${term},full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`listOrders: ${error.message}`);

  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

/** Counts per status, for the queue's filter chips. */
export async function countByStatus(): Promise<Record<OrderStatus, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select("status");
  if (error) throw new Error(`countByStatus: ${error.message}`);

  const counts = {
    pending: 0, paid: 0, packing: 0, shipped: 0,
    delivered: 0, cancelled: 0, refunded: 0,
  } as Record<OrderStatus, number>;

  for (const row of (data ?? []) as { status: OrderStatus }[]) {
    counts[row.status] += 1;
  }
  return counts;
}

export async function getOrder(orderNo: string): Promise<OrderDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("order_no", orderNo)
    .maybeSingle();

  if (error) throw new Error(`getOrder: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as Omit<SummaryRow, "order_items"> & {
    subtotal_sen: number | string;
    shipping_fee_sen: number | string;
    discount_sen: number | string;
    shipping_address: ShippingAddress;
    paid_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    order_items: {
      id: string;
      quantity: number;
      unit_price_sen: number | string;
      product_name: string;
      variant_label: string;
      sku: string;
    }[];
    order_events: {
      id: string;
      actor_name: string;
      kind: string;
      from_status: OrderStatus | null;
      to_status: OrderStatus | null;
      note: string | null;
      created_at: string;
    }[];
  };

  return {
    // toSummary wants the summary shape; the detail row carries a richer
    // order_items, which still satisfies the { quantity } it reads.
    ...toSummary(row as unknown as SummaryRow),
    subtotalSen: Number(row.subtotal_sen),
    shippingFeeSen: Number(row.shipping_fee_sen),
    discountSen: Number(row.discount_sen),
    shippingAddress: row.shipping_address,
    paidAt: row.paid_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    lines: row.order_items.map((l) => ({
      id: l.id,
      quantity: l.quantity,
      unitPriceSen: Number(l.unit_price_sen),
      productName: l.product_name,
      variantLabel: l.variant_label,
      sku: l.sku,
    })),
    // Newest first: the last thing that happened is the thing you need.
    events: [...row.order_events]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((e) => ({
        id: e.id,
        actorName: e.actor_name,
        kind: e.kind,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        note: e.note,
        createdAt: e.created_at,
      })),
  };
}

/**
 * The moves the panel offers from a given status. Mirrors the state machine in
 * `transition_order()` — the database is the enforcement, this is the UI. If
 * they ever disagree the database wins and the button errors, which is the
 * right way round.
 */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["packing", "cancelled", "refunded"],
  packing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};
