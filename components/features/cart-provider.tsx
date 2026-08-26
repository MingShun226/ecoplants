"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  CART_COOKIE,
  CART_MAX_AGE,
  itemCount,
  parse,
  resolve,
  serialise,
  subtotalSen,
  type ResolvedLine,
  type StoredLine,
} from "@/lib/cart/cookie";
import type { Product } from "@/types/catalog";

/**
 * Cart state, backed by the cookie rather than by React state.
 *
 * The cookie is the single source of truth and `useSyncExternalStore` reads it,
 * so the header badge, the drawer and the checkout page cannot disagree — and a
 * server-rendered checkout page reading the same cookie sees exactly what the
 * drawer showed.
 *
 * The store snapshot must be a stable string: returning a fresh array from
 * `getSnapshot` on every call makes React loop forever. The raw cookie value is
 * that string, and parsing happens once per change in a memo.
 */

interface CartContextValue {
  lines: ResolvedLine[];
  count: number;
  subtotalSen: number;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Cookie mutations do not fire an event, so subscribers are notified by hand. */
const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}

function readRawCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CART_COOKIE}=([^;]*)`),
  );
  return match?.[1] ?? "";
}

function writeCookie(lines: StoredLine[]) {
  document.cookie = `${CART_COOKIE}=${serialise(lines)}; path=/; max-age=${CART_MAX_AGE}; samesite=lax`;
  emit();
}

/**
 * Re-read the cookie now.
 *
 * For the one case the listener set cannot see: a server action changed the
 * cookie. `placeOrder` deletes it once the order exists, so the browser has the
 * new value but this store still holds the old one — the basket badge would go
 * on counting plants that are now stock held against a real order.
 */
export function refreshCart() {
  emit();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab can change the cart. There is no cookie change event, so the
  // cheapest correct signal is a re-read when this tab regains focus.
  window.addEventListener("focus", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function CartProvider({
  products,
  children,
}: {
  products: Product[];
  children: React.ReactNode;
}) {
  const raw = useSyncExternalStore(
    subscribe,
    readRawCookie,
    // The server has no access to document.cookie here. Rendering an empty cart
    // and letting the client fill it in avoids a hydration mismatch; the badge
    // simply appears a frame later.
    () => "",
  );

  const stored = useMemo(() => parse(raw), [raw]);
  const lines = useMemo(() => resolve(stored, products), [stored, products]);

  const add = useCallback(
    (variantId: string, qty = 1) => {
      const next = parse(readRawCookie());
      const existing = next.find((line) => line.v === variantId);
      if (existing) existing.q = Math.min(99, existing.q + qty);
      else next.push({ v: variantId, q: qty });
      writeCookie(next);
    },
    [],
  );

  const setQty = useCallback((variantId: string, qty: number) => {
    const next = parse(readRawCookie())
      .map((line) => (line.v === variantId ? { ...line, q: qty } : line))
      .filter((line) => line.q > 0);
    writeCookie(next);
  }, []);

  const remove = useCallback((variantId: string) => {
    writeCookie(parse(readRawCookie()).filter((line) => line.v !== variantId));
  }, []);

  const clear = useCallback(() => writeCookie([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: itemCount(stored),
      subtotalSen: subtotalSen(lines),
      add,
      setQty,
      remove,
      clear,
    }),
    [lines, stored, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}

/**
 * Opening the drawer from anywhere (the PDP's add-to-cart, the sticky mobile
 * bar) without threading a callback through every layer between.
 */
const openListeners = new Set<() => void>();

export function openCartDrawer() {
  for (const listener of openListeners) listener();
}

export function onOpenCartDrawer(listener: () => void): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}
