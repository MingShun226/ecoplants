import { ArrowRight, Moon, PawPrint, Sun, SunMedium } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { getSettings } from "@/lib/data/settings";
import { Link } from "@/i18n/navigation";
import heroBackdrop from "@/public/images/hero-nursery.webp";

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
export async function Hero() {
  const { guaranteeDays: days } = await getSettings();
  const t = await getTranslations("home");
  const tg = await getTranslations("guarantee");

  const entries = [
    { Icon: Moon, label: t("spaceLow"), body: t("spaceLowBody"), href: "/category/indoor?light=low" },
    { Icon: SunMedium, label: t("spaceMedium"), body: t("spaceMediumBody"), href: "/category/indoor?light=bright-indirect" },
    { Icon: Sun, label: t("spaceSun"), body: t("spaceSunBody"), href: "/category/outdoor?light=direct-sun" },
    { Icon: PawPrint, label: t("spacePets"), body: t("spacePetsBody"), href: "/category/pet-safe" },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-sand-100">
      {/* A nursery yard in full morning sun: a sunlit cream wall filling the
          left two-thirds, potted stock on a galvanised bench along the right.
          Decorative — the headline already says what the page is — so it
          carries no alt text.

          This replaced a dark interior at dusk, and the section went with it.
          A hero is the one screen that decides what kind of shop this is, and
          a dark one was promising a mood the rest of the site never keeps:
          every page below it is cream. So the type here is dark-on-light now,
          and so is the header above it.

          `object-cover` means a tall viewport crops the sides. The wall is on
          the left and the plants on the right, so a centre crop on a phone
          lands on the join — which is why the scrim below carries more weight
          on small screens than on wide ones. */}
      <Image
        src={heroBackdrop}
        alt=""
        aria-hidden="true"
        fill
        // The LCP element on the site's most-visited page.
        priority
        quality={82}
        sizes="100vw"
        className="-z-10 object-cover"
      />

      {/* Scrim, now lightening rather than darkening. The wall is already almost
          white where the copy sits, but "already light" is not a contrast
          guarantee across every crop at every viewport, and the headline is the
          one thing here that has to stay readable. The flat layer carries small
          screens, where the crop is tightest and the copy runs full width over
          foliage; the angled layer weights the left on wide ones and clears
          before it reaches the plants. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[oklch(0.968_0.010_80/0.62)] lg:bg-[oklch(0.968_0.010_80/0.10)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            // The header runs transparent over this section, and on a light
            // hero it has no dark ground to sit on — the nav links landed on
            // sunlit foliage and the locale switcher on blown-out sky. This
            // band gives the top of the frame something to read against
            // without putting a hard bar back across the image.
            "linear-gradient(to bottom, oklch(0.968 0.010 80 / 0.92) 0%, oklch(0.968 0.010 80 / 0.62) 9%, transparent 19%)",
            "linear-gradient(to top, oklch(0.968 0.010 80 / 0.55) 0%, transparent 20%)",
            "linear-gradient(100deg, oklch(0.968 0.010 80 / 0.86) 0%, oklch(0.968 0.010 80 / 0.55) 38%, transparent 72%)",
          ].join(", "),
        }}
      />

      <div className="container-page grid min-h-svh items-center gap-12 pb-16 pt-28 md:pt-32 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        {/* --- copy ------------------------------------------------------ */}
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <span
            className="rise-in-lg text-[10.5px] font-medium uppercase tracking-[0.24em] text-clay-700"
            style={{ animationDelay: "0.05s" }}
          >
            {t("heroEyebrow")}
          </span>

          <h1 className="text-[clamp(2.5rem,1.3rem+4.2vw,4.25rem)] leading-[1.06] text-text-primary">
            <span className="rise-in-lg block" style={{ animationDelay: "0.12s" }}>
              {t("heroTitle")}
            </span>
            <span
              className="display-accent rise-in-lg block text-leaf-700"
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
            className="rise-in-lg group mt-2 inline-flex items-center gap-2.5 rounded-full bg-ink-950 px-7 py-3.5 text-sm font-medium text-ink-50 transition-colors duration-300 hover:bg-leaf-800"
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
          className="rise-in-lg w-full overflow-hidden rounded-xl border border-border-subtle bg-canvas/85 shadow-[0_20px_50px_-30px_oklch(0.28_0.02_55/0.35)] backdrop-blur-md"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-4">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-clay-700">
              {t("spaceEyebrow")}
            </span>
          </div>

          <div>
            {entries.map(({ Icon, label, body, href }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-3.5 border-b border-border-subtle px-6 py-4 transition-colors duration-300 last:border-b-0 hover:bg-surface-sunken"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-leaf-700" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14.5px] text-text-primary">{label}</span>
                  <span className="text-xs leading-relaxed text-text-tertiary">{body}</span>
                </span>
                <ArrowRight
                  className="mt-1 size-3.5 -translate-x-1 shrink-0 text-clay-600 opacity-0 transition-all duration-300 ease-refined group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>

          <Link
            href="/guarantee"
            className="group flex items-center justify-between gap-3 border-t border-border-subtle px-6 py-4 text-[13px] text-clay-700 transition-colors duration-300 hover:text-clay-800"
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
