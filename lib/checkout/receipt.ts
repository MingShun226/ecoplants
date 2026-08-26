import { createPublicClient } from "@/lib/supabase/public";

/**
 * Reading an order back, for a guest.
 *
 * There are no customer accounts, so the order id *is* the capability: 122 bits
 * of unguessable, handed over once at checkout and never listed anywhere. RLS
 * cannot express that — a SELECT policy permissive enough for `anon` would be
 * `using (true)`, which exposes every order to anyone who can guess an id — so
 * the read goes through `get_order_receipt()`, which returns only what a
 * receipt needs and nothing else the shop knows.
 */

export interface ReceiptLine {
  productName: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPriceSen: number;
}

export interface Receipt {
  orderNo: string;
  status: string;
  paymentStatus: string;
  fullName: string;
  email: string;
  subtotalSen: number;
  shippingFeeSen: number;
  totalSen: number;
  shippingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
    state: string;
  };
  isEastMalaysia: boolean;
  placedAt: string;
  courier: string | null;
  trackingNo: string | null;
  lines: ReceiptLine[];
}

interface ReceiptRow {
  order_no: string;
  status: string;
  payment_status: string;
  full_name: string;
  email: string;
  subtotal_sen: number | string;
  shipping_fee_sen: number | string;
  total_sen: number | string;
  shipping_address: Receipt["shippingAddress"];
  is_east_malaysia: boolean;
  placed_at: string;
  courier: string | null;
  tracking_no: string | null;
  lines: {
    product_name: string;
    variant_label: string;
    sku: string;
    quantity: number;
    unit_price_sen: number | string;
  }[];
}

/** A malformed id in the URL is a 404, not a 500. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getReceipt(orderId: string): Promise<Receipt | null> {
  if (!UUID.test(orderId)) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_order_receipt", { p_order_id: orderId });

  if (error || !data) return null;

  const row = data as ReceiptRow;
  return {
    orderNo: row.order_no,
    status: row.status,
    paymentStatus: row.payment_status,
    fullName: row.full_name,
    email: row.email,
    subtotalSen: Number(row.subtotal_sen),
    shippingFeeSen: Number(row.shipping_fee_sen),
    totalSen: Number(row.total_sen),
    shippingAddress: row.shipping_address,
    isEastMalaysia: row.is_east_malaysia,
    placedAt: row.placed_at,
    courier: row.courier,
    trackingNo: row.tracking_no,
    lines: row.lines.map((l) => ({
      productName: l.product_name,
      variantLabel: l.variant_label,
      sku: l.sku,
      quantity: l.quantity,
      unitPriceSen: Number(l.unit_price_sen),
    })),
  };
}
