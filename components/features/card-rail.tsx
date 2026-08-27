"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A horizontal rail on small screens, a plain grid from `lg` up.
 *
 * The rail exists because a phone has one column of vertical budget and this
 * page has nine sections competing for it. Scrolling sideways through four
 * cards costs a swipe; scrolling past them costs two screens.
 *
 * It is CSS scroll-snap, not a carousel library — no transform maths, no
 * autoplay, no interval to clean up. The browser already knows how to scroll,
 * and native scrolling keeps momentum, keyboard, trackpad and screen-reader
 * behaviour for free. All this component adds is the position readout and two
 * buttons, both of which are progressive: with JavaScript unavailable the rail
 * still scrolls, it just does not narrate.
 *
 * The counter reports the first fully visible card, which is what "where am I"
 * means to someone dragging a rail. It is derived from scroll position rather
 * than tracked in state, because scroll can also come from a swipe, a
 * trackpad, a keyboard or a scrollbar drag, and only the element knows.
 */
export function CardRail({
  children,
  count,
  className,
  gridClassName = "lg:grid-cols-4",
}: {
  children: React.ReactNode;
  /** How many cards are inside. Drives the readout, not the layout. */
  count: number;
  className?: string;
  /** The grid the rail becomes from `lg` up. */
  gridClassName?: string;
}) {
  const t = useTranslations("actions");
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = railRef.current;
    if (!el) return;

    const step = el.scrollWidth / Math.max(count, 1);
    setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / step))));
    setAtStart(el.scrollLeft <= 1);
    // A fractional scrollWidth can leave a sub-pixel remainder at the end, so
    // this compares with a tolerance rather than for equality.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, [count]);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    // The rail becomes a grid at `lg`, where scrollLeft is always 0 — without
    // this the readout keeps whatever index it held when the window was narrow.
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const step = useCallback((direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    // One card at a time, measured off a real child rather than assumed, so
    // this keeps working if the card width changes.
    const card = el.firstElementChild as HTMLElement | null;
    const distance = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * distance, behavior: "smooth" });
  }, []);

  return (
    <div className={className}>
      <div
        ref={railRef}
        className={cn(
          // The rail bleeds to both screen edges while the first and last cards
          // still line up with the page gutter. The gutter is `container-page`'s
          // own fluid `--container-pad` — clamp(1.25rem, 0.5rem + 3vw, 4rem) —
          // so it is 20px on a small phone and 64px on a wide desktop. Pulling
          // out by a hardcoded 24px instead left the first card sitting 4px
          // proud of the heading above it at some widths and cropped at others;
          // reading the variable makes the two agree at every size.
          // `scroll-px` matters as much as `px` here. The snapport defaults to
          // the padding box, so with `snap-mandatory` the browser scrolls the
          // first card's start edge flush to it — past the left padding — and
          // the card lands hard against the screen edge, 20px proud of the
          // heading above it. Matching scroll-padding to padding puts the snap
          // line back on the gutter.
          "-mx-(--container-pad) flex snap-x snap-mandatory gap-4 overflow-x-auto px-(--container-pad) pb-1 scroll-px-(--container-pad)",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "lg:mx-0 lg:grid lg:gap-x-6 lg:gap-y-12 lg:overflow-visible lg:px-0",
          "*:w-[58%] *:shrink-0 *:snap-start sm:*:w-[38%] lg:*:w-auto",
          gridClassName,
        )}
      >
        {children}
      </div>

      {/* Hidden from `lg`, where every card is already on screen and a position
          readout would be describing something the reader can see. */}
      <div className="mt-5 flex items-center justify-center gap-4 lg:hidden">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={atStart}
          aria-label={t("previous")}
          className="flex size-8 items-center justify-center rounded-full text-text-secondary transition-opacity disabled:opacity-25"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <p className="numeric text-[12px] tabular-nums text-text-tertiary" aria-live="polite">
          {index + 1} / {count}
        </p>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={atEnd}
          aria-label={t("next")}
          className="flex size-8 items-center justify-center rounded-full text-text-secondary transition-opacity disabled:opacity-25"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
