"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { BotanicalPlate, inferLeafShape } from "@/components/brand/plant-image";
import { ImageLightbox } from "@/components/features/image-lightbox";
import { useSelectedVariant } from "@/components/features/variant-provider";
import { cn } from "@/lib/utils";
import type { Product, ProductImage } from "@/types/catalog";

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
/**
 * How a photograph meets its frame.
 *
 * A catalogue or lifestyle shot is *of the plant*, and filling the frame is
 * what makes a row of them read as one shelf; trimming a few centimetres of
 * studio backdrop costs nothing.
 *
 * A scale drawing and a detail shot are of the *information* — the pot
 * measurement down the side, the leaf join in the corner. Cropping those
 * removes the reason the photograph was taken. A size guide with its
 * dimensions cut off the edge is worse than no size guide, because a shopper
 * reads the part that survived and believes it.
 */
function fitFor(kind: ProductImage["kind"]): string {
  return kind === "scale" || kind === "detail"
    ? "object-contain p-2 sm:p-5"
    : "object-cover";
}

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

  /** Which photo the full-screen viewer is showing, or null while it is shut. */
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const activeIndex = active ? visible.findIndex((i) => i.id === active.id) : -1;

  return (
    <div className="flex flex-col gap-3">
      {/*
        Capped by height, not width.

        The frame is 4:5 and used to take the full width of its column, which on
        a laptop makes it taller than the screen — the photograph pushed the
        price and the size picker below the fold, so the page opened on a
        picture and no way to buy. Constraining the *width* to what a 4:5 box
        can be without exceeding 66svh tall keeps the ratio exact rather than
        clamping the height and squashing it.

        `svh` and not `vh`: on a phone `vh` is the viewport with the browser
        chrome hidden, so a 100vh-relative cap is taller than what is actually
        on screen until the address bar scrolls away. Below about 600px wide the
        cap is wider than the screen anyway, so a phone is unaffected and shows
        the photograph full width as before.
      */}
      <div className="group/frame relative mx-auto aspect-4/5 w-full max-w-[calc(66svh*0.8)] overflow-hidden rounded-xl bg-surface-sunken">
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
            className={fitFor(active.kind)}
          />
        ) : (
          <>
            <BotanicalPlate seed={product.id} shape={inferLeafShape(product)} />
            <p className="absolute bottom-3.5 left-3.5 rounded-full bg-canvas/90 px-3 py-1.5 text-[11px] text-text-tertiary backdrop-blur-sm">
              {t("illustrationNote")}
            </p>
          </>
        )}

        {/* Over the photograph rather than beside it: the thing you want to
            enlarge is the thing you point at. Always present for a screen
            reader and a keyboard, and fading up on hover for a mouse. */}
        {active ? (
          <button
            type="button"
            onClick={() => setEnlarged(activeIndex < 0 ? 0 : activeIndex)}
            aria-label={t("enlargeImage")}
            className="absolute inset-0 flex cursor-zoom-in items-end justify-end p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay-600"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-canvas/85 text-text-secondary opacity-0 shadow-subtle backdrop-blur-sm transition-opacity duration-200 group-hover/frame:opacity-100 group-focus-within/frame:opacity-100 motion-reduce:transition-none">
              <Maximize2 className="size-4" aria-hidden="true" />
            </span>
          </button>
        ) : null}
      </div>

      <ImageLightbox
        images={visible}
        index={enlarged}
        alt={alt}
        onClose={() => setEnlarged(null)}
        onIndexChange={(i) => {
          setEnlarged(i);
          // Moving in the viewer moves the page behind it, so closing does not
          // snap back to the photo the shopper started from.
          setActiveId(visible[i]?.id ?? null);
        }}
      />

      {/* One photo is not a gallery, so the strip only appears from two. */}
      {visible.length > 1 ? (
        <ul className="mx-auto grid w-full max-w-[calc(66svh*0.8)] grid-cols-4 gap-2 min-[420px]:grid-cols-5 sm:grid-cols-6 lg:grid-cols-5">
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
                    className={cn(
                      fitFor(image.kind),
                      // The strip is small enough that the main image's padding
                      // would leave almost nothing to see.
                      image.kind === "scale" || image.kind === "detail" ? "p-1" : "",
                    )}
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
