import { cn } from "@/lib/utils";

/**
 * Wordmark + leaf mark. Drawn rather than imported so it inherits
 * `currentColor` and works on cream, on the dark hero and on the footer ground
 * without three separate assets. Replace when the client's final brand assets
 * land in /public/brand.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 168 32"
      className={cn("h-7 w-auto", className)}
      role="img"
      aria-label="EcoPlants"
    >
      <g fill="currentColor">
        <path d="M4 27c0-11 6.6-18.6 21-20-.6 12.6-6.8 20-16 20H4Z" opacity="0.95" />
        <path
          d="M4 27c5-5.4 9.2-8.4 14.6-11"
          stroke="var(--canvas)"
          strokeOpacity="0.5"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      <text
        x="34"
        y="23.5"
        fill="currentColor"
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontSize="21"
        fontWeight="500"
        letterSpacing="-0.4"
      >
        EcoPlants
      </text>
    </svg>
  );
}
