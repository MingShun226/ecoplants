import { Menu, ShieldCheck } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { HeaderActions, type SearchEntry } from "@/components/layout/header-actions";
import { HeaderShell } from "@/components/layout/header-shell";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { LogoLink } from "@/components/layout/logo-link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { categories, getProducts } from "@/lib/data/queries";
import { getSettings } from "@/lib/data/settings";
import { toMajor } from "@/lib/utils/format";
import { difficultyKeys, lightKeys, waterKeys } from "@/lib/data/facets";
import { fromPriceSen } from "@/types/catalog";

/**
 * Rendered on the server. The client islands are the scroll shell, the locale
 * switcher, the mobile sheet and the search/basket actions; the nav, guarantee
 * strip and wordmark all ship as static markup.
 */
export async function SiteHeader() {
  const settings = await getSettings();
  const tn = await getTranslations("nav");
  const tg = await getTranslations("guarantee");
  const ts = await getTranslations("shipping");
  const tAttr = await getTranslations("attributes");
  const format = await getFormatter();
  const locale = (await getLocale()) as Locale;

  // Short labels in the bar, full names on the category pages themselves — a
  // nav that reads "Pet-Safe Plants" next to "Garden & Balcony" is a paragraph,
  // not a nav.
  const navItems = categories
    .filter((c) => c.type === "plants")
    .map((c) => ({ href: `/category/${c.slug}`, label: tn(c.key) }));

  // The search index is built here so the client gets one flat, pre-localised
  // array instead of the whole catalogue. Matching spans every locale's name:
  // shoppers search across languages whichever locale they are browsing in.
  const index: SearchEntry[] = (await getProducts()).map((product) => {
    const tr = product.t[locale];
    return {
      id: product.id,
      name: tr.name,
      botanical: product.nameBotanical,
      slug: tr.slug,
      meta: `${tAttr(lightKeys[product.attributes.light])} · ${tAttr(waterKeys[product.attributes.water])}`,
      fromSen: fromPriceSen(product),
      haystack: [
        product.nameBotanical,
        product.t.en.name,
        product.t.ms.name,
        product.t.zh.name,
        tr.tagline,
        product.categorySlug,
        tAttr(lightKeys[product.attributes.light]),
        tAttr(waterKeys[product.attributes.water]),
        tAttr(difficultyKeys[product.attributes.difficulty]),
        product.attributes.petSafe ? "pet safe pet-safe cat dog selamat haiwan 宠物" : "",
      ]
        .join(" ")
        .toLowerCase(),
    };
  });

  const strip = (
    <div className="container-page flex items-center justify-between gap-6 py-2">
      <p className="flex items-center gap-2 text-[11px] tracking-wide text-text-secondary">
        <ShieldCheck className="size-3.5 text-clay-600" aria-hidden="true" />
        {tg("headline", { days: settings.guaranteeDays })}
        <span aria-hidden="true" className="mx-1 text-border-strong">
          ·
        </span>
        <span className="hidden lg:inline">
          {ts("freeOver", {
            amount: format.number(toMajor(settings.freeShippingThresholdSen), "currencyWhole"),
          })}
        </span>
      </p>
      <LocaleSwitcher />
    </div>
  );

  return (
    <HeaderShell strip={strip}>
      <div className="container-page flex h-16 items-center justify-between gap-6 md:h-[4.5rem]">
        <div className="flex items-center gap-3 lg:hidden">
          <Sheet>
            <SheetTrigger
              aria-label={tn("openMenu")}
              className="-ml-2 flex size-10 items-center justify-center rounded-full"
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(19rem,86vw)] p-0">
              <MobileNav items={navItems} />
            </SheetContent>
          </Sheet>
        </div>

        <LogoLink />

        {/* Quiet nav: no capsule chrome, just spaced links with a hairline
            underline that draws in on hover. Reads cleanly over both the dark
            hero and the solid bar. */}
        <nav aria-label="Primary" className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-9">
            {[...navItems, { href: "/quiz", label: tn("quiz") }].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="relative block py-2 text-sm tracking-wide opacity-70 transition-opacity duration-300 ease-refined after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-refined hover:opacity-100 hover:after:scale-x-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <HeaderActions index={index} />
      </div>
    </HeaderShell>
  );
}
