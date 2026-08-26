import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartProvider } from "@/components/features/cart-provider";
import { SettingsProvider } from "@/components/features/settings-provider";
import { HeaderSpacer } from "@/components/layout/header-shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";
import { routing } from "@/i18n/routing";
import { getProducts } from "@/lib/data/queries";
import { getSettings } from "@/lib/data/settings";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const settings = await getSettings();

  return (
    <SettingsProvider settings={settings}>
      <CartProvider products={await getProducts()}>
      <div className="page-ambient flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-sm focus:text-ink-50"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <HeaderSpacer />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
        <WhatsAppFab />
      </div>
      </CartProvider>
    </SettingsProvider>
  );
}
