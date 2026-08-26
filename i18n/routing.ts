import { defineRouting } from "next-intl/routing";

/**
 * `localePrefix: "always"` — every locale is explicitly prefixed, including the
 * default. That yields unambiguous hreflang annotations and avoids the
 * duplicate-content ambiguity of serving an unprefixed default alongside
 * prefixed alternates. SEO in both English and Bahasa Malaysia is a stated
 * goal (blueprint §2.8).
 */
export const routing = defineRouting({
  locales: ["en", "ms", "zh"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<
  Locale,
  { native: string; english: string }
> = {
  en: { native: "English", english: "English" },
  ms: { native: "Bahasa Malaysia", english: "Bahasa Malaysia" },
  zh: { native: "简体中文", english: "Simplified Chinese" },
};

/** BCP-47 tags for hreflang and Intl formatting. */
export const LOCALE_HREFLANG: Record<Locale, string> = {
  en: "en-MY",
  ms: "ms-MY",
  zh: "zh-Hans-MY",
};
