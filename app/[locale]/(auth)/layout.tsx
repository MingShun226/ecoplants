import { ArrowLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Image from "next/image";
import authBackdrop from "@/public/images/auth-foliage.webp";
import { DisplayHeading } from "@/components/brand/display-heading";
import { Wordmark } from "@/components/brand/logo";
import { RuledEyebrow } from "@/components/brand/primitives";
import { Link } from "@/i18n/navigation";
import { getSettings } from "@/lib/data/settings";
import { toMajor } from "@/lib/utils/format";

/**
 * The auth shell: brand on the left, form on the right.
 *
 * Its own route group rather than living under `(storefront)` because these
 * screens want the full viewport — a header, a footer and a floating WhatsApp
 * button around a login form are three ways to leave.
 *
 * The point of the layout is that it **persists**. `/login` and `/signup` share
 * it, so moving between them swaps only the right-hand panel: the artwork does
 * not reload, nothing reflows, and the transition is the card turning over
 * (see `template.tsx`). They stay separate routes so the back button and a
 * pasted link both behave.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [t, ta, settings, format] = await Promise.all([
    getTranslations("account"),
    getTranslations("actions"),
    getSettings(),
    getFormatter(),
  ]);

  const stats = [
    { value: `${settings.guaranteeDays}`, label: t("statGuarantee") },
    {
      value: format.number(toMajor(settings.freeShippingThresholdSen), "currencyWhole"),
      label: t("statDelivery"),
    },
    { value: "3", label: t("statLanguages") },
  ];

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* ------------------------------------------------------------ brand */}
      {/* Hidden below `lg`, where it was costing the whole first screen: on a
          phone the panel stacked above the form and pushed every field under
          the fold, so someone arriving to sign in had to scroll past the
          marketing to reach the thing they came for. The compact header inside
          `main` carries the brand on small screens instead. */}
      <aside className="on-dark-tokens relative isolate hidden flex-col justify-between overflow-hidden bg-ink-950 px-7 py-8 text-text-primary sm:px-10 lg:flex lg:h-full lg:w-[46%] lg:px-14 lg:py-12 xl:w-1/2">
        {/*
          A photograph now, where this was two generated plates.

          It is a backdrop rather than a picture: shot into deep shade with the
          light falling only on the right, so the half of the panel the words
          sit on is close to black already. `object-cover` with the focal point
          held right keeps the lit foliage in frame as the column narrows —
          centring it would push the interesting half off the edge on a laptop
          and leave the copy over the brightest part.

          The scrim stays regardless. "Already dark" is not a contrast
          guarantee across every crop at every height, and the headline is the
          one thing here that has to stay readable.
        */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <Image
            src={authBackdrop}
            alt=""
            fill
            priority
            quality={82}
            sizes="(min-width: 1280px) 50vw, 46vw"
            className="object-cover object-right"
          />
          {/* Radial rather than linear: a linear wash leaves a visible seam
              exactly where the headline sits. */}
          <div className="grain absolute inset-0 bg-[radial-gradient(120%_90%_at_18%_78%,color-mix(in_oklab,var(--color-ink-950)_92%,transparent)_0%,color-mix(in_oklab,var(--color-ink-950)_70%,transparent)_45%,transparent_100%)]" />
        </div>

        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 text-text-primary transition-opacity hover:opacity-80"
        >
          {/* The height is not optional. `LeafMark` sizes itself with `h-full`,
              which resolves against nothing when no height is given, and the
              mark falls back to the intrinsic size of a 512px source. */}
          <Wordmark className="h-7 w-auto" />
        </Link>

        <div className="mt-10 max-w-lg lg:mt-0">
          <RuledEyebrow>{t("brandEyebrow")}</RuledEyebrow>
          <DisplayHeading
            as="h2"
            lead={t("brandHeadline")}
            accent={t("brandHeadlineAccent")}
            size="lg"
            className="mt-5"
          />
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-text-secondary">
            {t("brandBody")}
          </p>

          <dl className="mt-9 flex flex-wrap gap-x-9 gap-y-5">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="numeric block font-display text-2xl leading-none">
                    {s.value}
                  </span>
                  <span className="mt-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      {/* ------------------------------------------------------------- form */}
      <main className="flex flex-1 flex-col bg-canvas px-6 py-6 sm:px-10 lg:min-h-0 lg:overflow-y-auto lg:py-10">
        {/* One row on mobile: the way out on the left, the mark on the right.
            The wordmark is `lg:hidden` because above that the panel already
            carries it, and two wordmarks on one screen is one too many. */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {ta("backToShop")}
          </Link>

          <Wordmark className="h-6 w-auto lg:hidden" />
        </div>

        {/* perspective lives on the parent; the flipping face is in template.tsx */}
        <div className="flex flex-1 items-center justify-center [perspective:1600px]">
          <div className="w-full max-w-[25rem] py-8 lg:py-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
