"use client";

import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/catalog";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Where a double tap lands, and what the zoom-in button steps toward. */
const TAP_ZOOM = 2.5;

/** A drag shorter than this is a tap; longer, and it was going somewhere. */
const TAP_SLOP = 10;
/** How far sideways a one-finger drag has to go, unzoomed, to change picture. */
const SWIPE_THRESHOLD = 60;
/** Two taps closer together than this are a double tap. */
const DOUBLE_TAP_MS = 300;

/**
 * The full-screen photograph.
 *
 * **It owns its own zoom.** This used to lean on the browser's pinch — which
 * magnifies the viewport, not the picture, and took the black surround, the
 * close button and the page behind it along for the ride. It also could not be
 * asked anything: no double tap, no way to tell a pan from a swipe, and no way
 * to put it back, so zooming out left the strip stranded between two
 * photographs. Every one of those is the same bug wearing a different hat.
 *
 * So the gestures are handled here, on the picture, with `touch-action: none`
 * to stop the browser competing for them:
 *
 * - pinch with two fingers to scale about the midpoint
 * - drag with one to pan, but only while magnified
 * - drag sideways while it fits to change picture
 * - double tap to toggle between fitting and 2.5x, at the point tapped
 *
 * Built on the native `<dialog>`, which brings the focus trap, the Escape key
 * and the top layer from the platform. A pointer keeps the arrows and the zoom
 * steps in the bar, because a mouse has neither a pinch nor a swipe.
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
  const stage = useRef<HTMLDivElement>(null);

  /** 1 fits the frame. Above it the picture is magnified and can be dragged. */
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const zoomed = scale > 1.01;
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

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // A new photograph is a new thing to look at, so it arrives fitting. Adjusted
  // during render rather than in an effect, so it never paints once at the
  // outgoing picture's magnification before snapping back.
  const [seenIndex, setSeenIndex] = useState(index);
  if (seenIndex !== index) {
    setSeenIndex(index);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  const move = useCallback(
    (delta: number) => {
      if (index === null || images.length < 2) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  /**
   * Keep the picture over the frame.
   *
   * At scale `s` the picture is `s` times the frame, so it can travel half the
   * difference in each direction before an edge comes inside the frame and
   * leaves a gap. Clamping here rather than after the gesture means a drag that
   * runs past the edge simply stops, instead of springing back when released.
   */
  const clamp = useCallback((next: { x: number; y: number }, s: number) => {
    const el = stage.current;
    if (!el) return next;
    const limitX = Math.max(0, (el.clientWidth * (s - 1)) / 2);
    const limitY = Math.max(0, (el.clientHeight * (s - 1)) / 2);
    return {
      x: Math.min(limitX, Math.max(-limitX, next.x)),
      y: Math.min(limitY, Math.max(-limitY, next.y)),
    };
  }, []);

  /**
   * Zoom about a point, so what was under the finger stays under it.
   *
   * The offset is measured from the middle of the frame, so the point's
   * distance from that middle scales with the picture and the offset has to
   * absorb the difference.
   */
  const zoomAt = useCallback(
    (nextScale: number, clientX: number, clientY: number) => {
      const el = stage.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale));

      setScale((current) => {
        const ratio = s / current;
        const px = clientX - box.left - box.width / 2;
        const py = clientY - box.top - box.height / 2;
        setOffset((o) => clamp({ x: px - (px - o.x) * ratio, y: py - (py - o.y) * ratio }, s));
        return s;
      });
    },
    [clamp],
  );

  /** Step the zoom about the middle. What the buttons and the keys do. */
  const step = useCallback(
    (delta: number) => {
      const el = stage.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      zoomAt(scale + delta, box.left + box.width / 2, box.top + box.height / 2);
    },
    [scale, zoomAt],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Arrows move between photographs only while the picture fits. Once it is
      // magnified they belong to the picture, which is what a reader expects of
      // arrow keys over something that can be panned.
      if (!zoomed && e.key === "ArrowRight") move(1);
      if (!zoomed && e.key === "ArrowLeft") move(-1);
      if (e.key === "+" || e.key === "=") step(0.5);
      if (e.key === "-" || e.key === "_") step(-0.5);
      if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, move, step, zoomed, reset]);

  // ------------------------------------------------------------- gestures --

  /** Live pointers, so one finger and two are the same code path. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /**
   * The same fact, as state, because the transition below is decided during
   * render and a ref read there is not something React can see changing.
   */
  const [gesturing, setGesturing] = useState(false);
  /** What the gesture started from, so it is measured rather than accumulated. */
  const from = useRef({ dist: 0, scale: 1, offset: { x: 0, y: 0 }, x: 0, y: 0, moved: 0 });
  const lastTap = useRef(0);

  const centre = () => {
    const list = [...pointers.current.values()];
    const x = list.reduce((a, p) => a + p.x, 0) / list.length;
    const y = list.reduce((a, p) => a + p.y, 0) / list.length;
    return { x, y };
  };

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);

    const c = centre();
    from.current = {
      dist: pointers.current.size === 2 ? spread() : 0,
      scale,
      offset,
      x: c.x,
      y: c.y,
      moved: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const count = pointers.current.size;
    const c = centre();
    from.current.moved = Math.max(
      from.current.moved,
      Math.hypot(c.x - from.current.x, c.y - from.current.y),
    );

    if (count === 2 && from.current.dist > 0) {
      // Pinch. Scale from where the gesture began rather than from the last
      // frame, so rounding cannot accumulate into drift.
      const next = from.current.scale * (spread() / from.current.dist);
      zoomAt(next, c.x, c.y);
      return;
    }

    if (count === 1 && zoomed) {
      // Pan. Only while magnified: unzoomed, a sideways drag is a swipe, and
      // deciding which it was belongs at the end of the gesture.
      setOffset(
        clamp(
          {
            x: from.current.offset.x + (c.x - from.current.x),
            y: from.current.offset.y + (c.y - from.current.y),
          },
          scale,
        ),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasSingle = pointers.current.size === 1;
    const travelled = from.current.moved;
    const startX = from.current.x;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setGesturing(false);

    if (!wasSingle) return;

    // A tap: nothing moved.
    if (travelled < TAP_SLOP) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        // Toggle. Zoomed in, a double tap is how you get back out — which is
        // the step that used to leave the viewer stranded.
        if (zoomed) reset();
        else zoomAt(TAP_ZOOM, e.clientX, e.clientY);
        return;
      }
      lastTap.current = now;
      return;
    }

    // A drag, while the picture fits: that is a swipe between photographs.
    if (!zoomed && Math.abs(e.clientX - startX) > SWIPE_THRESHOLD) {
      move(e.clientX < startX ? 1 : -1);
    }
  };

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      onClose={() => {
        reset();
        onClose();
      }}
      aria-label={alt}
      className={cn(
        "m-0 h-full max-h-none w-full max-w-none bg-transparent p-0",
        "backdrop:bg-ink-950/95 backdrop:backdrop-blur-sm",
      )}
    >
      {image ? (
        <div className="flex h-full w-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="min-w-0 truncate text-[13px] text-ink-50/80">
              <span className="hidden sm:inline">{image.alt || alt}</span>
              {images.length > 1 ? (
                <span className="numeric sm:ml-2 text-ink-50/50">
                  {(index ?? 0) + 1}/{images.length}
                </span>
              ) : null}
            </p>

            <div className="flex shrink-0 items-center gap-1">
              {/* Hidden on a phone, where pinch and double tap do this and the
                  buttons would only cover the picture. */}
              <button
                type="button"
                onClick={() => step(-0.5)}
                disabled={scale <= MIN_ZOOM}
                aria-label={t("zoomOut")}
                className="hidden size-9 items-center justify-center rounded-full text-ink-50/80 transition-colors hover:bg-ink-50/10 hover:text-ink-50 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50 sm:flex"
              >
                <ZoomOut className="size-5" aria-hidden="true" />
              </button>

              <span
                aria-live="polite"
                className="numeric hidden w-10 text-center text-[12px] tabular-nums text-ink-50/70 sm:block"
              >
                {scale.toFixed(1)}&times;
              </span>

              <button
                type="button"
                onClick={() => step(0.5)}
                disabled={scale >= MAX_ZOOM}
                aria-label={t("zoomIn")}
                className="hidden size-9 items-center justify-center rounded-full text-ink-50/80 transition-colors hover:bg-ink-50/10 hover:text-ink-50 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50 sm:flex"
              >
                <ZoomIn className="size-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={close}
                aria-label={t("closeImage")}
                className="flex size-10 items-center justify-center rounded-full bg-ink-950/55 text-ink-50 backdrop-blur-sm transition-colors hover:bg-ink-950/85 sm:size-9 sm:bg-transparent"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {images.length > 1 && !zoomed ? (
              <Arrow side="left" label={t("previousImage")} onClick={() => move(-1)}>
                <ChevronLeft className="size-6" aria-hidden="true" />
              </Arrow>
            ) : null}

            {/*
              `touch-action: none` is what makes the gestures ours. Without it
              the browser claims the pinch for the viewport and the drag for the
              page, and the handlers below see a fraction of what happened.
            */}
            <div
              ref={stage}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={(e) => {
                // Only the surround, and only while the picture fits — a tap
                // beside a magnified photo is far more likely to be a missed
                // pan than a request to leave.
                if (e.target === e.currentTarget && !zoomed) close();
              }}
              className={cn(
                "flex h-full w-full touch-none select-none items-center justify-center overflow-hidden p-3 sm:p-10",
                zoomed ? "cursor-grab" : "cursor-zoom-in",
              )}
            >
              {/*
                A plain <img>, not next/image. `fill` would make the element box
                the whole frame whatever the picture's shape, so the empty space
                beside a portrait shot would count as part of the image — and
                that space is what has to close the viewer.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={image.id}
                src={image.src}
                alt={image.alt || alt}
                draggable={false}
                style={{
                  transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                  // Only while it is settling. Animating a pinch fights the
                  // fingers, which feels like lag rather than smoothness.
                  transition: gesturing ? "none" : "transform 180ms ease-out",
                }}
                className="max-h-full max-w-full object-contain will-change-transform"
              />
            </div>

            {images.length > 1 && !zoomed ? (
              <Arrow side="right" label={t("nextImage")} onClick={() => move(1)}>
                <ChevronRight className="size-6" aria-hidden="true" />
              </Arrow>
            ) : null}
          </div>

          {/* Dots, not a fraction: two or three are read faster as shapes, and
              they double as the position. Hidden while magnified, where they
              sit over the part being looked at. */}
          {images.length > 1 && !zoomed ? (
            <div className="pointer-events-none flex shrink-0 justify-center gap-1.5 pb-5 sm:hidden">
              {images.map((img, i) => (
                <span
                  key={img.id}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i === index ? "bg-ink-50" : "bg-ink-50/35",
                  )}
                />
              ))}
            </div>
          ) : null}

          <p className="hidden shrink-0 px-4 pb-4 text-center text-[12px] text-ink-50/45 sm:block sm:pb-6">
            {zoomed ? t("zoomedHint") : t("zoomHint")}
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
