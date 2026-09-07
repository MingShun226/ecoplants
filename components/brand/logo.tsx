import Image from "next/image";
import { cn } from "@/lib/utils";
import logoMark from "@/public/brand/logo-mark.png";

/**
 * The brand mark and wordmark.
 *
 * The mark is the client's artwork — a monstera whose fenestrations spell
 * "eco", sitting on a terracotta crescent. It ships in the brand's own colours
 * rather than `currentColor`, because those two colours *are* the brand: a
 * monotone version on the dark hero would throw away the one thing that makes
 * it recognisable at a glance.
 *
 * The wordmark beside it stays live text, so it still inherits colour from its
 * surroundings — cream on the dark hero, ink on the shop. That split is
 * deliberate: the mark is fixed, the name adapts.
 *
 * It is set in its own face rather than the display one. The name beside the
 * leaf is a fixed piece of artwork that happens to be text, and it should not
 * be re-cast every time the headings are.
 *
 * `className` sets the height; the mark keeps its aspect ratio from there.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // `align-middle` for the places this is still used inline: without it
        // the lockup hangs off the text baseline and rides high in its row.
        "inline-flex items-center gap-2.5 align-middle text-current",
        className,
      )}
    >
      <LeafMark className="h-full w-auto" />
      {/* Its own face, not the display one — see `--font-wordmark`. Set a step
          heavier than its text weight and a touch tighter, the way lettering is
          when it is drawn rather than typed. */}
      <span className="font-wordmark text-[1.3em] font-medium leading-none tracking-[-0.01em]">
        EcoPlants
      </span>
    </span>
  );
}

/**
 * The mark on its own, for places too small for the name — a mobile header, a
 * favicon-sized slot, the panel rail.
 *
 * `priority` on the header instance only: it is above the fold on every page,
 * and a logo that pops in after first paint reads as a broken site.
 */
export function LeafMark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={logoMark}
      alt=""
      // Decorative here: every place this renders is already labelled, either by
      // the wordmark text beside it or by an aria-label on the link.
      aria-hidden="true"
      priority={priority}
      // 96px covers the largest rendered size (h-8 at 3x) without shipping the
      // 512px source to a header slot.
      sizes="96px"
      className={cn("w-auto object-contain", className)}
    />
  );
}
