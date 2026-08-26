"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CART_COOKIE, parse } from "@/lib/cart/cookie";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Placing an order.
 *
 * The one rule: **the browser is not a source of truth about money.** This
 * action reads the cart from the cookie server-side, sends nothing but variant
 * ids and quantities to `place_order()`, and lets Postgres recompute every
 * price, the delivery fee and the East Malaysia restriction from the catalogue.
 * The totals the customer saw are display only; if the cookie was edited, the
 * basket changes and the price does not.
 *
 * There is no INSERT policy on `orders` or `order_items`. Rows arrive only
 * through `place_order()`, which runs as the table owner, so this action is the
 * only door and the database is the lock.
 */

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNo: string; totalSen: number }
  | { ok: false; error: string };

export interface CheckoutContact {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  state: string;
}

/** Postgres messages are written for the customer; strip the function prefix. */
function readable(message: string): string {
  const stripped = message.replace(/^.*?(place_order|confirm_payment|abandon_order): /, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export async function placeOrder(contact: CheckoutContact): Promise<PlaceOrderResult> {
  const jar = await cookies();
  const lines = parse(jar.get(CART_COOKIE)?.value);

  if (lines.length === 0) {
    return { ok: false, error: "Your basket is empty." };
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_lines: lines.map((line) => ({ variant_id: line.v, quantity: line.q })),
    p_contact: {
      full_name: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      line1: contact.line1,
      line2: contact.line2,
      city: contact.city,
      postcode: contact.postcode,
      state: contact.state,
    },
  });

  if (error) return { ok: false, error: readable(error.message) };

  const result = data as { order_id: string; order_no: string; total_sen: number };

  // The basket is now stock held against a real order. Leaving the cookie would
  // let a refresh place the same order twice.
  jar.delete(CART_COOKIE);

  // Stock moved, so anything showing "only 3 left" is now wrong.
  revalidatePath("/", "layout");

  return {
    ok: true,
    orderId: result.order_id,
    orderNo: result.order_no,
    totalSen: Number(result.total_sen),
  };
}

/**
 * DUMMY GATEWAY. No payment is taken — this is the button that stands in for
 * one, so the rest of the flow can be built and tested.
 *
 * The seam is deliberately narrow: a real gateway replaces this action with a
 * webhook that calls the same `confirm_payment()` with the gateway's own
 * reference. `payment_ref` is unique, so a retried webhook conflicts instead of
 * committing stock twice — that part is already real.
 */
export async function payForOrder(
  orderId: string,
  method: string,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("confirm_payment", {
    p_order_id: orderId,
    // Shaped like a gateway reference so the admin timeline reads the same way
    // it will once one exists. The DUMMY prefix is so nobody mistakes it later.
    p_payment_ref: `DUMMY-${orderId.slice(0, 8).toUpperCase()}`,
    p_method: method,
  });

  if (error) return { ok: false, error: readable(error.message) };

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true, status: data as string };
}

/** Changed their mind at the payment screen — release the plants they held. */
export async function abandonOrder(
  orderId: string,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("abandon_order", { p_order_id: orderId });

  if (error) return { ok: false, error: readable(error.message) };

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true, status: data as string };
}
