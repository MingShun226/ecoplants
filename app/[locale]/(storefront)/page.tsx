import { ArrowRight, MessageCircle, PawPrint, Truck } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { DisplayHeading } from "@/components/brand/display-heading";
import { BotanicalPlate, PlantImage } from "@/components/brand/plant-image";
import { RuledEyebrow } from "@/components/brand/primitives";
import { CardRail } from "@/components/features/card-rail";
import { Hero } from "@/components/features/hero";
import { PlantCard } from "@/components/features/plant-card";
import { RevealSection } from "@/components/features/reveal-section";
import { Button } from "@/components/ui/button";
import { categoryHref } from "@/lib/data/facets";
import { Link } from "@/i18n/navigation";
import {
  categories,
  getCategoryImages,
  getFeaturedProducts,
  getProductsByCategory,
} from "@/lib/data/queries";
import { getSettings, whatsappUrl } from "@/lib/data/settings";
import { toMajor } from "@/lib/utils/format";

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

  /**
   * The board below the hero asks "where will it live?", so it holds the
   * categories that answer that — a room, a balcony, a house with a cat.
   *
   * New arrivals is not one of those. It is a view of the same plants ordered
   * by when they landed, so as a tile beside Indoor and Garden it invites a
   * choice between a place and a date, which are not alternatives. It stays in
   * the nav, where a list of ways into the catalogue is exactly what is on
   * offer. Dropping it also leaves four tiles for a four-column grid, instead
   * of a fifth stranded on its own row.
   */
  /*
   * Three places a plant can live, and that is the whole idea of the section.
   *
   * "Hard to kill" was a fourth tile and is not a place — it answers a
   * different question, sits in the nav and on the listing as a filter, and
   * made a row of four read as "some categories" rather than as a choice
   * between three. New arrivals leads them, deliberately unlike the other
   * three: it is a moment, not a condition, and it should not look like one.
   */
  const placeCategories = categories.filter((c) =>
    ["indoor", "outdoor", "pet-safe"].includes(c.slug),
  );

  // One round trip for the whole catalogue; every section slices from it. The
  // pet-safe rail used to be fetched here too — a query for a section that said
  // what the category tile and the trust grid already say.
  const [featured, categoryCovers] = await Promise.all([
    getFeaturedProducts(8),
    getCategoryImages(),
  ]);

  // One sample plant per category tile, resolved up front — an await inside the
  // JSX map is impossible, and would be a query per tile if it were not.
  const categorySamples = new Map(
    await Promise.all(
      placeCategories.map(
        async (c) => [c.slug, (await getProductsByCategory(c.slug))[0]] as const,
      ),
    ),
  );
  /*
   * Three, not four.
   *
   * The guarantee had a cell here as well as the announcement bar above the
   * header, a band of its own with the three steps spelled out, and a stat in
   * the story. Saying one thing four times on one page does not make it four
   * times as believable; it makes the page long enough that none of it is read.
   * The band keeps it. This grid keeps what has nowhere else to be said.
   */
  const trustItems = [
    { Icon: PawPrint, title: t("trust2Title"), body: t("trust2Body") },
    { Icon: Truck, title: t("trust3Title"), body: t("trust3Body") },
    { Icon: MessageCircle, title: t("trust4Title"), body: t("trust4Body") },
  ];

  return (
    <>
      <Hero />

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
                <Link href="/plants">
                  {ta("seeAll")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          {/* Two-up from the smallest screen, like every other product grid on
              this page. One-up until `sm` meant five full-width tiles stacked
              end to end — 3,400px, a third of the whole mobile page, for five
              links. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-14 lg:grid-cols-4">
            {/*
              New arrivals, drawn as the odd one out on purpose.

              The other three are places — a dim corner, a bright room, a
              balcony — and each shows a plant that lives there. This is a
              moment rather than a condition, and there is no photograph that
              means "recently". So it is a panel instead of a picture: the
              shop's dark ground, the name set large, and nothing else. Sitting
              first in a row of photographs, the absence of one is what marks
              it out.
            */}
            <RevealSection>
              <Link
                href={categoryHref("new")}
                className="group on-dark-tokens relative flex aspect-4/5 flex-col justify-between overflow-hidden rounded-lg bg-ink-950 p-4 text-text-primary transition-colors duration-500 ease-refined hover:bg-ink-900 sm:p-5"
              >
                <span
                  aria-hidden="true"
                  className="grain pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background:
                      "radial-gradient(80% 60% at 25% 15%, oklch(0.322 0.039 140 / 0.75) 0%, transparent 70%)",
                  }}
                />
                <span className="relative text-[10px] uppercase tracking-[0.18em] text-leaf-300">
                  {t("newEyebrow")}
                </span>
                <span className="relative">
                  <span className="block font-display text-[19px] leading-tight sm:text-2xl">
                    {tc("newArrivals")}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
                    {ta("seeAll")}
                    <ArrowRight
                      className="size-3.5 transition-transform duration-300 ease-refined group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </Link>
            </RevealSection>

            {placeCategories.map((category, i) => {
              const sample = categorySamples.get(category.slug);
              const cover = categoryCovers.get(category.slug);
              return (
                <RevealSection key={category.id} delay={(i + 1) * 0.08}>
                  <Link
                    href={categoryHref(category.slug)}
                    className="group block"
                    title={tcd(category.key)}
                  >
                    <div className="relative overflow-hidden rounded-lg border border-border-subtle transition-colors duration-500 ease-refined group-hover:border-clay-300">
                      <div className="relative aspect-4/5 w-full bg-surface-sunken">
                        {cover ? (
                          <Image
                            src={cover}
                            alt=""
                            aria-hidden="true"
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover transition-transform duration-[1100ms] ease-refined group-hover:scale-[1.04]"
                          />
                        ) : sample ? (
                          <PlantImage
                            product={sample}
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="transition-transform duration-[1100ms] ease-refined group-hover:scale-[1.04]"
                          />
                        ) : (
                          // No cover uploaded and nothing in the category yet.
                          // The generated plate is what the rest of the site
                          // draws in place of a photograph, and a drawing is
                          // better than the hole this used to leave.
                          <BotanicalPlate seed={category.slug} shape="broad" />
                        )}
                      </div>

                      {/* The name rides the image on a solid bar rather than
                          sitting under the frame as a caption. It reads at
                          two-up on a phone, where a caption below competes with
                          the next row for which tile it belongs to — and it
                          means a category with no artwork yet still shows a
                          finished card instead of an empty box. */}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-clay-700/95 px-3.5 py-2.5 text-ink-50 backdrop-blur-sm transition-colors duration-300 group-hover:bg-clay-800/95 sm:px-4 sm:py-3">
                        {/* No truncation: "Garden & Balcony" clipped to
                            "Garden & Bal…" at two-up, and a category whose name
                            you cannot read is not a navigable card. It wraps to
                            a second line instead on the one name long enough to
                            need it. */}
                        <span className="font-display text-[13.5px] leading-tight sm:text-base">
                          {tc(category.key)}
                        </span>
                        <ArrowRight
                          className="size-4 shrink-0 transition-transform duration-300 ease-refined group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Link>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Featured */}
      <section className="section-y">
        <div className="container-page">
          <SectionHead
            lead={t("featuredHeading")}
            accent={t("featuredHeadingAccent")}
            action={
              <Button asChild variant="ghost">
                <Link href="/plants">
                  {ta("exploreMore")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          {/* The count is the cards there are, not the cards asked for. Hard-coded
              to 4, a shop with one featured plant showed "1 / 4" under a single
              card and two arrows that went nowhere. */}
          <CardRail count={Math.min(featured.length, 4)}>
            {featured.slice(0, 4).map((item, i) => (
              <RevealSection key={item.id} delay={i * 0.07}>
                <PlantCard product={item} priority={i < 2} />
              </RevealSection>
            ))}
          </CardRail>
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

      {/* ----------------------------------------------------------- Trust */}
      <section className="section-y">
        <div className="container-page">
          <RevealSection className="mx-auto mb-14 flex max-w-xl flex-col items-center gap-4 text-center">
            <DisplayHeading lead={t("trustHeading")} size="sm" />
          </RevealSection>

          <RevealSection>
            {/* Three across, because there are three. The gap is a background
                showing through, so a fourth column with nothing in it drew an
                empty panel rather than nothing at all. */}
            <ul className="grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-3">
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
