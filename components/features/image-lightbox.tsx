"use client";

import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/catalog";

/** How much bigger than the frame a zoomed photograph is drawn. */
const ZOOM = 2;

/**
 * The full-screen photograph.
 *
 * Built on the native `<dialog>` rather than a portal of our own: it takes the
 * focus trap, the Escape key, inertness of the page behind it and the top layer
 * from the platform, all of which are easy to write badly and expensive to get
 * wrong for someone using a keyboard or a screen reader.
 *
 * Two things decide the rest of the structure.
 *
 * The photograph is a plain `<img>` sized by `max-width`/`max-height` rather
 * than a filled `next/image`. A filled image's element box is the whole frame
 * whatever the picture's shape, so every click in the letterboxing either side
 * of a portrait shot lands *on the image* — which made the empty space
 * un-clickable as a way out. Sized this way the box is the picture, and
 * everything around it belongs to the backdrop and closes.
 *
 * Zoom is a bigger image inside a scrolling box, not a CSS transform. A
 * transform paints larger but leaves nothing to scroll, so a wheel over a
 * magnified photo scrolled the page behind it instead of moving the picture.
 */
export function ImageLightbox({
  images,
  index,
  alt,
  onClose,
  onIndexChange,
}: {
  images: ProductImage[];
  /** Which photo to open on. Null when the viewer is closed. */
  index: number | null;
  alt: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const t = useTranslations("product");
  const ref = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /** Where in the picture the shopper zoomed, as fractions, or null when out. */
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const open = index !== null;
  const image = open ? images[index] : null;

  // `showModal()` is what puts the dialog in the top layer and makes the rest
  // of the page inert; rendering `open` as an attribute does neither.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // A modal dialog stops clicks reaching the page but not scrolls, so without
  // this the document still moves under the viewer — and is left somewhere else
  // when it closes.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  // A new photo is a new thing to look at, so it starts unzoomed. Adjusted
  // during render rather than in an effect, so the incoming photo never paints
  // once at the outgoing one's magnification before snapping back.
  const [zoomedIndex, setZoomedIndex] = useState(index);
  if (zoomedIndex !== index) {
    setZoomedIndex(index);
    setZoom(null);
  }

  // Put the point that was clicked in the middle of the frame. Has to wait for
  // the enlarged image to exist, which is why it is an effect and not part of
  // the click handler.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !zoom) return;
    el.scrollTo({
      left: zoom.x * el.scrollWidth - el.clientWidth / 2,
      top: zoom.y * el.scrollHeight - el.clientHeight / 2,
      behavior: "instant",
    });
  }, [zoom]);

  const move = useCallback(
    (delta: number) => {
      if (index === null || images.length < 2) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, move]);

  /** Zoom towards the point clicked, so the detail stays where the eye is. */
  const toggleZoom = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom) {
      setZoom(null);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    });
  };

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={alt}
      className={cn(
        "m-0 h-full max-h-none w-full max-w-none bg-transparent p-0",
        "backdrop:bg-ink-950/90 backdrop:backdrop-blur-sm",
      )}
    >
      {image ? (
        <div className="flex h-full w-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="min-w-0 truncate text-[13px] text-ink-50/80">
              {image.alt || alt}
              {images.length > 1 ? (
                <span className="numeric ml-2 text-ink-50/50">
                  {(index ?? 0) + 1}/{images.length}
                </span>
              ) : null}
            </p>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom(zoom ? null : { x: 0.5, y: 0.5 })}
                aria-label={zoom ? t("zoomOut") : t("zoomIn")}
                className="flex size-9 items-center justify-center rounded-full text-ink-50/80 transition-colors hover:bg-ink-50/10 hover:text-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
              >
                {zoom ? (
                  <ZoomOut className="size-5" aria-hidden="true" />
                ) : (
                  <ZoomIn className="size-5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={close}
                aria-label={t("closeImage")}
                className="flex size-9 items-center justify-center rounded-full text-ink-50/80 transition-colors hover:bg-ink-50/10 hover:text-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {images.length > 1 ? (
              <Arrow side="left" label={t("previousImage")} onClick={() => move(-1)}>
                <ChevronLeft className="size-6" aria-hidden="true" />
              </Arrow>
            ) : null}

            {/*
              The scrolling box, and the way out.

              Anything in here that is not the photograph is empty space around
              it, so a click whose target is this element — or the centring box
              inside it — closes the viewer. `overscroll-contain` keeps a scroll
              that reaches the edge of a zoomed picture from continuing into the
              page underneath.
            */}
            <div
              ref={scroller}
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
              className={cn(
                "h-full w-full overscroll-contain",
                zoom ? "overflow-auto" : "flex items-center justify-center overflow-hidden",
              )}
            >
              <div
                onClick={(e) => {
                  if (e.target === e.currentTarget) close();
                }}
                className={cn(
                  "flex items-center justify-center",
                  zoom ? "min-h-full min-w-full" : "h-full w-full p-4 sm:p-10",
                )}
              >
                {/*
                  A plain <img>, not next/image. `fill` would make the element
                  box the whole frame, so the empty space beside a portrait shot
                  would be part of the picture as far as a click is concerned —
                  and that space is exactly what has to close the viewer.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={image.id}
                  src={image.src}
                  alt={image.alt || alt}
                  onClick={toggleZoom}
                  draggable={false}
                  className={cn(
                    "select-none",
                    zoom
                      ? "max-w-none cursor-zoom-out"
                      : "max-h-full max-w-full cursor-zoom-in object-contain",
                  )}
                  style={zoom ? { width: `${ZOOM * 100}%`, height: "auto" } : undefined}
                />
              </div>
            </div>

            {images.length > 1 ? (
              <Arrow side="right" label={t("nextImage")} onClick={() => move(1)}>
                <ChevronRight className="size-6" aria-hidden="true" />
              </Arrow>
            ) : null}
          </div>

          <p className="shrink-0 px-4 pb-4 text-center text-[12px] text-ink-50/45 sm:pb-6">
            {zoom ? t("zoomedHint") : t("zoomHint")}
          </p>
        </div>
      ) : null}
    </dialog>
  );
}

function Arrow({
  side,
  label,
  onClick,
  children,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/50 text-ink-50/90 backdrop-blur-sm transition-colors hover:bg-ink-950/75 hover:text-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50",
        side === "left" ? "left-2 sm:left-5" : "right-2 sm:right-5",
      )}
    >
      {children}
    </button>
  );
}
