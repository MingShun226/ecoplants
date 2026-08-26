import type { Product, Variant } from "@/types/catalog";

/**
 * Guest cart storage.
 *
 * The cart is a cookie holding variant ids and quantities — nothing else, and
 * nothing trusted. Every price is recomputed server-side at checkout from the
 * catalogue, so a tampered cookie can change what is in the basket but never
 * what it costs. See docs/decisions/0003-guest-cart-in-cookie.md.
 *
 * It is readable by JavaScript because the client owns cart mutations today.
 * When add/remove move to server actions the same cookie becomes httpOnly with
 * no change to its shape or to anything that reads it.
 */

export const CART_COOKIE = "ep_cart";
export const CART_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Short keys: this lives in a cookie, and every byte rides on every request. */
export interface StoredLine {
  v: string;
  q: number;
}

export function serialise(lines: readonly StoredLine[]): string {
  return encodeURIComponent(JSON.stringify(lines));
}

export function parse(raw: string | undefined | null): StoredLine[] {
  if (!raw) return [];
  try {
    const decoded = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(decoded)) return [];
    return decoded
      .filter(
        (line): line is StoredLine =>
          typeof line?.v === "string" && Number.isFinite(line?.q) && line.q > 0,
      )
      .map((line) => ({ v: line.v, q: Math.min(99, Math.floor(line.q)) }));
  } catch {
    // A malformed cookie is not worth an error page — an empty cart is the
    // safe reading, and the next mutation overwrites it.
    return [];
  }
}

/** A stored line joined with the catalogue it points at. */
export interface ResolvedLine {
  product: Product;
  variant: Variant;
  qty: number;
}

export function resolve(lines: readonly StoredLine[], products: Product[]): ResolvedLine[] {
  return lines
    .map(({ v, q }) => {
      const product = products.find((p) => p.variants.some((variant) => variant.id === v));
      const variant = product?.variants.find((variant) => variant.id === v);
      return product && variant ? { product, variant, qty: q } : null;
    })
    .filter((line): line is ResolvedLine => line !== null);
}

export function subtotalSen(lines: readonly ResolvedLine[]): number {
  return lines.reduce((sum, line) => sum + line.variant.priceSen * line.qty, 0);
}

export function itemCount(lines: readonly StoredLine[]): number {
  return lines.reduce((sum, line) => sum + line.q, 0);
}
