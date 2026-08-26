/**
 * Money is stored and passed around as integer sen (1 MYR = 100 sen) and only
 * becomes a decimal at the moment it is rendered.
 *
 * Rendering goes through next-intl's formatter (`useFormatter().number(value,
 * "currency")`) so the currency symbol and grouping follow the active locale.
 * These helpers exist for the conversion, not the formatting.
 */

/** 12900 → 129. Feed the result to the locale formatter, never to a template. */
export function toMajor(sen: number): number {
  return sen / 100;
}

export function toSen(major: number): number {
  return Math.round(major * 100);
}
