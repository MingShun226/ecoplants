import type { Metadata } from "next";
import { Inter, Marcellus, Zilla_Slab } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { LOCALE_HREFLANG, routing } from "@/i18n/routing";
import { getSettings } from "@/lib/data/settings";
import { isIndexable, siteUrl } from "@/lib/site-url";
import { AppProviders } from "./providers";
import "../globals.css";

/**
 * Marcellus for display, Inter for interface, Zilla Slab for the wordmark alone
 * — one display voice, one UI voice, and one fixed piece of lettering that
 * belongs to the logo rather than to the page.
 *
 * Neither carries CJK glyphs, so the font stack in globals.css falls back to
 * system CJK faces (PingFang SC / Microsoft YaHei / Noto Sans CJK) for the `zh`
 * locale rather than rendering in a face with no coverage. Bundling a CJK
 * webfont is deferred until the client confirms the display face.
 *
 * Fraunces' true drawn italic is load-bearing: the roman/italic mix inside a
 * single heading (see DisplayHeading) does not work with a slanted roman.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * The display face: Marcellus, a roman inscriptional serif.
 *
 * One weight, and that is the point rather than a limitation — the letterforms
 * are cut, not drawn, and a synthesised bold would smear the very thing that
 * makes them worth using. Everywhere the old face leaned on weight for emphasis
 * now leans on size, space or colour instead.
 */
const marcellus = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marcellus",
  display: "swap",
});

/**
 * The wordmark, and only the wordmark.
 *
 * Its own face rather than the display one: the name beside the leaf is a fixed
 * piece of artwork that happens to be live text, and it should not be re-cast
 * every time the headings are. Zilla Slab's square feet hold at the sizes a
 * logo is actually worn — a phone header, a browser tab, a delivery label —
 * where the display serif's fine strokes start to disappear.
 */
const zillaSlab = Zilla_Slab({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-zilla",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });

  // hreflang across all three locales, unambiguous because every locale is
  // explicitly prefixed.
  const { guaranteeDays: days } = await getSettings();

  const languages = Object.fromEntries(
    routing.locales.map((l) => [LOCALE_HREFLANG[l], `/${l}`]),
  );

  return {
    metadataBase: siteUrl(),
    title: {
      default: t("homeTitle"),
      template: t("titleTemplate", { page: "%s" }),
    },
    description: t("homeDescription", { days }),
    alternates: { canonical: `/${locale}`, languages },
    openGraph: {
      title: t("homeTitle"),
      description: t("homeDescription", { days }),
      type: "website",
      locale: LOCALE_HREFLANG[locale],
    },
    // Preview deployments are public URLs. Indexing them competes with the
    // live site for the same content, so only production says yes.
    robots: { index: isIndexable(), follow: isIndexable() },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required so localised routes can still render statically.
  setRequestLocale(locale);

  return (
    <html
      lang={LOCALE_HREFLANG[locale]}
      className={`${inter.variable} ${marcellus.variable} ${zillaSlab.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
          <Toaster position="bottom-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
