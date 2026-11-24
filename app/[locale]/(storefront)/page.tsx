import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { DisplayHeading } from "@/components/brand/display-heading";
import { WhatsAppIcon } from "@/components/brand/primitives";
import { Hero } from "@/components/features/hero";
import { PlantCard } from "@/components/features/plant-card";
import { RevealSection } from "@/components/features/reveal-section";
import { categoryHref } from "@/lib/data/facets";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCategories, getCategoryImages, getFeaturedProducts } from "@/lib/data/queries";
import { quizQuestions } from "@/lib/data/quiz";
import { getSettings, whatsappUrl } from "@/lib/data/settings";
import deliveryPhoto from "@/public/images/home-delivery.webp";
import interiorPhoto from "@/public/images/home-interior.webp";

/**
 * The landing page.
 *
 * Five screens, each with one job: say what the shop is (hero), ask where the
 * plant is going (categories), show what can be bought today (featured), explain
 * how an order travels (the green band), and catch the undecided (plant finder).
 *
 * The language is soft and warm: cream ground, large rounded panels in a few
 * flat tints, a serif headline with its second half in terracotta italic.
 */

/** Flat tints for the category tiles, cycled in order. */
const TILE_TINTS = [
  "bg-[var(--shop-sage)]",
  "bg-[var(--shop-butter)]",
  "bg-[var(--shop-peach)]",
  "bg-[var(--shop-sand)]",
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const settings = await getSettings();

  const t = await getTranslations("home");
  const ta = await getTranslations("actions");
  const tw = await getTranslations("whatsapp");

  // Whatever categories the shop owner keeps, in the panel's order. Derived
  // collections ("pet-safe") are properties rather than places, and stay in
  // the filters.
  const categories = (await getCategories(locale as Locale)).filter(
    (c) => c.type === "plants" && !c.isDerived,
  );

  const [featured, categoryCovers] = await Promise.all([
    getFeaturedProducts(8),
    getCategoryImages(),
  ]);

  const steps = [1, 2, 3] as const;

  return (
    <>
      <Hero product={featured[0]} />

      {/* ------------------------------------------------------- Categories */}
      {categories.length > 0 ? (
        <section className="container-page pb-16 md:pb-24">
          <RevealSection className="mb-6 md:mb-8">
            <DisplayHeading lead={t("catsHeading")} accent={t("catsHeadingAccent")} size="sm" />
          </RevealSection>

          <div
            className={`grid grid-cols-2 gap-3 sm:gap-4 ${categories.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
          >
            {categories.map((category, i) => {
              const cover = categoryCovers.get(category.slug);
              return (
                <RevealSection key={category.id} delay={i * 0.06}>
                  <Link
                    href={categoryHref(category.slug)}
                    className={`group relative flex h-full min-h-[10rem] flex-col justify-between gap-5 overflow-hidden rounded-[1.75rem] p-5 text-ink-950 transition-transform duration-300 ease-refined hover:-translate-y-1 sm:p-6 ${
                      cover ? "bg-surface-sunken sm:min-h-[17rem]" : `sm:min-h-[11rem] ${TILE_TINTS[i % TILE_TINTS.length]}`
                    }`}
                  >
                    {/* A cover uploaded in the panel wins over the flat tint;
                        the name then rides it on a scrim. */}
                    {cover ? (
                      <>
                        <Image
                          src={cover}
                          alt=""
                          aria-hidden="true"
                          fill
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-[1100ms] ease-refined group-hover:scale-[1.04]"
                        />
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/15 to-transparent"
                        />
                      </>
                    ) : null}
                    <span aria-hidden="true" />
                    <span
                      className={`relative flex items-end justify-between gap-3 ${cover ? "text-ink-50" : ""}`}
                    >
                      <span className="font-display text-[19px] font-semibold leading-tight sm:text-2xl">
                        {category.name}
                      </span>
                      <ArrowRight
                        className="size-5 shrink-0 transition-transform duration-300 ease-refined group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </RevealSection>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- Featured */}
      {featured.length > 0 ? (
        <section className="bg-surface-sunken py-16 md:py-24">
          <div className="container-page">
            <RevealSection className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
              <DisplayHeading
                lead={t("featuredHeading")}
                accent={t("featuredHeadingAccent")}
                size="sm"
              />
              <Link
                href="/plants"
                className="inline-flex items-center gap-2 text-[15px] font-semibold underline decoration-2 underline-offset-4 hover:text-clay-700"
              >
                {ta("seeAll")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </RevealSection>

            <div
              className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${featured.length > 3 ? "xl:grid-cols-4" : ""}`}
            >
              {featured.slice(0, 8).map((item, i) => (
                <RevealSection key={item.id} delay={i * 0.05}>
                  <PlantCard product={item} priority={i < 2} />
                </RevealSection>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------- How it works */}
      <section className="container-page py-16 md:py-24">
        <RevealSection>
          <div className="flex flex-col gap-10 rounded-[2rem] bg-[var(--shop-green)] p-7 text-ink-50 sm:rounded-[2.5rem] sm:p-12 lg:p-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
              <DisplayHeading
                lead={t("howHeading")}
                accent={t("howHeadingAccent")}
                size="sm"
                className="max-w-2xl"
                accentClassName="!text-[var(--shop-butter)]"
              />
              {/* Illustrative, and the steps below say the same thing in
                  words, so it is hidden from assistive technology. */}
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[1.5rem] lg:w-[24rem] xl:w-[28rem]">
                <Image
                  src={deliveryPhoto}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 1024px) 90vw, 28rem"
                  className="object-cover"
                />
              </div>
            </div>
            <ol className="grid gap-8 md:grid-cols-3">
              {steps.map((n) => (
                <li key={n} className="flex flex-col gap-3">
                  <span className="numeric flex size-12 items-center justify-center rounded-full bg-[var(--shop-butter)] font-display text-xl font-semibold text-ink-950">
                    {n}
                  </span>
                  <h3 className="text-[22px] font-semibold leading-snug">{t(`how${n}Title`)}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-50/85">{t(`how${n}Body`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </RevealSection>
      </section>

      {/* ----------------------------------------------------- Plant finder */}
      <section className="container-page pb-16 md:pb-24">
        <RevealSection>
          <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-7 rounded-[2rem] bg-[var(--shop-peach)] p-7 text-ink-950 sm:rounded-[2.5rem] sm:p-12">
            <div className="relative hidden aspect-square w-44 shrink-0 overflow-hidden rounded-[1.5rem] lg:block xl:w-52">
              <Image
                src={interiorPhoto}
                alt=""
                aria-hidden="true"
                fill
                sizes="13rem"
                className="object-cover"
              />
            </div>
            <div className="max-w-xl flex-1">
              <DisplayHeading
                lead={t("finderHeading")}
                accent={t("finderHeadingAccent")}
                size="sm"
                accentClassName="!text-clay-800"
              />
              <p className="mt-3 text-[16px] leading-relaxed text-ink-800 md:text-[17px]">
                {t("finderBody", { count: quizQuestions.length })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/quiz"
                className="inline-flex items-center gap-2 rounded-full bg-ink-950 px-7 py-4 text-[15px] font-semibold text-ink-50 transition-colors duration-300 hover:bg-ink-800"
              >
                {t("finderCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href={whatsappUrl(settings.whatsappNumber, tw("greeting"))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink-950 px-7 py-[14px] text-[15px] font-semibold transition-colors duration-300 hover:bg-ink-950 hover:text-ink-50"
              >
                <WhatsAppIcon className="size-4" />
                {t("finderWhatsapp")}
              </a>
            </div>
          </div>
        </RevealSection>
      </section>
    </>
  );
}
