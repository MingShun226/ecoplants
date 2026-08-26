"use client";

import { useCallback, useSyncExternalStore } from "react";
import AnimatedContent from "@/components/reactbits/AnimatedContent";

/**
 * Scroll choreography wrapper. The motion budget is 200–400ms, ease-out, no
 * spring; AnimatedContent is GSAP/ScrollTrigger based, which sequences far more
 * reliably than viewport callbacks once several elements share a scroll region.
 *
 * `reverse` is deliberately off everywhere: content that re-animates when you
 * scroll back up reads as a demo, not a shop.
 *
 * Reduced motion has to be handled here explicitly. `MotionConfig
 * reducedMotion="user"` in providers.tsx governs `motion`, not GSAP — without
 * this check the reveals would keep animating for someone who has asked the OS
 * for them to stop. The props are neutralised rather than the component being
 * swapped out, so the rendered tree is identical either way and hydration does
 * not mismatch.
 */
function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // The server cannot know the preference. Assuming "animate" matches the
    // no-JS case, where content renders visible and simply never moves.
    () => false,
  );
}

export function RevealSection({
  children,
  delay = 0,
  distance = 48,
  duration = 0.9,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <AnimatedContent
      distance={reduced ? 0 : distance}
      direction="vertical"
      duration={reduced ? 0 : duration}
      ease="power3.out"
      initialOpacity={reduced ? 1 : 0}
      animateOpacity={!reduced}
      threshold={0.15}
      delay={reduced ? 0 : delay}
      reverse={false}
    >
      <div className={className}>{children}</div>
    </AnimatedContent>
  );
}
