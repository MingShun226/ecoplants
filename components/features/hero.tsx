import { ArrowRight, Moon, PawPrint, Sun, SunMedium } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/data/settings";
import { BotanicalPlate, inferLeafShape } from "@/components/brand/plant-image";
import { Link } from "@/i18n/navigation";
import type { Product } from "@/types/catalog";

/**
 * The hero: one message, one action, one live object.
 *
 * Deliberately a server component. The entrance choreography is CSS
 * (`rise-in-lg`), so the markup is complete and correct even if no bundle ever
 * loads — a motion `initial` state would write opacity:0 into the server HTML
 * and blank the first screen on a failed bundle.
 *
 * The board beside the headline is the site's central claim in the same slot
 * where Gold puts its gold rate: not a decorative ticker, but the proof behind
 * "we only sell what survives here".
 */
export async function Hero({ plants }: { plants: Product[] }) {
  const { guaranteeDays: days } = await getSettings();
  const t = await getTranslations("home");
  const tg = await getTranslations("guarantee");

  const entries = [
    { Icon: Moon, label: t("spaceLow"), body: t("spaceLowBody"), href: "/category/indoor?light=low" },
    { Icon: SunMedium, label: t("spaceMedium"), body: t("spaceMediumBody"), href: "/category/indoor?light=bright-indirect" },
    { Icon: Sun, label: t("spaceSun"), body: t("spaceSunBody"), href: "/category/outdoor?light=direct-sun" },
    { Icon: PawPrint, label: t("spacePets"), body: t("spacePetsBody"), href: "/category/pet-safe" },
  ];

  const feature = plants[0];

  return (
    <section className="on-dark relative isolate overflow-hidden bg-[oklch(0.185_0.024_146)]">
      {/* Living backdrop: an oversized botanical plate dissolving in from the
          right, plus a warm wash. Decorative, so it carries no alt text and the
          drift gates on reduced-motion. */}
      {feature ? (
        <div
          aria-hidden="true"
          className="grain pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            maskImage: "radial-gradient(105% 115% at 84% 45%, #000 28%, transparent 74%)",
            WebkitMaskImage: "radial-gradient(105% 115% at 84% 45%, #000 28%, transparent 74%)",
          }}
        >
          <div className="hero-drift-slower absolute inset-0 scale-110">
            <BotanicalPlate
              seed={feature.id}
              shape={inferLeafShape(feature)}
              ground="dark"
              showPot={false}
            />
          </div>
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(62% 80% at 78% 22%, oklch(0.398 0.047 135 / 0.42) 0%, transparent 66%)",
        }}
      />

      <div className="container-page grid min-h-svh items-center gap-12 pb-16 pt-28 md:pt-32 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        {/* --- copy ------------------------------------------------------ */}
        <div className="flex max-w-2xl flex-col items-start gap-6 [text-shadow:0_2px_24px_oklch(0.185_0.024_146/0.85)]">
          <span
            className="rise-in-lg text-[10.5px] font-medium uppercase tracking-[0.24em] text-leaf-300"
            style={{ animationDelay: "0.05s" }}
          >
            {t("heroEyebrow")}
          </span>

          <h1 className="text-[clamp(2.5rem,1.3rem+4.2vw,4.25rem)] leading-[1.06] text-ink-50">
            <span className="rise-in-lg block" style={{ animationDelay: "0.12s" }}>
              {t("heroTitle")}
            </span>
            <span
              className="display-accent rise-in-lg block text-leaf-300"
              style={{ animationDelay: "0.2s" }}
            >
              {t("heroTitleAccent")}
            </span>
          </h1>

          <p
            className="rise-in-lg max-w-xl text-[16px] leading-relaxed text-text-secondary md:text-[17px]"
            style={{ animationDelay: "0.3s" }}
          >
            {t("heroLead")}
          </p>

          <Link
            href="/category/indoor"
            className="rise-in-lg group mt-2 inline-flex items-center gap-2.5 rounded-full bg-ink-50 px-7 py-3.5 text-sm font-medium text-ink-950 transition-colors duration-300 hover:bg-leaf-300"
            style={{ animationDelay: "0.42s" }}
          >
            {t("heroCta")}
            <ArrowRight
              className="size-4 transition-transform duration-300 ease-refined group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* --- the light board ------------------------------------------- */}
        <aside
          aria-label={t("spaceEyebrow")}
          className="rise-in-lg w-full overflow-hidden rounded-xl border border-leaf-400/30 bg-ink-950/70 backdrop-blur-md"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-ink-50/12 px-6 py-4">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-leaf-300">
              {t("spaceEyebrow")}
            </span>
          </div>

          <div>
            {entries.map(({ Icon, label, body, href }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-3.5 border-b border-ink-50/12 px-6 py-4 transition-colors duration-300 last:border-b-0 hover:bg-ink-50/5"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-leaf-300" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14.5px] text-ink-50">{label}</span>
                  <span className="text-xs leading-relaxed text-text-tertiary">{body}</span>
                </span>
                <ArrowRight
                  className="mt-1 size-3.5 -translate-x-1 shrink-0 text-leaf-300 opacity-0 transition-all duration-300 ease-refined group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>

          <Link
            href="/guarantee"
            className="group flex items-center justify-between gap-3 border-t border-ink-50/12 px-6 py-4 text-[13px] text-leaf-300 transition-colors duration-300 hover:text-leaf-200"
          >
            {tg("headline", { days })}
            <ArrowRight
              className="size-3.5 transition-transform duration-300 ease-refined group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </aside>
      </div>
    </section>
  );
}
