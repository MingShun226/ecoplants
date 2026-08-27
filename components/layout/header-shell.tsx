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
 * The landing page opens on a full-bleed hero, so the header sits transparent
 * over it and resolves to the solid cream bar once the hero scrolls away. Every
 * other route starts solid.
 *
 * It used to invert to light-on-dark over that first screen, because the hero
 * was a dark interior. The hero is a sunlit nursery now, so the type stays dark
 * throughout and only the background and border change — which is the quieter
 * transition anyway: nothing about the header needs to re-render its colours
 * mid-scroll except the surface it sits on.
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
  const overHero = isImmersive && !scrolled;

  return (
    <header
      data-over-hero={overHero ? "" : undefined}
      // Radix scroll-lock (selects, sheets) hides the page scrollbar and pads
      // <body> to compensate — but a fixed element sits outside <body>'s
      // padding, so without the same gap its centred content slides right while
      // the lock is held. react-remove-scroll publishes the gap as
      // --removed-body-scroll-bar-size; mirror it here.
      style={{ paddingRight: "var(--removed-body-scroll-bar-size, 0px)" }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,color] duration-500 ease-refined",
        "text-text-primary",
        overHero
          ? "border-b border-transparent bg-transparent"
          : "border-b border-border-subtle bg-canvas/85 backdrop-blur-md",
      )}
    >
      {/* The guarantee strip is the site's central claim, so it stays visible
          in both states — only its rule weight changes. */}
      <div
        className={cn(
          "hidden transition-colors duration-500 md:block",
          overHero ? "border-b border-border-subtle/50" : "border-b border-border-subtle/70",
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
