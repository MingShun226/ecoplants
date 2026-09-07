"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Scroll position is external state, so it is read with `useSyncExternalStore`
 * rather than mirrored into `useState` from an effect. The effect version works
 * but costs an extra render on every mount and trips React's
 * set-state-in-effect rule; this subscribes directly and gives a correct server
 * snapshot for hydration.
 */
function useScrolledPast(threshold: number, enabled: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!enabled) return () => {};
      window.addEventListener("scroll", onChange, { passive: true });
      return () => window.removeEventListener("scroll", onChange);
    },
    [enabled],
  );

  const getSnapshot = useCallback(
    () => (enabled ? window.scrollY > threshold : true),
    [enabled, threshold],
  );

  // On the server there is no scroll position: an immersive route starts at the
  // top (false), every other route starts solid (true).
  const getServerSnapshot = useCallback(() => !enabled, [enabled]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Scroll-aware header chrome.
 *
 * The landing page opens on a dark hero, so the header sits transparent over it
 * in light-on-dark, then resolves to the solid cream bar once the hero scrolls
 * away. Every other route starts solid.
 *
 * The transition is on colour only — the header never changes height or
 * position, because a header that resizes on scroll makes the whole page feel
 * like it is settling rather than arriving.
 */
export function HeaderShell({
  children,
  strip,
}: {
  children: React.ReactNode;
  strip: React.ReactNode;
}) {
  const pathname = usePathname();
  const isImmersive = pathname === "/";
  const scrolled = useScrolledPast(64, isImmersive);
  const overDark = isImmersive && !scrolled;

  return (
    <header
      data-over-dark={overDark ? "" : undefined}
      // Radix scroll-lock (selects, sheets) hides the page scrollbar and pads
      // <body> to compensate — but a fixed element sits outside <body>'s
      // padding, so without the same gap its centred content slides right while
      // the lock is held. react-remove-scroll publishes the gap as
      // --removed-body-scroll-bar-size; mirror it here.
      style={{ paddingRight: "var(--removed-body-scroll-bar-size, 0px)" }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,color] duration-500 ease-refined",
        overDark
          ? [
              "on-dark-tokens border-b border-transparent bg-transparent text-ink-50",
              /*
               * A scrim of its own, because the photograph underneath is not
               * reliably dark.
               *
               * Transparent over the hero is the right look, and it was betting
               * the whole bar's legibility on whatever happened to be at the
               * top of the picture. On a greenhouse shot that is bright
               * sunlit foliage, and white-on-that is unreadable however
               * opaque the text is — which is why turning the dimming off
               * helped and did not fix it.
               *
               * Runs past the bar's own height and fades out, so there is no
               * edge where it stops; from the page it reads as the photograph
               * being darker at the top rather than as a panel behind the nav.
               */
              "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10",
              "before:h-[calc(100%+4rem)] before:bg-gradient-to-b",
              "before:from-ink-950/85 before:via-ink-950/55 before:to-transparent before:content-['']",
            ]
          : "border-b border-border-subtle bg-canvas/85 text-text-primary backdrop-blur-md",
      )}
    >
      {/* The guarantee strip is the site's central claim, so it stays visible
          in both states — it just inverts. */}
      <div
        className={cn(
          "hidden transition-colors duration-500 md:block",
          overDark ? "border-b border-ink-50/12" : "border-b border-border-subtle/70",
        )}
      >
        {strip}
      </div>
      {children}
    </header>
  );
}

/**
 * The header is fixed, so every route except the landing page needs its height
 * back as flow space. The hero supplies its own top padding and deliberately
 * runs underneath.
 */
export function HeaderSpacer() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <div aria-hidden="true" className="h-16 md:h-[7rem]" />;
}
