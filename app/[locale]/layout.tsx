import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { LOCALE_HREFLANG, routing } from "@/i18n/routing";
import { getSettings } from "@/lib/data/settings";
import { AppProviders } from "./providers";
import "../globals.css";

/**
 * Fraunces for display, Inter for interface — one display voice, one UI voice,
 * no third face.
 *
 * Neither carries CJK glyphs, so the font stack in globals.css falls back to
 * system CJK faces (PingFang SC / Microsoft YaHei / Noto Sans CJK) for the `zh`
 * locale rather than rendering in a face with no coverage. Bundling a CJK
 * webfont is deferred until the client confirms the display face.
 *
 * Fraunces' true drawn italic is load-bearing: the roman/italic mix inside a
 * single heading (see DisplayHeading) does not work with a slanted roman.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    metadataBase: new URL("https://ecoplants.my"),
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
    robots: { index: true, follow: true },
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
      className={`${fraunces.variable} ${inter.variable}`}
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
