"use client";

import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FITTED,
  clampScale,
  clampView,
  pinchView,
  zoomAbout,
  type View,
} from "@/lib/ui/zoom";
import type { ProductImage } from "@/types/catalog";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Where a double tap lands, and the step the buttons move by. */
const TAP_ZOOM = 2.5;

/** A drag shorter than this is a tap; longer, and it was going somewhere. */
const TAP_SLOP = 10;
/** How far sideways a drag has to go, unzoomed, to change picture. */
const SWIPE_X = 60;
/** How far down it has to go to dismiss. */
const SWIPE_Y = 110;
/** Two taps closer together than this are a double tap. */
const DOUBLE_TAP_MS = 300;

/**
 * The full-screen photograph.
 *
 * **It owns its own zoom.** Borrowing the browser's pinch magnifies the
 * viewport rather than the picture, which took the black surround and the close
 * button along with it, left a double tap with nothing listening, and stranded
 * the strip between two photographs on the way back out.
 *
 * So the gestures are handled here, on the picture, with `touch-action: none`
 * to stop the browser competing:
 *
 * - pinch to scale about the midpoint
 * - drag to pan, while magnified
 * - drag sideways, while it fits, to change picture
 * - drag downwards, while it fits, to dismiss — the picture follows the finger
 * - double tap to toggle between fitting and 2.5x, at the point tapped
 *
 * The live transform lives in a ref and is mirrored into state for rendering.
 * A pinch fires pointer events faster than React commits, and reading the last
 * committed value each time made a gesture fight its own history — which is
 * what made zooming appear to shift the picture sideways.
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
  const picture = useRef<HTMLImageElement>(null);

  /** The truth during a gesture. */
  const live = useRef<View>({ ...FITTED });
  /** The same thing, for rendering. */
  const [view, setView] = useState<View>({ ...FITTED });
  /** How far a dismissal drag has come. Separate, because it is not a pan. */
  const [dismiss, setDismiss] = useState(0);

  const zoomed = view.scale > 1.01;
  const open = index !== null;
  const image = open ? images[index] : null;

  const apply = useCallback((next: View) => {
    live.current = next;
    setView(next);
  }, []);

  const reset = useCallback(() => {
    apply({ ...FITTED });
    setDismiss(0);
  }, [apply]);

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

  // A new photograph is a new thing to look at, so it arrives fitting. Adjusted
  // during render rather than in an effect, so it never paints once at the
  // outgoing picture's magnification before snapping back.
  const [seenIndex, setSeenIndex] = useState(index);
  if (seenIndex !== index) {
    setSeenIndex(index);
    setView({ ...FITTED });
    setDismiss(0);
  }

  /**
   * Keep the gesture's copy in step with the rendered one.
   *
   * `apply` writes both at once, so within a gesture the ref is already
   * current — this is for the changes that come from elsewhere: a new
   * photograph, a keypress, the buttons. Writing the ref during render instead
   * would be a side effect in a place React is free to run twice.
   */
  useEffect(() => {
    live.current = view;
  }, [view]);

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
   * Measured against the *picture*, not the frame. The image is fitted, so at
   * rest it is usually narrower or shorter than the stage — clamping to the
   * stage let it be dragged until an edge came inside and left a gap, and
   * yanked it back on the next zoom. What can travel is half of however much
   * the scaled picture overflows the stage, which is nothing at all until it
   * is larger than the stage in that direction.
   */
  /** Measure the frame, then let `clampView` decide. */
  const clamp = useCallback((next: View): View => {
    const box = stage.current;
    const img = picture.current;
    if (!box || !img) return next;

    return clampView(next, {
      // `offsetWidth` is the laid-out size, unaffected by the transform — which
      // is what the arithmetic wants. The stage is measured including its
      // padding, because a magnified picture covers that too.
      imageWidth: img.offsetWidth,
      imageHeight: img.offsetHeight,
      stageWidth: box.clientWidth,
      stageHeight: box.clientHeight,
    });
  }, []);

  /**
   * Zoom about a point, so what is under the fingers stays under them.
   *
   * The offset is measured from the middle of the stage, so a point's distance
   * from that middle grows with the picture and the offset has to absorb the
   * difference: a point at `p` sits over image coordinate `(p - x) / scale`,
   * and holding it still across a scale change is the line below.
   */
  /** Zoom about a point on screen. What a double tap and the buttons do. */
  const zoomAt = useCallback(
    (nextScale: number, clientX: number, clientY: number) => {
      const box = stage.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();

      apply(
        clamp(
          zoomAbout(
            live.current,
            clampScale(nextScale, MIN_ZOOM, MAX_ZOOM),
            clientX - rect.left - rect.width / 2,
            clientY - rect.top - rect.height / 2,
          ),
        ),
      );
    },
    [apply, clamp],
  );

  /** Step the zoom about the middle. What the buttons and the keys do. */
  const step = useCallback(
    (delta: number) => {
      const box = stage.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      zoomAt(live.current.scale + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAt],
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

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** What the gesture started from, so it is measured rather than accumulated. */
  const from = useRef({ dist: 0, view: FITTED, x: 0, y: 0, moved: 0 });
  /**
   * Which way a one-finger drag turned out to be going.
   *
   * Decided once, a few pixels in, and held for the rest of the gesture — so a
   * swipe that drifts does not switch from changing the picture to dismissing
   * it halfway through.
   */
  const axis = useRef<"x" | "y" | null>(null);
  const lastTap = useRef(0);
  const [gesturing, setGesturing] = useState(false);

  const centre = () => {
    const list = [...pointers.current.values()];
    return {
      x: list.reduce((a, p) => a + p.x, 0) / list.length,
      y: list.reduce((a, p) => a + p.y, 0) / list.length,
    };
  };

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);
    axis.current = null;

    const c = centre();
    from.current = {
      dist: pointers.current.size === 2 ? spread() : 0,
      view: live.current,
      x: c.x,
      y: c.y,
      moved: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const c = centre();
    const dx = c.x - from.current.x;
    const dy = c.y - from.current.y;
    from.current.moved = Math.max(from.current.moved, Math.hypot(dx, dy));

    if (pointers.current.size === 2 && from.current.dist > 0) {
      /*
       * Pinch, solved from where the gesture began rather than stepped from
       * the frame before. `pinchView` carries the reasoning and the tests
       * beside it carry the proof — this is the measuring.
       */
      const box = stage.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const toStage = (x: number, y: number) => ({
        x: x - rect.left - rect.width / 2,
        y: y - rect.top - rect.height / 2,
      });

      apply(
        clamp(
          pinchView(
            from.current.view,
            toStage(from.current.x, from.current.y),
            toStage(c.x, c.y),
            clampScale(
              from.current.view.scale * (spread() / from.current.dist),
              MIN_ZOOM,
              MAX_ZOOM,
            ),
          ),
        ),
      );
      return;
    }

    if (pointers.current.size !== 1) return;

    if (zoomed) {
      apply(clamp({ scale: live.current.scale, x: from.current.view.x + dx, y: from.current.view.y + dy }));
      return;
    }

    // Unzoomed. Which way this drag is going gets decided once and kept.
    if (!axis.current && from.current.moved > TAP_SLOP) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    // Downwards only, and the picture follows the finger so the gesture shows
    // its own result before it is committed.
    if (axis.current === "y") setDismiss(Math.max(0, dy));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasSingle = pointers.current.size === 1;
    const { moved, x: startX, y: startY } = from.current;
    const direction = axis.current;

    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setGesturing(false);

    if (!wasSingle) return;

    // A tap: nothing moved.
    if (moved < TAP_SLOP) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        // Zoomed in, a double tap is the way back out — the step that used to
        // leave the viewer stranded.
        if (zoomed) reset();
        else zoomAt(TAP_ZOOM, e.clientX, e.clientY);
        return;
      }
      lastTap.current = now;
      return;
    }

    if (zoomed) return;

    if (direction === "x" && Math.abs(e.clientX - startX) > SWIPE_X) {
      move(e.clientX < startX ? 1 : -1);
      return;
    }

    if (direction === "y") {
      if (e.clientY - startY > SWIPE_Y) {
        ref.current?.close();
        return;
      }
      // Not far enough. Back where it came from.
      setDismiss(0);
    }
  };

  const close = () => ref.current?.close();

  /** Fades the surround as the picture is dragged away from it. */
  const dismissProgress = Math.min(1, dismiss / (SWIPE_Y * 2));

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
      style={{ opacity: 1 - dismissProgress * 0.6 }}
    >
      {image ? (
        <div className="flex h-full w-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="min-w-0 truncate text-[13px] text-ink-50/80">
              <span className="hidden sm:inline">{image.alt || alt}</span>
              {images.length > 1 ? (
                <span className="numeric text-ink-50/50 sm:ml-2">
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
                disabled={view.scale <= MIN_ZOOM}
                aria-label={t("zoomOut")}
                className="hidden size-9 items-center justify-center rounded-full text-ink-50/80 transition-colors hover:bg-ink-50/10 hover:text-ink-50 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50 sm:flex"
              >
                <ZoomOut className="size-5" aria-hidden="true" />
              </button>

              <span
                aria-live="polite"
                className="numeric hidden w-10 text-center text-[12px] tabular-nums text-ink-50/70 sm:block"
              >
                {view.scale.toFixed(1)}&times;
              </span>

              <button
                type="button"
                onClick={() => step(0.5)}
                disabled={view.scale >= MAX_ZOOM}
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
                // beside a magnified photo is far likelier to be a missed pan
                // than a request to leave.
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
                that space is what has to close the viewer. Its own box also
                being the painted box is what lets the clamp above measure
                against the picture rather than the frame.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={picture}
                key={image.id}
                src={image.src}
                alt={image.alt || alt}
                draggable={false}
                style={{
                  transform: `translate3d(${view.x}px, ${view.y + dismiss}px, 0) scale(${view.scale})`,
                  // Only while it is settling. Animating a pinch fights the
                  // fingers, which reads as lag rather than smoothness.
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
              would sit over the part being looked at. */}
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
