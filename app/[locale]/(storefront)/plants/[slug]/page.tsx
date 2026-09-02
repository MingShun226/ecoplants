import { Droplet, PawPrint, ShieldCheck, Star } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { LeafRule } from "@/components/brand/primitives";
import { BuyBox } from "@/components/features/buy-box";
import { ProductGallery } from "@/components/features/product-gallery";
import { VariantProvider } from "@/components/features/variant-provider";
import { CareGrid, DifficultyMeter, LightIcon, PetSafetyBadge } from "@/components/features/care";
import { PlantCard } from "@/components/features/plant-card";
import { RevealSection } from "@/components/features/reveal-section";
import { Link } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";
import { lightDetailKeys, lightKeys, waterDetailKeys, waterKeys } from "@/lib/data/facets";
import { getProductBySlug, getProducts, getRelated } from "@/lib/data/queries";
import { site } from "@/lib/data/site";
import { getSettings, whatsappUrl } from "@/lib/data/settings";
import { toMajor } from "@/lib/utils/format";
import { fromPriceSen, inStock, topPriceSen } from "@/types/catalog";

export async function generateStaticParams() {
  const products = await getProducts();
  return routing.locales.flatMap((locale) =>
    products.map((product) => ({ locale, slug: product.t[locale].slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProductBySlug(slug, locale as Locale);
  if (!product) return {};
  const tr = product.t[locale as Locale];
  return {
    title: `${tr.name} (${product.nameBotanical})`,
    description: tr.careSummary,
    alternates: {
      canonical: `/${locale}/plants/${tr.slug}`,
      // Each locale has its own slug, so hreflang has to be built per product
      // rather than by prefixing one path.
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `/${l}/plants/${product.t[l].slug}`]),
      ),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const settings = await getSettings();
  const days = settings.guaranteeDays;

  const activeLocale = (await getLocale()) as Locale;
  const product = await getProductBySlug(slug, activeLocale);
  if (!product) notFound();

  const t = await getTranslations("product");
  const tb = await getTranslations("badges");
  const tg = await getTranslations("guarantee");
  const tp = await getTranslations("pet");
  const tAttr = await getTranslations("attributes");
  const tw = await getTranslations("whatsapp");
  const ts = await getTranslations("shipping");
  const format = await getFormatter();

  const tr = product.t[activeLocale];
  const related = await getRelated(product);

  return (
    <div className="pb-24 md:pb-0">
      {/* Product JSON-LD. Prices are strings in schema.org. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: tr.name,
            alternateName: product.nameBotanical,
            description: tr.description,
            brand: { "@type": "Brand", name: site.name },
            // aggregateRating is omitted entirely when there are no reviews.
            // Google renders it as stars in search results, so declaring one
            // without reviews behind it is the most consequential place to
            // invent a number.
            ...(product.rating !== null && product.reviewCount > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: product.rating,
                    reviewCount: product.reviewCount,
                  },
                }
              : {}),
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "MYR",
              lowPrice: toMajor(fromPriceSen(product)).toFixed(2),
              highPrice: toMajor(topPriceSen(product)).toFixed(2),
              offerCount: product.variants.length,
              availability: inStock(product)
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            },
          }),
        }}
      />

      <div className="container-page pt-8 md:pt-12">
        <nav
          aria-label="Breadcrumb"
          className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary"
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-text-primary">
                EcoPlants
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={`/category/${product.categorySlug}`}
                className="transition-colors hover:text-text-primary"
              >
                {product.categorySlug.replace("-", " ")}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-text-secondary">{tr.name}</li>
          </ol>
        </nav>

        {/* The gallery and the buy box share one selected variant, so choosing
            a size changes the photograph as well as the price. The provider
            has to wrap both columns of the grid for that to be possible. */}
        <VariantProvider product={product}>
        <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Frameless plate — no border to fight the photography. */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <ProductGallery product={product} alt={tr.name} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {product.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-sm border border-clay-300 bg-clay-50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-clay-800"
                >
                  {tb(badge)}
                </span>
              ))}
              <PetSafetyBadge petSafe={product.attributes.petSafe} />
            </div>

            <DisplayHeading as="h1" lead={tr.name} size="sm" className="mt-5" />

            <p className="mt-2 font-display text-lg italic text-text-tertiary">
              {product.nameBotanical}
            </p>

            {/* Stars appear only once somebody has actually left one. An
                unreviewed plant says nothing rather than showing an empty
                five-star rail, which reads as a bad score. */}
            {product.rating !== null && product.reviewCount > 0 ? (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="flex" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={
                        i <= Math.round(product.rating!)
                          ? "size-3.5 text-clay-500"
                          : "size-3.5 text-border-default"
                      }
                      fill={i <= Math.round(product.rating!) ? "currentColor" : "none"}
                    />
                  ))}
                </span>
                <span className="numeric font-medium">{product.rating.toFixed(1)}</span>
                <a
                  href="#reviews"
                  className="text-text-tertiary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
                >
                  {t("reviews", { count: product.reviewCount })}
                </a>
              </div>
            ) : null}

            <p className="mt-6 leading-relaxed text-text-secondary">{tr.description}</p>

            <BuyBox product={product} />
          </div>
        </div>
        </VariantProvider>
      </div>

      {/* Care detail — the section generic ecommerce PDPs are missing. */}
      <section className="section-y">
        <div className="container-page">
          <RevealSection className="flex max-w-2xl flex-col gap-3">
            <DisplayHeading lead={t("careHeading")} size="sm" />
            <p className="text-[15px] leading-relaxed text-text-secondary">{tr.careSummary}</p>
          </RevealSection>

          <RevealSection className="mt-10">
            <CareGrid attributes={product.attributes} />
          </RevealSection>

          <RevealSection delay={0.08} className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle lg:grid-cols-3">
            <CareNote
              icon={<LightIcon level={product.attributes.light} className="size-5" />}
              title={tAttr(lightKeys[product.attributes.light])}
              body={tAttr(lightDetailKeys[product.attributes.light])}
            />
            <CareNote
              icon={<Droplet className="size-5" aria-hidden="true" />}
              title={tAttr(waterKeys[product.attributes.water])}
              body={tAttr(waterDetailKeys[product.attributes.water])}
            />
            <CareNote
              icon={<PawPrint className="size-5" aria-hidden="true" />}
              title={
                product.attributes.petSafe === true
                  ? tp("safeTitle")
                  : product.attributes.petSafe === false
                    ? tp("toxicTitle")
                    : tp("unverified")
              }
              body={
                tr.toxicityNote ??
                (product.attributes.petSafe === true
                  ? tp("safeDefault")
                  : tp("unverifiedDefault"))
              }
              warn={product.attributes.petSafe !== true}
            />
          </RevealSection>

          {tr.climateNote ? (
            <RevealSection delay={0.12}>
              <p className="mt-6 rounded-lg border border-leaf-200 bg-leaf-50 p-6 text-sm leading-relaxed text-text-secondary">
                <strong className="font-medium text-leaf-900">{t("inMalaysia")} </strong>
                {tr.climateNote}
              </p>
            </RevealSection>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
            <DifficultyMeter difficulty={product.attributes.difficulty} />
            <a
              href={whatsappUrl(settings.whatsappNumber, tw("aboutPlant", { plant: tr.name }))}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-clay-700 underline-offset-4 transition-colors hover:underline"
            >
              {t("askAboutPlant")}
            </a>
          </div>
        </div>
      </section>

      {/* Perishable-goods honesty. */}
      <section className="section-y border-y border-border-subtle bg-surface-sunken">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:gap-20">
          <RevealSection>
            <h2 className="flex items-center gap-2.5 font-display text-xl">
              <ShieldCheck className="size-5 text-clay-600" aria-hidden="true" />
              {tg("headline", { days })}
            </h2>
            <LeafRule className="my-6" />
            <ul className="space-y-3 text-sm leading-relaxed text-text-secondary">
              {(["term1", "term2", "term3", "term4", "term5"] as const).map((key) => (
                <li key={key} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-clay-500" />
                  {tg(key, { days })}
                </li>
              ))}
            </ul>
          </RevealSection>

          <RevealSection delay={0.1}>
            <h2 className="font-display text-xl">{t("variationHeading")}</h2>
            <LeafRule className="my-6" />
            <p className="text-sm leading-relaxed text-text-secondary">
              {product.peninsularOnly ? ts("eastMalaysia") : ts("peninsular")}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">{ts("sameDay")}</p>
            <p className="numeric mt-6 text-sm text-text-tertiary">
              {ts("freeOver", {
                amount: format.number(toMajor(settings.freeShippingThresholdSen), "currencyWhole"),
              })}
            </p>
          </RevealSection>
        </div>
      </section>

      <section id="reviews" className="section-y">
        <div className="container-page">
          <DisplayHeading lead={t("reviewsHeading")} size="sm" />
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
            {t("reviewsPending")}
          </p>
        </div>
      </section>

      <section className="section-y pt-0">
        <div className="container-page">
          <DisplayHeading lead={t("relatedHeading")} size="sm" className="mb-10" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {related.map((item, i) => (
              <RevealSection key={item.id} delay={i * 0.07}>
                <PlantCard product={item} />
              </RevealSection>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function CareNote({
  icon,
  title,
  body,
  warn = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 bg-surface p-7">
      <span className={warn ? "text-warning" : "text-clay-600"}>{icon}</span>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}
