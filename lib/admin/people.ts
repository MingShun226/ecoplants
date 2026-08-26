import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, PaymentStatus } from "@/lib/admin/orders";

/**
 * Customers, reviews and quiz responses.
 *
 * A "customer" here is anyone who has ordered, not anyone with an account —
 * there is no customer login yet, so every order so far is a guest order. The
 * list is therefore built from `orders`, grouped by email, rather than from the
 * `customers` table, which is empty and will stay empty until accounts exist.
 * When accounts arrive this becomes a join instead of a group-by; the shape it
 * returns will not change.
 */

export interface CustomerRow {
  email: string;
  fullName: string;
  phone: string;
  customerId: string | null;
  orderCount: number;
  /** Only orders that were actually paid for. Cancelled ones are not revenue. */
  spentSen: number;
  lastOrderAt: string;
  firstOrderAt: string;
  isEastMalaysia: boolean;
}

const REVENUE_STATUSES: OrderStatus[] = ["paid", "packing", "shipped", "delivered"];

export async function listCustomers(options: { search?: string } = {}): Promise<CustomerRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("customer_id, full_name, email, phone, status, total_sen, placed_at, is_east_malaysia")
    .order("placed_at", { ascending: false })
    .limit(2000);

  if (error) throw new Error(`listCustomers: ${error.message}`);

  const byEmail = new Map<string, CustomerRow>();

  for (const o of (data ?? []) as {
    customer_id: string | null;
    full_name: string;
    email: string;
    phone: string;
    status: OrderStatus;
    total_sen: number | string;
    placed_at: string;
    is_east_malaysia: boolean;
  }[]) {
    const key = o.email.toLowerCase();
    const existing = byEmail.get(key);
    const revenue = REVENUE_STATUSES.includes(o.status) ? Number(o.total_sen) : 0;

    if (!existing) {
      byEmail.set(key, {
        email: o.email,
        fullName: o.full_name,
        phone: o.phone,
        customerId: o.customer_id,
        orderCount: 1,
        spentSen: revenue,
        lastOrderAt: o.placed_at,
        firstOrderAt: o.placed_at,
        isEastMalaysia: o.is_east_malaysia,
      });
    } else {
      existing.orderCount += 1;
      existing.spentSen += revenue;
      // Rows arrive newest first, so the last one seen is the earliest.
      existing.firstOrderAt = o.placed_at;
      existing.customerId ??= o.customer_id;
    }
  }

  let rows = [...byEmail.values()].sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));

  const search = options.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (c) =>
        c.email.toLowerCase().includes(search) ||
        c.fullName.toLowerCase().includes(search) ||
        c.phone.includes(search),
    );
  }

  return rows;
}

export interface CustomerOrder {
  id: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalSen: number;
  itemCount: number;
  placedAt: string;
}

export interface CustomerDetail extends CustomerRow {
  orders: CustomerOrder[];
  lastAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    postcode: string;
    state: string;
  } | null;
}

export async function getCustomer(email: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_no, customer_id, full_name, email, phone, status, payment_status,
      total_sen, placed_at, is_east_malaysia, shipping_address,
      order_items ( quantity )
    `)
    .ilike("email", email)
    .order("placed_at", { ascending: false });

  if (error) throw new Error(`getCustomer: ${error.message}`);
  const rows = (data ?? []) as unknown as {
    id: string;
    order_no: string;
    customer_id: string | null;
    full_name: string;
    email: string;
    phone: string;
    status: OrderStatus;
    payment_status: PaymentStatus;
    total_sen: number | string;
    placed_at: string;
    is_east_malaysia: boolean;
    shipping_address: CustomerDetail["lastAddress"];
    order_items: { quantity: number }[];
  }[];

  if (!rows.length) return null;

  const newest = rows[0];
  const spentSen = rows
    .filter((o) => REVENUE_STATUSES.includes(o.status))
    .reduce((n, o) => n + Number(o.total_sen), 0);

  return {
    email: newest.email,
    fullName: newest.full_name,
    phone: newest.phone,
    customerId: newest.customer_id,
    orderCount: rows.length,
    spentSen,
    lastOrderAt: newest.placed_at,
    firstOrderAt: rows[rows.length - 1].placed_at,
    isEastMalaysia: newest.is_east_malaysia,
    lastAddress: newest.shipping_address,
    orders: rows.map((o) => ({
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      paymentStatus: o.payment_status,
      totalSen: Number(o.total_sen),
      itemCount: o.order_items.reduce((n, l) => n + l.quantity, 0),
      placedAt: o.placed_at,
    })),
  };
}

// ---------------------------------------------------------------- reviews --

export interface ReviewRow {
  id: string;
  productRef: string;
  productName: string;
  rating: number;
  body: string | null;
  isApproved: boolean;
  imageCount: number;
  createdAt: string;
  orderNo: string | null;
}

export async function listReviews(options: { view?: "pending" | "approved" | "all" } = {}): Promise<ReviewRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("reviews")
    .select(`
      id, rating, body, is_approved, image_paths, created_at,
      products!inner ( ref, product_translations!inner ( name ) ),
      orders ( order_no )
    `)
    .eq("products.product_translations.locale", "en")
    .order("created_at", { ascending: false })
    .limit(300);

  if (options.view === "pending") query = query.eq("is_approved", false);
  if (options.view === "approved") query = query.eq("is_approved", true);

  const { data, error } = await query;
  if (error) throw new Error(`listReviews: ${error.message}`);

  return ((data ?? []) as unknown as {
    id: string;
    rating: number;
    body: string | null;
    is_approved: boolean;
    image_paths: string[] | null;
    created_at: string;
    products: { ref: string; product_translations: { name: string }[] } | null;
    orders: { order_no: string } | null;
  }[]).map((r) => ({
    id: r.id,
    productRef: r.products?.ref ?? "",
    productName: r.products?.product_translations?.[0]?.name ?? "",
    rating: r.rating,
    body: r.body,
    isApproved: r.is_approved,
    imageCount: r.image_paths?.length ?? 0,
    createdAt: r.created_at,
    // A review tied to an order is a verified purchase, which is the single
    // most useful thing a moderator can know about it.
    orderNo: r.orders?.order_no ?? null,
  }));
}

/** For the nav badge. `head: true` so no rows come back, only the count. */
export async function countPendingReviews(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("is_approved", false);
  return count ?? 0;
}

// --------------------------------------------------------- quiz responses --

export interface QuizResponse {
  id: string;
  sessionId: string | null;
  locale: string;
  answers: Record<string, unknown>;
  recommendedIds: string[];
  createdAt: string;
}

export async function listQuizResponses(limit = 200): Promise<QuizResponse[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quiz_responses")
    .select("id, session_id, locale, answers, recommended_ids, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listQuizResponses: ${error.message}`);

  return ((data ?? []) as unknown as {
    id: string;
    session_id: string | null;
    locale: string;
    answers: Record<string, unknown> | null;
    recommended_ids: string[] | null;
    created_at: string;
  }[]).map((q) => ({
    id: q.id,
    sessionId: q.session_id,
    locale: q.locale,
    answers: q.answers ?? {},
    recommendedIds: q.recommended_ids ?? [],
    createdAt: q.created_at,
  }));
}
