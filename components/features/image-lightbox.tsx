"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/catalog";

/**
 * The full-screen photograph.
 *
 * Built on the native `<dialog>` rather than a portal of our own: it takes the
 * focus trap, the Escape key, inertness of the page behind it and the top layer
 * from the platform, all of which are easy to write badly and expensive to get
 * wrong for someone using a keyboard or a screen reader.
 *
 * Zoom is a toggle, not a slider. A shopper wants to see whether the leaf edges
 * are browning, and one decisive step to 2.5× at the point they clicked answers
 * that; a continuous control turns a glance into an operation. On a touch screen
 * the browser's own pinch handles it, so there the toggle is only a shortcut.
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

  // A new photo is a new thing to look at, so it starts unzoomed. Adjusted
  // during render rather than in an effect, so the incoming photo never paints
  // once at the outgoing one's magnification before snapping back.
  const [zoomedIndex, setZoomedIndex] = useState(index);
  if (zoomedIndex !== index) {
    setZoomedIndex(index);
    setZoom(null);
  }

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

  /** Zoom towards the point that was clicked, so the detail stays under the cursor. */
  const toggleZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom) {
      setZoom(null);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    });
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={alt}
      // The backdrop is a click target for closing, so the dialog itself fills
      // the screen and the padding around the photo belongs to the figure.
      className={cn(
        "m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-text-primary",
        "backdrop:bg-ink-950/90 backdrop:backdrop-blur-sm",
      )}
      onClick={(e) => {
        // Only the backdrop. A click that started on the photo or a control has
        // that element as its target and must not close anything.
        if (e.target === ref.current) ref.current?.close();
      }}
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

            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label={t("closeImage")}
              className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-50/80 transition-colors hover:bg-ink-50/10 hover:text-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {images.length > 1 ? (
              <Arrow side="left" label={t("previousImage")} onClick={() => move(-1)}>
                <ChevronLeft className="size-6" aria-hidden="true" />
              </Arrow>
            ) : null}

            {/*
              The photo is wrapped rather than clicked directly so the zoom
              origin is measured against a box the size of the frame, not the
              letterboxed image inside it.
            */}
            <div
              role="button"
              tabIndex={0}
              aria-label={zoom ? t("zoomOut") : t("zoomIn")}
              onClick={toggleZoom}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                setZoom(zoom ? null : { x: 50, y: 50 });
              }}
              className={cn(
                "relative h-full w-full touch-pan-x touch-pan-y select-none overflow-hidden",
                zoom ? "cursor-zoom-out" : "cursor-zoom-in",
              )}
            >
              <Image
                key={image.id}
                src={image.src}
                alt={image.alt || alt}
                fill
                sizes="100vw"
                quality={90}
                priority
                className="object-contain p-4 transition-transform duration-300 ease-out motion-reduce:transition-none sm:p-10"
                style={
                  zoom
                    ? { transform: "scale(2.5)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                    : undefined
                }
              />
            </div>

            {images.length > 1 ? (
              <Arrow side="right" label={t("nextImage")} onClick={() => move(1)}>
                <ChevronRight className="size-6" aria-hidden="true" />
              </Arrow>
            ) : null}
          </div>

          <p className="shrink-0 px-4 pb-4 text-center text-[12px] text-ink-50/45 sm:pb-6">
            {t("zoomHint")}
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
