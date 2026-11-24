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

/**
 * What a category can be a category *of*.
 *
 * The database column is an enum, so this is the whole set — a value outside it
 * is refused by Postgres rather than by us, and the form should never offer one.
 */
export const CATEGORY_KINDS: CategoryKind[] = ["plants", "pots", "care", "gifts"];

export const LIGHT_LEVELS: LightLevel[] = ["low", "medium", "bright-indirect", "direct-sun"];
export const WATER_FREQUENCIES: WaterFrequency[] = ["weekly", "fortnightly", "when-dry", "keep-moist"];
export const DIFFICULTIES: CareDifficulty[] = ["beginner", "easy", "moderate", "expert"];
export const PLACEMENTS: PlantPlacement[] = ["indoor", "outdoor", "both"];

/**
 * What the plant is potted in.
 *
 * Message keys, not copy — the storefront looks each one up in
 * `messages/*.json` under `potColors` and `potMaterials`, so a value invented
 * here renders as a raw key on a live product page. Adding one means adding it
 * in all three locales too.
 *
 * "Plastic" and the nursery colours exist because that is what a plant actually
 * ships in. Before they did, every new product claimed a charcoal ceramic pot,
 * which was a default pretending to be a fact.
 */
export const POT_COLOR_KEYS = [
  "terracotta",
  "cream",
  "charcoal",
  "sand",
  "black",
  "green",
  "white",
] as const;

export const POT_MATERIAL_KEYS = ["plastic", "terracotta", "ceramic", "fibreclay"] as const;

export type PotColorKey = (typeof POT_COLOR_KEYS)[number];
export type PotMaterialKey = (typeof POT_MATERIAL_KEYS)[number];

/**
 * The sizes a plant is sold in.
 *
 * Message keys, like everything else a shopper reads: the storefront looks each
 * one up under `sizes` in `messages/*.json`, so a value invented here renders
 * as a raw key on a live product page.
 */
export const SIZE_KEYS = ["small", "medium", "large", "extra-large"] as const;

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

// ---------------------------------------------------------------- network --
// Partner nurseries (ADR 0009). The database enums are the whole set; these
// lists exist so the forms never offer a value Postgres would refuse.

export type PartnerKind = "house" | "nursery";
export type PartnerStatus = "onboarding" | "active" | "paused" | "ended";
export type OfferAvailability = "available" | "limited" | "out";

export const PARTNER_STATUSES: PartnerStatus[] = ["onboarding", "active", "paused", "ended"];

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  onboarding: "Onboarding",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

/** One line each, for the status picker — what the status actually does. */
export const PARTNER_STATUS_HINT: Record<PartnerStatus, string> = {
  onboarding: "Being signed up. Not given orders yet.",
  active: "Given orders when it is open and in range.",
  paused: "Not given orders until someone sets it back to Active.",
  ended: "No longer a partner. Kept for the orders it fulfilled.",
};

export const OFFER_AVAILABILITIES: OfferAvailability[] = ["available", "limited", "out"];

export const OFFER_AVAILABILITY_LABEL: Record<OfferAvailability, string> = {
  available: "Available",
  limited: "Few left",
  out: "Out",
};

/** Pickup days, in the order a week is read in Malaysia. */
export const PICKUP_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type PickupDay = (typeof PICKUP_DAYS)[number];

export const PICKUP_DAY_LABEL: Record<PickupDay, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** `null` is closed that day. Times are "HH:MM", 24-hour, Malaysia time. */
export type PickupHours = Partial<Record<PickupDay, { open: string; close: string } | null>>;
