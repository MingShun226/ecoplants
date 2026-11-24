import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/logo";
import { LeafRule, WhatsAppIcon } from "@/components/brand/primitives";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { categoryHref } from "@/lib/data/facets";
import { Link } from "@/i18n/navigation";
import { getSettings, whatsappUrl } from "@/lib/data/settings";

export async function SiteFooter() {
  const settings = await getSettings();
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const tw = await getTranslations("whatsapp");

  const columns = [
    {
      heading: t("shopHeading"),
      links: [
        { href: "/plants", label: tn("allPlants") },
        { href: categoryHref("new"), label: tn("newArrivals") },
        { href: categoryHref("pet-safe"), label: tn("petSafe") },
        { href: categoryHref("beginner"), label: tn("beginner") },
        { href: "/category/pots", label: tn("pots") },
      ],
    },
    {
      heading: t("helpHeading"),
      links: [
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

  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface-sunken">
      <div className="container-page py-12 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2.6fr] lg:gap-12">
          <div className="flex flex-col gap-6">
            <Wordmark className="h-8 w-auto" />
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
              {t("tagline")}
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
                {/* A directory label, not a display heading. Explicitly the
                    sans: it inherits the display face from the h2 rule, and
                    Marcellus has no medium weight to give it. */}
                <h2 className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                  {column.heading}
                </h2>
                {/* `inline-block` plus vertical padding, rather than a bigger
                    gap: the padding belongs to the link, so it is part of what
                    you can tap. These were 17px tall — the height of the text
                    and nothing else — which is a hard target for a thumb on the
                    one part of the page people reach for while scrolling. */}
                <ul className="mt-3 flex flex-col gap-0.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-block py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
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
