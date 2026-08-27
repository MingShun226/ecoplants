import { ArrowUpRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { PlantImage } from "@/components/brand/plant-image";
import { CareLine, PetSafetyBadge } from "@/components/features/care";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { toMajor } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { fromPriceSen, inStock, totalStock, type Product } from "@/types/catalog";

/**
 * One card across every grid context, sized by its slot via container queries.
 *
 * The design is a frameless portrait plate: the plant sits on a sunken warm
 * ground with no border to fight the photography, lifts on a soft shadow when
 * hovered, and an arrow chip rises from the corner (the whole card is the link;
 * the chip just says so). Type below stays in the site's ledger voice — quiet
 * small-caps fact line, serif name, price as the anchor.
 */
export function PlantCard({
  product,
  priority,
  className,
}: {
  product: Product;
  priority?: boolean;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("product");
  const tb = useTranslations("badges");
  const ta = useTranslations("actions");
  const format = useFormatter();
  const tr = product.t[locale];

  const soldOut = !inStock(product);
  const stock = totalStock(product);
  const lowStock = !soldOut && stock <= 5;
  const multipleSizes = product.variants.length > 1;

  return (
    <article className={cn("@container group relative", className)}>
      <Link
        href={`/plants/${tr.slug}`}
        className="block focus-visible:outline-none"
        aria-label={tr.name}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-xl bg-surface-sunken",
            "transition-shadow duration-500 ease-refined",
            "group-hover:shadow-[0_28px_56px_-28px_oklch(0.28_0.02_55/0.30)]",
          )}
        >
          <div className="relative aspect-4/5 w-full overflow-hidden">
            <PlantImage
              product={product}
              priority={priority}
              sizes="(max-width: 768px) 50vw, 25vw"
              className={cn(
                "transition-transform duration-[900ms] ease-refined group-hover:scale-[1.045]",
                soldOut && "opacity-60 saturate-50",
              )}
            />
          </div>

          {/* One pill, bottom-left, never two. Badges pinned to opposite top
              corners overlapped as soon as the card was narrower than the sum
              of their labels — every two-up grid on a phone. Wrapping them was
              a patch; carrying a single label is the fix, and it reads at a
              glance the way a shelf tag does.

              The order is a priority, not a preference: sold out overrides
              everything because it changes whether you can buy at all, then
              new, which is the reason to look now and the one label that stops
              being true on its own, then the plant's own badge. Pet safety is
              not in this stack — it is a fact about the plant rather than a
              status, and it sits with the care line below. */}
          {soldOut ? (
            <span className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-full bg-ink-950/85 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-ink-50 backdrop-blur-sm">
              {ta("soldOut")}
            </span>
          ) : product.isNew ? (
            <span className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-full bg-leaf-800 px-2.5 py-1 text-[10px] uppercase tracking-widest text-ink-50">
              {tb("newArrival")}
            </span>
          ) : product.badges[0] ? (
            <span className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-full border border-clay-300/80 bg-canvas/90 px-2.5 py-1 text-[10px] uppercase tracking-widest text-clay-800 backdrop-blur-sm">
              {tb(product.badges[0])}
            </span>
          ) : null}

          {/* Top-right, diagonally opposite the status pill. The two used to
              share the top edge and collided on any narrow card; separating
              them by corner means they cannot meet at any width, which beats
              wrapping them and beats moving this one below the image, where it
              pushed the name and price out of line with the cards beside it. */}
          {product.attributes.petSafe === true ? (
            <span className="pointer-events-none absolute right-3.5 top-3.5">
              <PetSafetyBadge petSafe className="bg-canvas/90 backdrop-blur-sm" />
            </span>
          ) : null}

          {/* Rising arrow chip — the whole card is already the link. */}
          <span
            aria-hidden="true"
            className="absolute bottom-3.5 right-3.5 flex size-9 translate-y-2 items-center justify-center rounded-full bg-canvas/95 text-ink-900 opacity-0 shadow-sm backdrop-blur-sm transition-all duration-300 ease-refined group-hover:translate-y-0 group-hover:opacity-100"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-1.5 px-0.5">
          <CareLine attributes={product.attributes} />

          <h3 className="font-display text-[17px] font-normal leading-snug transition-colors duration-300 group-hover:text-clay-800 @[15rem]:text-lg">
            {tr.name}
          </h3>

          <p className="font-display text-xs italic text-text-tertiary">
            {product.nameBotanical}
          </p>

          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="numeric text-[15px] font-medium">
              {multipleSizes ? (
                <span className="text-xs font-normal text-text-tertiary">{t("from")} </span>
              ) : null}
              {format.number(toMajor(fromPriceSen(product)), "currency")}
            </p>
            {lowStock ? (
              <span className="flex items-center gap-1.5 text-[11px] text-warning">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                {t("onlyLeft", { count: stock })}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

export function PlantGrid({
  products,
  columns = 4,
  className,
}: {
  products: Product[];
  columns?: 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-12",
        columns === 3 ? "md:grid-cols-3" : "md:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((product, i) => (
        <PlantCard key={product.id} product={product} priority={i < 4} />
      ))}
    </div>
  );
}
