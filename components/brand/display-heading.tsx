import { cn } from "@/lib/utils";

/**
 * Roman set against italic inside a single heading — "Plants that *actually
 * live here*".
 *
 * The move works because the italic is the same family, not a second face: the
 * reader registers a change in voice rather than a change in typeface. It only
 * holds if the italic is a true drawn italic (Fraunces' is) and not a slanted
 * roman, which is why the display face was chosen for its italic as much as its
 * roman.
 *
 * The accent renders in a `<span>` rather than `<em>` — this is typographic
 * emphasis for the eye, not semantic stress, and `<em>` would make a screen
 * reader read the word differently for no reason.
 */
export function DisplayHeading({
  lead,
  accent,
  as: Tag = "h2",
  size = "md",
  className,
  accentClassName,
}: {
  lead: string;
  accent?: string;
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  accentClassName?: string;
}) {
  const scale = {
    sm: "text-display-sm",
    md: "text-display-md",
    lg: "text-display-lg",
    xl: "text-display-xl",
  }[size];

  return (
    <Tag className={cn(scale, "leading-[1.04]", className)}>
      {lead}
      {accent ? (
        <>
          {" "}
          <span className={cn("display-accent", accentClassName)}>
            {accent}
          </span>
        </>
      ) : null}
    </Tag>
  );
}
