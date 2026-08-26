import { ArrowRight, ArrowUpRight, MessageCircle, PawPrint, ShieldCheck, Truck } from "lucide-react";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { PlantImage } from "@/components/brand/plant-image";
import { RuledEyebrow } from "@/components/brand/primitives";
import { CareLine } from "@/components/features/care";
import { Hero } from "@/components/features/hero";
import { PlantCard } from "@/components/features/plant-card";
import { RevealSection } from "@/components/features/reveal-section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  categories,
  getFeaturedProducts,
  getProducts,
  getProductsByCategory,
} from "@/lib/data/queries";
import { getSettings, whatsappUrl } from "@/lib/data/settings";
import { toMajor } from "@/lib/utils/format";
import { fromPriceSen } from "@/types/catalog";

/**
 * The landing page below the hero.
 *
 * The hero sets the language: one message per screen, hairline structure, pill
 * actions, plates dissolving out of dark grounds. Every section here follows
 * it. Headers share one pattern (rule + eyebrow, display heading, action pinned
 * right); cards are unboxed or hairline-framed; the only boxes that remain are
 * ones that carry information — the ledger list, the trust grid's cells.
 */

function SectionHead({
  eyebrow,
  lead,
  accent,
  body,
  action,
}: {
  eyebrow?: string;
  lead: string;
  accent?: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <RevealSection className="mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
      <div className="flex max-w-2xl flex-col items-start gap-4">
        {eyebrow ? <RuledEyebrow>{eyebrow}</RuledEyebrow> : null}
        <DisplayHeading lead={lead} accent={accent} />
        {body ? (
          <p className="max-w-md text-[15px] leading-relaxed text-text-secondary">{body}</p>
        ) : null}
      </div>
      {action}
    </RevealSection>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const settings = await getSettings();
  const days = settings.guaranteeDays;

  const t = await getTranslations("home");
  const ta = await getTranslations("actions");
  const tg = await getTranslations("guarantee");
  const tc = await getTranslations("categories");
  const tcd = await getTranslations("categoryDescriptions");
  const tw = await getTranslations("whatsapp");
  const ts = await getTranslations("shipping");
  const tp = await getTranslations("product");
  const format = await getFormatter();
  const activeLocale = (await getLocale()) as Locale;

  const plantCategories = categories.filter((c) => c.type === "plants");

  // One round trip for the whole catalogue; every section slices from it.
  const [featured, petSafeAll] = await Promise.all([
    getFeaturedProducts(8),
    getProductsByCategory("pet-safe"),
  ]);
  const petSafe = petSafeAll.slice(0, 4);

  // One sample plant per category tile, resolved up front — an await inside the
  // JSX map is impossible, and would be a query per tile if it were not.
  const categorySamples = new Map(
    await Promise.all(
      plantCategories.map(
        async (c) => [c.slug, (await getProductsByCategory(c.slug))[0]] as const,
      ),
    ),
  );
  // One feature panel plus a ledger of four. A list beside a single image is
  // calmer than five tiles fighting for asymmetry, and holds more information
  // per pixel.
  const [collectionFeature, ...collectionRest] = featured.slice(0, 5);
  const collectionList = collectionRest.slice(0, 4);

  const trustItems = [
    { Icon: ShieldCheck, title: t("trust1Title", { days }), body: t("trust1Body") },
    { Icon: PawPrint, title: t("trust2Title"), body: t("trust2Body") },
    { Icon: Truck, title: t("trust3Title"), body: t("trust3Body") },
    { Icon: MessageCircle, title: t("trust4Title"), body: t("trust4Body") },
  ];

  return (
    <>
      <Hero plants={await getProducts()} />

      {/* ------------------------------------------------------- Categories */}
      <section className="section-y">
        <div className="container-page">
          <SectionHead
            eyebrow={t("spaceEyebrow")}
            lead={t("spaceHeading")}
            accent={t("spaceHeadingAccent")}
            body={t("spaceLead")}
            action={
              <Button asChild variant="outline" className="px-6">
                <Link href="/category/indoor">
                  {ta("seeAll")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          {/* Category tiles, unboxed: only the image is framed — a hairline that
              warms to clay on hover — and the copy sits directly on the page
              like a caption under a plate in a catalogue. */}
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {plantCategories.map((category, i) => {
              const sample = categorySamples.get(category.slug);
              return (
                <RevealSection key={category.id} delay={i * 0.08}>
                  <Link
                    href={`/category/${category.slug}`}
                    className="group block"
                  >
                    <div className="overflow-hidden rounded-lg border border-border-subtle transition-colors duration-500 ease-refined group-hover:border-clay-300">
                      <div className="relative aspect-4/5 w-full">
                        {sample ? (
                          <PlantImage
                            product={sample}
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="transition-transform duration-[1100ms] ease-refined group-hover:scale-[1.04]"
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-1.5">
                      <h3 className="font-display text-xl transition-colors duration-300 group-hover:text-clay-800">
                        {tc(category.key)}
                      </h3>
                      <p className="line-clamp-2 text-sm leading-relaxed text-text-secondary">
                        {tcd(category.key)}
                      </p>
                      <span className="mt-2 inline-flex w-fit items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-clay-700">
                        <span className="relative">
                          {ta("seeAll")}
                          {/* Underline that draws itself in — quieter than a
                              colour change, more deliberate than an instant one. */}
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-clay-500 transition-transform duration-500 ease-refined group-hover:scale-x-100"
                          />
                        </span>
                        <ArrowUpRight
                          className="size-3.5 transition-transform duration-300 ease-refined group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------- Collection (panel + ledger) */}
      {collectionFeature && collectionList.length > 0 ? (
        <section className="section-y border-t border-border-subtle bg-surface-sunken">
          <div className="container-page">
            <SectionHead
              lead={t("collectionHeading")}
              accent={t("collectionHeadingAccent")}
              body={t("collectionLead")}
            />

            <RevealSection className="grid gap-6 lg:grid-cols-12">
              {/* Feature panel — the one editorial image of the section. */}
              <Link
                href={`/plants/${collectionFeature.t[activeLocale].slug}`}
                className="group on-dark relative isolate flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-xl p-8 lg:col-span-7 lg:min-h-[26rem]"
              >
                <div className="absolute inset-0 -z-10">
                  <PlantImage
                    product={collectionFeature}
                    ground="dark"
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    className="transition-transform duration-[1200ms] ease-refined group-hover:scale-[1.04]"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent"
                />
                <h3 className="font-display text-2xl text-ink-50 md:text-3xl">
                  {collectionFeature.t[activeLocale].name}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-200">
                  {collectionFeature.t[activeLocale].tagline}
                </p>
                <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-ink-50 px-5 py-2.5 text-xs font-medium text-ink-950 transition-colors duration-300 group-hover:bg-leaf-300">
                  {ta("viewDetails")}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </span>
              </Link>

              {/* The ledger — four rows, hairline-divided, price on the right.
                  Same content as four large tiles, a quarter the ink. */}
              <div className="flex flex-col justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface lg:col-span-5">
                {collectionList.map((item) => (
                  <Link
                    key={item.id}
                    href={`/plants/${item.t[activeLocale].slug}`}
                    className="group flex flex-1 items-center gap-5 border-b border-border-subtle px-5 py-4 transition-colors duration-300 last:border-b-0 hover:bg-surface-sunken"
                  >
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border-subtle">
                      <PlantImage product={item} sizes="64px" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[14.5px] transition-colors duration-300 group-hover:text-clay-800">
                        {item.t[activeLocale].name}
                      </span>
                      <CareLine attributes={item.attributes} />
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="numeric text-[14.5px] font-medium">
                        {format.number(toMajor(fromPriceSen(item)), "currency")}
                      </span>
                      <ArrowUpRight
                        className="size-3.5 -translate-x-1 text-clay-600 opacity-0 transition-all duration-300 ease-refined group-hover:translate-x-0 group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </RevealSection>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- Featured */}
      <section className="section-y">
        <div className="container-page">
          <SectionHead
            lead={t("featuredHeading")}
            accent={t("featuredHeadingAccent")}
            action={
              <Button asChild variant="ghost">
                <Link href="/category/indoor">
                  {ta("exploreMore")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {featured.slice(0, 4).map((item, i) => (
              <RevealSection key={item.id} delay={i * 0.07}>
                <PlantCard product={item} priority={i < 2} />
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Guarantee band
          The promise, told the way this site tells everything else: as a
          ledger. Copy on the left carries the story; the board on the right
          reduces it to three entries. */}
      <section className="on-dark relative isolate overflow-hidden bg-[oklch(0.168_0.022_146)]">
        <div
          aria-hidden="true"
          className="grain pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 80% at 80% 25%, oklch(0.353 0.063 35 / 0.30) 0%, transparent 65%)",
          }}
        />
        <div className="container-page grid items-center gap-14 py-24 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-20 lg:py-32">
          <RevealSection className="flex flex-col items-start gap-6">
            <RuledEyebrow className="text-leaf-300" ruleClassName="bg-leaf-400/60">
              {t("guaranteeEyebrow")}
            </RuledEyebrow>
            <DisplayHeading
              lead={t("guaranteeHeading")}
              accent={t("guaranteeHeadingAccent")}
              size="lg"
              className="text-ink-50"
              accentClassName="text-leaf-300"
            />
            <p className="max-w-lg text-[15px] leading-relaxed text-text-secondary">
              {tg("summary")}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-ink-50 px-7 text-ink-950 hover:bg-leaf-300">
                <Link href="/guarantee">
                  {ta("readTerms")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <a
                href={whatsappUrl(settings.whatsappNumber, tw("struggling"))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-50/25 px-6 text-sm font-medium text-ink-50 transition-colors duration-300 hover:bg-ink-50/10"
              >
                {tw("sendPhoto")}
              </a>
            </div>
          </RevealSection>

          <RevealSection delay={0.12}>
            <ol className="overflow-hidden rounded-xl border border-leaf-400/30 bg-ink-950/60 backdrop-blur-md">
              {([1, 2, 3] as const).map((n) => (
                <li key={n} className="flex gap-4 border-b border-ink-50/12 px-7 py-6 last:border-b-0">
                  <span className="numeric font-display text-2xl leading-none text-leaf-300">
                    {n}
                  </span>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {t(`guaranteeStep${n}`, { days })}
                  </p>
                </li>
              ))}
            </ol>
          </RevealSection>
        </div>
      </section>

      {/* -------------------------------------------------------- Pet-safe */}
      <section className="section-y">
        <div className="container-page">
          <SectionHead
            lead={t("petSafeHeading")}
            accent={t("petSafeHeadingAccent")}
            body={t("petSafeLead")}
            action={
              <Button asChild variant="outline" className="px-6">
                <Link href="/category/pet-safe">
                  {ta("seeAll")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {petSafe.map((item, i) => (
              <RevealSection key={item.id} delay={i * 0.07}>
                <PlantCard product={item} />
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Quiz */}
      <section className="section-y-lg border-y border-border-subtle bg-surface-sunken">
        <div className="container-page">
          <RevealSection>
            <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
              <div className="flex flex-col items-start gap-5">
                <RuledEyebrow>{t("quizStatQuestions")}</RuledEyebrow>
                <DisplayHeading
                  lead={t("quizHeading")}
                  accent={t("quizHeadingAccent")}
                  size="md"
                />
                <p className="max-w-md text-[15px] leading-relaxed text-text-secondary">
                  {t("quizLead")}
                </p>
                <Button asChild size="lg" className="mt-1 px-7">
                  <Link href="/quiz">
                    {ta("takeQuiz")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              {/* Hairline grid, same construction as the trust band. */}
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle">
                {[
                  { value: "6", label: t("quizStatQuestions") },
                  { value: "60s", label: t("quizStatTime") },
                  { value: "3", label: t("quizStatPicks") },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface px-3 py-8 text-center">
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="numeric block font-display text-3xl leading-none text-leaf-800">
                        {stat.value}
                      </span>
                      <span className="mt-2 block text-[11px] leading-snug text-text-tertiary">
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ----------------------------------------------------------- Trust */}
      <section className="section-y">
        <div className="container-page">
          <RevealSection className="mx-auto mb-14 flex max-w-xl flex-col items-center gap-4 text-center">
            <DisplayHeading lead={t("trustHeading")} size="sm" />
          </RevealSection>

          <RevealSection>
            <ul className="grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
              {trustItems.map(({ Icon, title, body }) => (
                <li key={title} className="flex flex-col gap-3 bg-surface p-8">
                  <Icon className="size-5 text-clay-600" aria-hidden="true" />
                  <h3 className="font-display text-lg">{title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
                </li>
              ))}
            </ul>
          </RevealSection>
        </div>
      </section>

      {/* -------------------------------------------------------- Delivery */}
      <section className="section-y pt-0">
        <div className="container-page">
          <RevealSection>
            <div className="grid gap-10 rounded-xl border border-clay-200 bg-clay-50 p-8 md:p-12 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col items-start gap-5">
                <DisplayHeading
                  lead={t("deliveryHeading")}
                  accent={t("deliveryHeadingAccent")}
                  size="sm"
                />
                <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
                  <p>{ts("peninsular")}</p>
                  <p>{ts("sameDay")}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <p className="rounded-lg border border-clay-200 bg-surface p-5 text-sm leading-relaxed text-text-secondary">
                  <strong className="font-medium text-text-primary">
                    {ts("eastMalaysiaLabel")}
                  </strong>{" "}
                  {ts("eastMalaysia")}
                </p>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {tp("variationHeading")} —{" "}
                  {ts("freeOver", {
                    amount: format.number(
                      toMajor(settings.freeShippingThresholdSen),
                      "currencyWhole",
                    ),
                  })}
                  .
                </p>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>
    </>
  );
}
