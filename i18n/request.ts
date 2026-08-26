import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_HREFLANG, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,

    // All currency, number and date output flows through these formatters.
    // String-concatenating "RM " + amount is prohibited: it is the mechanism by
    // which a future currency or locale change becomes a full-app refactor.
    //
    // `currencyDisplay: "narrowSymbol"` is load-bearing, not cosmetic. The
    // routing locale is "en" / "ms" / "zh" rather than "en-MY", so the default
    // currency display renders "MYR 149.00" — a code no Malaysian retail
    // customer reads as money. narrowSymbol yields "RM 149.00" in every locale
    // without coupling the formatter to a region tag.
    formats: {
      number: {
        currency: {
          style: "currency",
          currency: "MYR",
          currencyDisplay: "narrowSymbol",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
        currencyWhole: {
          style: "currency",
          currency: "MYR",
          currencyDisplay: "narrowSymbol",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        },
        centimetre: {
          style: "unit",
          unit: "centimeter",
          unitDisplay: "short",
          maximumFractionDigits: 0,
        },
        metre: {
          style: "unit",
          unit: "meter",
          unitDisplay: "short",
          maximumFractionDigits: 1,
        },
        percent: { style: "percent", maximumFractionDigits: 0 },
      },
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
        time: { hour: "2-digit", minute: "2-digit" },
      },
    },

    // Malaysia is UTC+8; pinning avoids server/client hydration mismatches on
    // dates rendered during SSR.
    timeZone: "Asia/Kuala_Lumpur",
    now: new Date(),

    getMessageFallback({ key, namespace }) {
      const path = [namespace, key].filter(Boolean).join(".");
      // Surfacing the key beats rendering an empty string — a missing
      // translation becomes visible in review rather than silently blank.
      const leaf = path.split(".").at(-1) ?? key;
      return process.env.NODE_ENV === "production" ? leaf : `⟨${path}⟩`;
    },

    onError() {
      // Missing-message errors are expected while translation coverage is
      // still being reviewed by native speakers.
    },

    ...{ localeTag: LOCALE_HREFLANG[locale] },
  };
});
