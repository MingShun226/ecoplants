"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * See the picture properly, from the panel.
 *
 * Every image in the admin is a thumbnail — 64px beside a category, a square
 * tile on a product — which is enough to tell one photograph from another and
 * not enough to check the thing you actually opened the panel to check: whether
 * the crop took the top off the plant, whether the size guide's numbers are
 * legible, whether the cover is the shot you meant.
 *
 * Deliberately not the storefront's viewer. That one reads its labels from
 * `next-intl`, and the panel has no translations — it is English-only and lives
 * outside `[locale]` (ADR 0006), so calling it here would throw. It also
 * carries a strip, arrows and zoom steps for a shopper comparing photographs,
 * where this answers one question and closes.
 *
 * Built on the native `<dialog>` for the same reason as the storefront's: the
 * focus trap, the Escape key and the top layer come from the platform.
 */
export function ImagePreview({
  src,
  alt,
  className,
  children,
}: {
  src: string;
  alt: string;
  /** Applied to the trigger, which wraps whatever thumbnail is passed in. */
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // `showModal()` is what puts the dialog in the top layer and makes the rest
  // of the page inert; rendering `open` as an attribute does neither.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge ${alt}`}
        className={cn(
          "group/preview relative block overflow-hidden",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600",
          className,
        )}
      >
        {children}
        {/* Fades up under the cursor rather than sitting on the thumbnail: the
            panel is dense, and a permanent icon on every image is noise. */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/45 opacity-0 transition-opacity duration-200 group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100 motion-reduce:transition-none">
          <Maximize2 className="size-4 text-ink-50" aria-hidden="true" />
        </span>
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label={alt}
        className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-ink-950/90 backdrop:backdrop-blur-sm"
      >
        {open ? (
          <div
            // Anything that is not the picture closes it, which on a screen
            // showing one picture is most of the screen.
            onClick={(e) => {
              if (e.target === e.currentTarget) ref.current?.close();
            }}
            className="flex h-full w-full items-center justify-center p-6 sm:p-12"
          >
            {/*
              A plain <img> sized by max-width and max-height, so the element
              box is the picture. A filled `next/image` would make it the whole
              screen, and the empty space beside a portrait shot — the space
              that has to close this — would count as part of the image.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full select-none object-contain"
            />

            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-ink-950/60 text-ink-50 backdrop-blur-sm transition-colors hover:bg-ink-950/85"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
