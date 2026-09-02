"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { BotanicalPlate, inferLeafShape } from "@/components/brand/plant-image";
import { useSelectedVariant } from "@/components/features/variant-provider";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/catalog";

/**
 * The PDP photograph, tied to the chosen variant.
 *
 * A photo carries a `variantId` when it is of one particular size and null when
 * it suits the whole product. Both are shown together for the selected variant,
 * variant-specific first — but photos belonging to a *different* variant are
 * hidden, because showing the 20cm pot while "small" is selected is not a
 * gallery, it is a misdescription.
 *
 * Choosing a size jumps to that size's own photograph when it has one. When it
 * does not, the current shot stays put rather than snapping back to the first —
 * the shopper was looking at the leaf detail for a reason, and changing pot
 * size is not a request to stop.
 */
export function ProductGallery({ product, alt }: { product: Product; alt: string }) {
  const t = useTranslations("product");
  const { variantId } = useSelectedVariant();

  const visible = useMemo(
    () => product.images.filter((i) => i.variantId === null || i.variantId === variantId),
    [product.images, variantId],
  );

  const [activeId, setActiveId] = useState<string | null>(visible[0]?.id ?? null);

  // The variant changed. `useEffect` rather than an onClick handler because the
  // selection can also come from the buy box's own controls, which know nothing
  // about this component.
  const previousVariant = useRef(variantId);
  useEffect(() => {
    if (previousVariant.current === variantId) return;
    previousVariant.current = variantId;

    const own = product.images.find((i) => i.variantId === variantId);
    if (own) {
      setActiveId(own.id);
      return;
    }
    // No photography for this size. Keep what is on screen if it is still one
    // of the shared shots, otherwise fall back to the first available.
    setActiveId((current) =>
      current && visible.some((i) => i.id === current) ? current : (visible[0]?.id ?? null),
    );
  }, [variantId, product.images, visible]);

  const active = visible.find((i) => i.id === activeId) ?? visible[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-xl bg-surface-sunken">
        {active ? (
          <Image
            // Keyed so a swap between two photos of different plants cannot
            // show the outgoing one scaled into the incoming one's frame.
            key={active.id}
            src={active.src}
            alt={active.alt || alt}
            fill
            priority
            quality={82}
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
        ) : (
          <>
            <BotanicalPlate seed={product.id} shape={inferLeafShape(product)} />
            <p className="absolute bottom-3.5 left-3.5 rounded-full bg-canvas/90 px-3 py-1.5 text-[11px] text-text-tertiary backdrop-blur-sm">
              {t("illustrationNote")}
            </p>
          </>
        )}
      </div>

      {/* One photo is not a gallery, so the strip only appears from two. */}
      {visible.length > 1 ? (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
          {visible.map((image) => {
            const current = image.id === active?.id;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(image.id)}
                  aria-current={current || undefined}
                  aria-label={image.alt || alt}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-lg bg-surface-sunken transition-[opacity,box-shadow] duration-300",
                    current
                      ? "shadow-[inset_0_0_0_2px_var(--color-clay-600)]"
                      : "opacity-70 hover:opacity-100",
                  )}
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes="96px"
                    quality={60}
                    className="object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
