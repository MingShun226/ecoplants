"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * `LazyMotion` with `domAnimation` keeps the animation runtime off the critical
 * path; `MotionConfig reducedMotion="user"` enforces the accessibility rule
 * globally rather than per-component.
 *
 * `strict` is deliberately off. It forbids importing the full `motion`
 * namespace, which the vendored ReactBits components in components/reactbits do
 * — keeping those close to upstream so they stay updatable is worth more than
 * the lint-level enforcement. Our own code imports from `motion/react-m`.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={200}>
          <SmoothScroll />
          {children}
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
