import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SETTINGS_FALLBACK,
  SETTINGS_SELECT,
  toSettings,
  type SettingsRow,
  type ShopSettings,
} from "@/lib/data/settings";

/**
 * Shop settings, for the panel.
 *
 * The shape and the storefront's read side live in `lib/data/settings.ts`; this
 * is only the admin-session read, so the panel sees the row through RLS like
 * everything else it touches.
 */

export type { ShopSettings } from "@/lib/data/settings";
export { SETTINGS_FALLBACK } from "@/lib/data/settings";

export async function getSettings(): Promise<ShopSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("shop_settings").select(SETTINGS_SELECT).maybeSingle();
  return data ? toSettings(data as SettingsRow) : SETTINGS_FALLBACK;
}
