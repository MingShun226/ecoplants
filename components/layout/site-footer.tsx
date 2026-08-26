import { MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/logo";
import { LeafRule, WhatsAppIcon } from "@/components/brand/primitives";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Link } from "@/i18n/navigation";
import { getSettings, whatsappUrl } from "@/lib/data/settings";
import { toMajor } from "@/lib/utils/format";

export async function SiteFooter() {
  const settings = await getSettings();
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const tg = await getTranslations("guarantee");
  const ts = await getTranslations("shipping");
  const tw = await getTranslations("whatsapp");
  const th = await getTranslations("home");
  const format = await getFormatter();

  const columns = [
    {
      heading: t("shopHeading"),
      links: [
        { href: "/category/indoor", label: tn("indoor") },
        { href: "/category/outdoor", label: tn("outdoor") },
        { href: "/category/pet-safe", label: tn("petSafe") },
        { href: "/category/beginner", label: tn("beginner") },
        { href: "/category/pots", label: tn("pots") },
      ],
    },
    {
      heading: t("helpHeading"),
      links: [
        { href: "/guarantee", label: tn("guarantee") },
        { href: "/delivery", label: t("delivery") },
        { href: "/returns", label: t("returns") },
        { href: "/faq", label: t("faq") },
        { href: "/contact", label: tn("contact") },
      ],
    },
    {
      heading: t("learnHeading"),
      links: [
        { href: "/quiz", label: tn("quiz") },
        { href: "/care", label: t("careGuides") },
        { href: "/care/watering", label: t("watering") },
        { href: "/care/pet-safety", label: t("petSafety") },
        { href: "/about", label: tn("about") },
      ],
    },
    {
      heading: t("legalHeading"),
      links: [
        { href: "/terms", label: t("terms") },
        { href: "/privacy", label: t("privacy") },
      ],
    },
  ];

  const assurances = [
    { Icon: ShieldCheck, title: tg("headline", { days: settings.guaranteeDays }), body: th("trust1Body") },
    {
      Icon: Truck,
      title: ts("freeOver", {
        amount: format.number(toMajor(settings.freeShippingThresholdSen), "currencyWhole"),
      }),
      body: ts("peninsular"),
    },
    { Icon: MessageCircle, title: tw("realAdvice"), body: tw("realAdviceBody") },
  ];

  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface-sunken">
      {/* Reassurance strip — the last thing a hesitant buyer reads. Hairline
          grid: gap-px over a border-coloured ground draws the dividers at every
          breakpoint without per-cell border logic. */}
      <div className="border-b border-border-subtle">
        <ul className="container-page grid gap-px py-0 sm:grid-cols-3">
          {assurances.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3 py-8 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <Icon className="mt-0.5 size-5 shrink-0 text-clay-600" aria-hidden="true" />
              <div>
                <p className="font-display text-[15px]">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="container-page py-12 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2.6fr] lg:gap-12">
          <div className="flex flex-col gap-6">
            <Wordmark className="h-8 w-auto" />
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
              {t("tagline", { days: settings.guaranteeDays })}
            </p>
            <a
              href={whatsappUrl(settings.whatsappNumber, tw("greeting"))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border-default px-4 py-2.5 text-sm transition-colors duration-300 hover:border-clay-400 hover:text-clay-700"
            >
              <WhatsAppIcon className="size-4" />
              {t("chatWithUs")}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-8">
            {columns.map((column) => (
              <div key={column.heading}>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                  {column.heading}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <LeafRule className="my-10 md:my-12" />

        <div className="flex flex-col gap-6 text-xs leading-relaxed text-text-tertiary lg:flex-row lg:items-start lg:justify-between">
          <p className="max-w-2xl">{t("rights", { year: new Date().getFullYear() })}</p>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <LocaleSwitcher className="px-0" />
            <p>{t("payments")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
