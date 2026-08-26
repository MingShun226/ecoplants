import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Shop settings, for the storefront.
 *
 * The panel writes these (see `lib/admin/settings.ts`); this is the read side
 * every shopper-facing screen goes through. It reads as `anon` and without
 * cookies, exactly like `lib/data/queries.ts` and for the same reason: calling
 * `cookies()` would opt all 42 prerendered product pages out of static
 * rendering to read five numbers that carry no session.
 *
 * `ShopSettings` lives here rather than in the admin module so that client
 * components can `import type` it without reaching into server-only code.
 */

export interface ShopSettings {
  freeShippingThresholdSen: number;
  standardShippingSen: number;
  guaranteeDays: number;
  whatsappNumber: string;
  lowStockThreshold: number;
  updatedAt: string | null;
}

/** Matches the column defaults, so a read can never leave a page with nothing. */
export const SETTINGS_FALLBACK: ShopSettings = {
  freeShippingThresholdSen: 15000,
  standardShippingSen: 1200,
  guaranteeDays: 14,
  whatsappNumber: "60123456789",
  lowStockThreshold: 5,
  updatedAt: null,
};

export const SETTINGS_SELECT =
  "free_shipping_threshold_sen, standard_shipping_sen, guarantee_days, whatsapp_number, low_stock_threshold, updated_at";

export interface SettingsRow {
  free_shipping_threshold_sen: number;
  standard_shipping_sen: number;
  guarantee_days: number;
  whatsapp_number: string;
  low_stock_threshold: number;
  updated_at: string | null;
}

export function toSettings(row: SettingsRow): ShopSettings {
  return {
    freeShippingThresholdSen: row.free_shipping_threshold_sen,
    standardShippingSen: row.standard_shipping_sen,
    guaranteeDays: row.guarantee_days,
    whatsappNumber: row.whatsapp_number,
    lowStockThreshold: row.low_stock_threshold,
    updatedAt: row.updated_at,
  };
}

async function fetchSettings(): Promise<ShopSettings> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("shop_settings").select(SETTINGS_SELECT).maybeSingle();

  // Deliberately does not throw. A settings row that cannot be read should
  // degrade to the rules we shipped with, not take the whole shop down over a
  // free-delivery threshold.
  if (error || !data) return SETTINGS_FALLBACK;
  return toSettings(data as SettingsRow);
}

/** Deduped per render pass, so a page that needs these in four places pays once. */
export const getSettings = cache(fetchSettings);

/** wa.me wants E.164 without the plus, which is how the number is stored. */
export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`;
}
