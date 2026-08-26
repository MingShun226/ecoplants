"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";

gsap.registerPlugin(ScrollTrigger);

/**
 * Site-wide smooth scrolling.
 *
 * Lenis replaces the browser's scroll with an interpolated one. Three details
 * matter and are easy to get wrong:
 *
 * 1. It must drive GSAP's ticker, otherwise ScrollTrigger reads the native
 *    scroll position while the page renders at the interpolated one, and every
 *    reveal fires at the wrong moment.
 * 2. It must be disabled outright under `prefers-reduced-motion`. Hijacked
 *    scrolling is a genuine vestibular trigger, not a taste question.
 * 3. Next restores scroll on navigation, but Lenis holds its own position and
 *    wins — so without the reset below you land halfway down the new page.
 *    This is the bug that made clicking a nav item leave you mid-page.
 *
 * The reset jumps instantly rather than animating: a 1.5s glide up the old page
 * before the new one appears reads as the site being slow, not smooth.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    const isFirstRun = previousPath.current === null;
    const changed = previousPath.current !== pathname;
    previousPath.current = pathname;

    // Only reset on an actual route change. Resetting on first mount would
    // discard the position for a URL that arrives with an anchor (/plants/x
    // #reviews) or a restored scroll offset.
    if (isFirstRun || !changed) return;
    if (window.location.hash) return;

    lenisRef.current?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      // Exponential ease-out: quick to respond, long slow settle. A linear ramp
      // is what makes smooth scroll feel like mud.
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      // Touch devices already interpolate natively; layering Lenis on top
      // fights the platform and feels laggy.
      syncTouch: false,
    });

    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return null;
}
