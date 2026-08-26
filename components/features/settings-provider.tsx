"use client";

import { createContext, useContext } from "react";
import type { ShopSettings } from "@/lib/data/settings";

/**
 * Shop settings for client components.
 *
 * The storefront layout reads the row on the server and hands it down. A
 * context, rather than props threaded through six levels, because the basket
 * drawer and the buy box need the free-delivery threshold and neither is
 * anywhere near the layout that fetched it.
 *
 * There is no fetching here and no loading state: the value is already resolved
 * by the time the tree renders, so the progress bar cannot flash the wrong
 * threshold on first paint.
 */
const SettingsContext = createContext<ShopSettings | null>(null);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: ShopSettings;
  children: React.ReactNode;
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useShopSettings(): ShopSettings {
  const settings = useContext(SettingsContext);
  if (!settings) {
    // Throwing beats a silent fallback. A component rendering outside the
    // provider would quietly show the shipped-with defaults, and nobody would
    // notice until a customer was quoted the wrong delivery fee.
    throw new Error("useShopSettings must be used inside <SettingsProvider>");
  }
  return settings;
}
