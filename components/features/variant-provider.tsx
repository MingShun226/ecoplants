"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Product, Variant } from "@/types/catalog";

/**
 * Which variant the shopper is looking at.
 *
 * The gallery and the buy box sit in different columns of the PDP grid and are
 * rendered by a server component, so neither can own this — a `useState` inside
 * the buy box is invisible to the photograph beside it. Lifting it here is what
 * lets choosing "medium" change the picture as well as the price.
 *
 * Deliberately not URL state. A variant is a glance, not a destination: putting
 * it in the query string would push a history entry per tap and make the back
 * button walk through pot sizes instead of leaving the page.
 */

interface VariantContext {
  variant: Variant;
  variantId: string;
  select: (id: string) => void;
}

const Ctx = createContext<VariantContext | null>(null);

export function VariantProvider({
  product,
  children,
}: {
  product: Product;
  children: React.ReactNode;
}) {
  // Opening on a sold-out size when another is in stock reads as a shop with
  // nothing to sell. Falls back to the first variant when everything is out.
  const initial = product.variants.find((v) => v.quantityOnHand > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(initial.id);

  const value = useMemo<VariantContext>(() => {
    const variant = product.variants.find((v) => v.id === variantId) ?? initial;
    return { variant, variantId: variant.id, select: setVariantId };
  }, [product.variants, variantId, initial]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelectedVariant(): VariantContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSelectedVariant must be used inside <VariantProvider>");
  return ctx;
}
