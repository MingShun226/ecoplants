/**
 * Shared vocabulary for the panel — the enum values the database defines, and
 * the option lists built from them.
 *
 * Deliberately free of `server-only` and of any Supabase import. The forms that
 * render these lists are client components, and a value import (as opposed to a
 * type import, which erases) drags the whole module into the browser bundle. A
 * `server-only` module reached that way fails the build, which is the intended
 * behaviour — this file is the client-safe half.
 *
 * Keep it to constants and types. Anything that reads the database belongs in
 * `catalogue.ts`, `inventory.ts` or their siblings.
 */

export type LocaleCode = "en" | "ms" | "zh";
export const LOCALES: LocaleCode[] = ["en", "ms", "zh"];

export const LOCALE_LABEL: Record<LocaleCode, string> = {
  en: "English",
  ms: "Bahasa Melayu",
  zh: "中文",
};

export type LightLevel = "low" | "medium" | "bright-indirect" | "direct-sun";
export type WaterFrequency = "weekly" | "fortnightly" | "when-dry" | "keep-moist";
export type CareDifficulty = "beginner" | "easy" | "moderate" | "expert";
export type PlantPlacement = "indoor" | "outdoor" | "both";
export type CategoryKind = "plants" | "pots" | "care" | "gifts";

export const LIGHT_LEVELS: LightLevel[] = ["low", "medium", "bright-indirect", "direct-sun"];
export const WATER_FREQUENCIES: WaterFrequency[] = ["weekly", "fortnightly", "when-dry", "keep-moist"];
export const DIFFICULTIES: CareDifficulty[] = ["beginner", "easy", "moderate", "expert"];
export const PLACEMENTS: PlantPlacement[] = ["indoor", "outdoor", "both"];

/** The reasons stock moves in a nursery, as chips rather than a free-text box. */
export const ADJUST_REASONS = [
  "received",
  "damaged",
  "died",
  "correction",
  "returned",
  "gift",
] as const;

export type AdjustReason = (typeof ADJUST_REASONS)[number];

/**
 * Badges are message keys, not copy — the storefront looks each one up in
 * `messages/*.json`. Offering the known set as chips is what stops someone
 * inventing `bestseller` and shipping a product that renders a raw key.
 */
export const BADGE_KEYS = [
  "bestSeller",
  "hardToKill",
  "lowLight",
  "fullSun",
  "fastGrower",
  "statement",
  "deskSize",
  "hanging",
  "flowering",
  "fragrant",
  "native",
  "easy",
] as const;

/**
 * Photos per product.
 *
 * Nine is a limit on the shopper's patience rather than on storage. Past about
 * that a gallery stops being browsed and starts being scrolled past, and every
 * extra shot is another image a phone fetches before the page settles.
 *
 * Lives here rather than beside the upload action because a `"use server"`
 * module may only export async functions — a constant exported from one is a
 * build error, not a lint warning.
 */
export const MAX_IMAGES_PER_PRODUCT = 9;
