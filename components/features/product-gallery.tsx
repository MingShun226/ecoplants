"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * How a thumbnail meets its square.
 *
 * The strip is square and the photographs are 4:5, so something has to give.
 * A plant cropped to a square is still a picture of that plant; a size guide
 * cropped to a square loses the measurements down its edge, which is the
 * reason it was taken. So the informational kinds are fitted whole and the
 * rest fill the square.
 *
 * The main frame no longer needs this. Uploads are standardised to 4:5 before
 * they leave the browser, so it fits every photograph whole — see below.
 */
function thumbFit(kind: ProductImage["kind"]): string {
  return kind === "scale" || kind === "detail" ? "object-contain p-1" : "object-cover";
}

export function ProductGallery({ product, alt }: { product: Product; alt: string }) {
  const t = useTranslations("product");
  const { variantId } = useSelectedVariant();

  const visible = useMemo(
    () => product.images.filter((i) => i.variantId === null || i.variantId === variantId),
    [product.images, variantId],
  );

  const [activeId, setActiveId] = useState<string | null>(visible[0]?.id ?? null);

  const frame = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLUListElement>(null);

  /** Scroll the frame to a photograph. What a thumbnail does. */
  const goTo = useCallback((index: number) => {
    const el = frame.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, []);

  // The variant changed. `useEffect` rather than an onClick handler because the
  // selection can also come from the buy box's own controls, which know nothing
  // about this component.
  const previousVariant = useRef(variantId);
  useEffect(() => {
    if (previousVariant.current === variantId) return;
    previousVariant.current = variantId;

    // Scroll rather than set state. The strip's position is what names the
    // current photograph, so moving it is the whole of the change — and it
    // keeps this out of the business of guessing what `activeId` should become
    // while the slides themselves are being swapped underneath.
    const own = visible.findIndex((i) => i.variantId === variantId);
    if (own >= 0) goTo(own);

    // No photography for this size: the strip stays where it is. The shopper
    // was looking at the leaf detail for a reason, and changing pot size is
    // not a request to stop.
  }, [variantId, visible, goTo]);

  const active = visible.find((i) => i.id === activeId) ?? visible[0] ?? null;

  /** Which photo the full-screen viewer is showing, or null while it is shut. */
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const activeIndex = active ? visible.findIndex((i) => i.id === active.id) : -1;


  /**
   * Which photograph the strip landed on.
   *
   * The scroll position is the source of truth for both inputs: a swipe moves
   * it directly, a thumbnail moves it through `goTo`, and either way this is
   * what names the result. Setting `activeId` from a click as well would race
   * the smooth scroll and flicker the ring between two thumbnails.
   */
  const onFrameScroll = () => {
    const el = frame.current;
    if (!el || el.clientWidth === 0) return;
    const landed = visible[Math.round(el.scrollLeft / el.clientWidth)];
    if (landed && landed.id !== activeId) setActiveId(landed.id);
  };

  /** Keep the current thumbnail in view as the photographs change. */
  useEffect(() => {
    const el = strip.current;
    if (!el || activeIndex < 0) return;
    const thumb = el.children[activeIndex] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeIndex]);

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
      {/*
        One strip, two ways to drive it.

        The frame was a single photograph with a row of thumbnails under it, so
        the only way to see the next one on a phone was to reach down and tap a
        64px square — the gesture everybody actually tries, a sideways swipe,
        did nothing. It is a scroll-snapping strip now: a swipe moves it, a
        thumbnail scrolls it, and whichever it was, the landing position is what
        says which photograph is current. One mechanism, so the two inputs
        cannot disagree.

        Capped by width rather than height: the frame is 4:5 and at full column
        width on a laptop it stands taller than the screen, pushing the price
        and the size picker below the fold. Constraining the width to what a 4:5
        box can be without exceeding 66svh keeps the ratio exact instead of
        clamping the height and squashing it. `svh` because on a phone `vh` is
        the viewport with the browser chrome hidden.
      */}
      <div className="group/frame relative mx-auto aspect-4/5 w-full max-w-[calc(66svh*0.8)] overflow-hidden rounded-xl bg-surface-sunken">
        {visible.length > 0 ? (
          <div
            ref={frame}
            onScroll={onFrameScroll}
            className="scrollbar-none flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          >
            {visible.map((image, i) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setEnlarged(i)}
                aria-label={`${t("enlargeImage")} — ${image.alt || alt}`}
                className="relative h-full w-full shrink-0 cursor-zoom-in snap-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay-600"
              >
                <Image
                  src={image.src}
                  alt={image.alt || alt}
                  fill
                  priority={i === 0}
                  quality={82}
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  /*
                   * Fitted, never filled. Uploads are put on a 4:5 canvas in
                   * the browser and the frame is 4:5, so for anything uploaded
                   * since that landed this is what `object-cover` gave. The
                   * difference is photographs taken before it, which cover
                   * silently trimmed to fit.
                   */
                  className="object-contain"
                />
              </button>
            ))}
          </div>
        ) : (
          <>
            <BotanicalPlate seed={product.id} shape={inferLeafShape(product)} />
            <p className="absolute bottom-3.5 left-3.5 rounded-full bg-canvas/90 px-3 py-1.5 text-[11px] text-text-tertiary backdrop-blur-sm">
              {t("illustrationNote")}
            </p>
          </>
        )}

        {/* A hint, not a control — the photograph itself is the button. Outside
            the strip so it does not scroll away with the picture under it. */}
        {visible.length > 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-canvas/85 text-text-secondary opacity-0 shadow-subtle backdrop-blur-sm transition-opacity duration-200 group-hover/frame:opacity-100 group-focus-within/frame:opacity-100 motion-reduce:transition-none"
          >
            <Maximize2 className="size-4" />
          </span>
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

      {/*
        A filmstrip, the way a phone's photo viewer draws one.

        This was a four-column grid, which stayed four columns however many
        photographs there were — so a plant with six had two rows of squares and
        no sense of being a sequence. A row that scrolls reads as one, keeps
        every thumbnail the same size whatever the count, and puts the current
        one under a ring rather than making it the only large thing.

        One photograph is not a gallery, so it appears from two.
      */}
      {visible.length > 1 ? (
        <ul
          ref={strip}
          className="scrollbar-none mx-auto flex w-full max-w-[calc(66svh*0.8)] gap-2 overflow-x-auto px-0.5 py-0.5"
        >
          {visible.map((image, i) => {
            const current = image.id === active?.id;
            return (
              <li key={image.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={current || undefined}
                  aria-label={image.alt || alt}
                  className={cn(
                    "relative block size-16 overflow-hidden rounded-lg bg-surface-sunken transition-[opacity,box-shadow] duration-300",
                    current
                      ? "shadow-[inset_0_0_0_2px_var(--color-clay-600)]"
                      : "opacity-60 hover:opacity-100",
                  )}
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes="64px"
                    quality={60}
                    className={thumbFit(image.kind)}
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
