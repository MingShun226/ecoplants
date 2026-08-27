import { ArrowUpRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { PlantImage } from "@/components/brand/plant-image";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { toMajor } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { fromPriceSen, inStock, totalStock, type Product } from "@/types/catalog";

/**
 * One card across every grid context, sized by its slot via container queries.
 *
 * The design is a frameless portrait plate: the plant sits on a sunken warm
 * ground with no border to fight the photography, lifts and shadows as one
 * object when hovered, and an arrow chip rises from the corner (the whole card
 * is the link; the chip just says so).
 *
 * Nothing overlays the plant and nothing summarises its care. Both were tried
 * and both cost more than they returned: four small labels competing over the
 * photograph, and a line of care shorthand answering a question nobody asks
 * while scanning a grid. Light, water, pet safety and difficulty are all
 * filters on the listing and prose on the product page, which is where someone
 * is actually deciding. What is left is what sells a plant — the plant, its
 * name, and the price.
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
        {/* With the labels gone the frame is the card, so it gets the softer
            radius and lifts as one object rather than only casting a shadow.
            `will-change` is deliberate: transform and shadow together on a grid
            of these is enough to drop frames on a mid-range phone otherwise. */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl bg-surface-sunken",
            "transition-[transform,box-shadow] duration-500 ease-refined [will-change:transform]",
            "group-hover:-translate-y-1",
            "group-hover:shadow-[0_28px_56px_-28px_oklch(0.28_0.02_55/0.30)]",
            "motion-reduce:transition-none motion-reduce:group-hover:translate-y-0",
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

          {/* Nothing is printed over the plant.

              Every label that used to sit here — the attribute badge, pet
              safety, new — is a fact you can already filter by, and none of
              them was the reason anyone stopped on a card. They were four
              small competing rectangles on top of the one thing that actually
              sells a plant. Sold out is the single exception, and it moved to
              the price line below, where an unbuyable plant says so in the
              slot you look at to decide. */}

          {/* Rising arrow chip — the whole card is already the link. */}
          <span
            aria-hidden="true"
            className="absolute bottom-3.5 right-3.5 flex size-9 translate-y-2 items-center justify-center rounded-full bg-canvas/95 text-ink-900 opacity-0 shadow-sm backdrop-blur-sm transition-all duration-300 ease-refined group-hover:translate-y-0 group-hover:opacity-100"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>

        {/* Three lines, in the order you read them: what it is, what it is
            called, what it costs. The care summary that used to head this block
            was answering a question nobody asks while browsing — it belongs on
            the product page, where there is room to say it properly, and in the
            filters, where it is actually actionable. */}
        <div className="mt-5 flex flex-col gap-1 px-0.5">
          <h3 className="font-display text-lg font-normal leading-snug transition-colors duration-300 group-hover:text-clay-800 @[15rem]:text-xl">
            {tr.name}
          </h3>

          <p className="font-display text-[12.5px] italic leading-snug text-text-tertiary">
            {product.nameBotanical}
          </p>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {soldOut ? (
              <p className="text-[13px] uppercase tracking-[0.14em] text-text-tertiary">
                {ta("soldOut")}
              </p>
            ) : (
              <p className="numeric text-[15px] font-medium">
                {multipleSizes ? (
                  <span className="text-xs font-normal text-text-tertiary">{t("from")} </span>
                ) : null}
                {format.number(toMajor(fromPriceSen(product)), "currency")}
              </p>
            )}
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
