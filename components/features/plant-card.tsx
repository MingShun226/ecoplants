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
 * A soft white card on the cream page: rounded photograph, name, price in
 * terracotta, and a green arrow chip. The whole card is the link. It lifts as
 * one object on hover.
 *
 * Nothing summarises the plant's care here. Light, water, pet safety and
 * difficulty are filters on the listing and prose on the product page, which
 * is where someone is actually deciding.
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
    <article
      className={cn(
        "@container group relative h-full rounded-[1.5rem] bg-surface p-2 sm:rounded-[1.75rem] sm:p-2.5",
        "transition-[transform,box-shadow] duration-500 ease-refined [will-change:transform]",
        "hover:-translate-y-1 hover:shadow-[0_24px_48px_-28px_oklch(0.28_0.02_55/0.35)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <Link
        href={`/plants/${tr.slug}`}
        className="flex h-full flex-col focus-visible:outline-none"
        aria-label={tr.name}
      >
        {/* A soft white card holding a rounded photograph. Nothing is printed
            over the plant: every label that could sit there is a fact you can
            already filter by. */}
        <div className="relative aspect-4/5 w-full overflow-hidden rounded-[1.125rem] bg-surface-sunken sm:rounded-[1.25rem]">
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

        {/* What it is called, what it is, what it costs, and a chip that says
            the card goes somewhere. */}
        <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-3.5 sm:px-2.5 sm:pt-4">
          <h3 className="font-display text-[17px] font-semibold leading-snug @[15rem]:text-[21px]">
            {tr.name}
          </h3>

          <p className="text-[12.5px] italic leading-snug text-text-tertiary">
            {product.nameBotanical}
          </p>

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="flex flex-col gap-1">
              {soldOut ? (
                <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-text-tertiary">
                  {ta("soldOut")}
                </p>
              ) : (
                <p className="numeric text-[16px] font-semibold text-clay-700 @[15rem]:text-[18px]">
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
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--shop-green)] text-ink-50 transition-colors duration-300 group-hover:bg-[var(--shop-green-deep)] @[15rem]:size-10"
            >
              <ArrowUpRight className="size-4" />
            </span>
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
        "grid grid-cols-2 gap-3 sm:gap-5",
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
