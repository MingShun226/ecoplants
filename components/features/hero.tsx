import { ArrowRight, Truck } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { PlantImage } from "@/components/brand/plant-image";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { toMajor } from "@/lib/utils/format";
import greenhouse from "@/public/images/hero-nursery.webp";
import { fromPriceSen, type Product } from "@/types/catalog";

/**
 * The hero: what the shop is, in one screen, on the page's own cream ground.
 *
 * Copy on the left, a small collage on the right — a plant you can buy today
 * under an arch, the greenhouse it comes from, and the one promise that sets
 * this shop apart (packed at the nursery, driven to you).
 *
 * A server component with CSS-only entrance motion (`rise-in-lg`), so the
 * markup is complete and visible even if no bundle ever loads.
 *
 * The plant in the arch is a real product, passed in, and the whole tile links
 * to it. With nothing in the catalogue the arch shows the greenhouse instead
 * and the collage drops to two tiles.
 */
export async function Hero({ product }: { product?: Product }) {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  const format = await getFormatter();
  const tr = product?.t[locale];

  return (
    <section className="container-page grid items-center gap-10 pb-16 pt-8 md:pb-24 md:pt-12 lg:grid-cols-2 lg:gap-16">
      {/* --- copy -------------------------------------------------------- */}
      <div className="flex flex-col items-start gap-6">
        <span
          className="rise-in-lg rounded-full bg-[var(--shop-butter)] px-3.5 py-1.5 text-[13px] font-semibold text-ink-950"
          style={{ animationDelay: "0.05s" }}
        >
          {t("heroBadge")}
        </span>

        <h1 className="text-[clamp(2.6rem,1.4rem+5vw,4.9rem)] leading-[1.02]">
          <span className="rise-in-lg block" style={{ animationDelay: "0.12s" }}>
            {t("heroTitle")}
          </span>
          <span className="display-accent rise-in-lg block" style={{ animationDelay: "0.2s" }}>
            {t("heroTitleAccent")}
          </span>
        </h1>

        <p
          className="rise-in-lg max-w-lg text-[17px] leading-relaxed text-text-secondary md:text-[19px]"
          style={{ animationDelay: "0.3s" }}
        >
          {t("heroLead")}
        </p>

        <div className="rise-in-lg mt-1 flex flex-wrap gap-3" style={{ animationDelay: "0.4s" }}>
          <Link
            href="/plants"
            className="group inline-flex items-center gap-2.5 rounded-full bg-clay-700 px-7 py-4 text-[15px] font-semibold text-ink-50 transition-colors duration-300 hover:bg-clay-800"
          >
            {t("heroCta")}
            <ArrowRight
              className="size-4 transition-transform duration-300 ease-refined group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/quiz"
            className="inline-flex items-center rounded-full border-2 border-ink-950 px-7 py-[14px] text-[15px] font-semibold transition-colors duration-300 hover:bg-ink-950 hover:text-ink-50"
          >
            {t("heroFinder")}
          </Link>
        </div>
      </div>

      {/* --- collage ----------------------------------------------------- */}
      <div
        className="rise-in-lg grid grid-cols-2 gap-3 sm:gap-4"
        style={{ animationDelay: "0.2s" }}
      >
        {/* The arch. */}
        {product && tr ? (
          <Link
            href={`/plants/${tr.slug}`}
            aria-label={tr.name}
            className="group relative row-span-2 min-h-[22rem] overflow-hidden rounded-b-[2rem] rounded-t-[999px] bg-surface-sunken sm:min-h-[30rem]"
          >
            <PlantImage
              product={product}
              priority
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="transition-transform duration-[1100ms] ease-refined group-hover:scale-[1.04]"
            />
            <span className="numeric absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-raised px-4 py-2.5 text-[13px] font-semibold shadow-sm sm:text-sm">
              {tr.name} · {format.number(toMajor(fromPriceSen(product)), "currencyWhole")}
            </span>
          </Link>
        ) : null}

        <div
          className={
            product
              ? "relative min-h-[10.5rem] overflow-hidden rounded-[2rem] bg-surface-sunken sm:min-h-[14.5rem]"
              : "relative row-span-2 min-h-[22rem] overflow-hidden rounded-b-[2rem] rounded-t-[999px] bg-surface-sunken sm:min-h-[30rem]"
          }
        >
          <Image
            src={greenhouse}
            alt={t("heroPhotoAlt")}
            fill
            priority={!product}
            sizes="(max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />
        </div>

        <div className="flex min-h-[10.5rem] flex-col justify-between gap-4 rounded-[2rem] bg-[var(--shop-green)] p-5 text-ink-50 sm:min-h-[14.5rem] sm:p-7">
          <Truck className="size-8" strokeWidth={1.6} aria-hidden="true" />
          <p className="font-display text-[17px] font-medium leading-tight sm:text-[23px]">
            {t("heroTile")}
          </p>
        </div>
      </div>
    </section>
  );
}
