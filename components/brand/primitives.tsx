import { cn } from "@/lib/utils";

/** A hairline that fades at both ends — separates sections without the hard
 *  edge of a full-width border. */
export function LeafRule({ className }: { className?: string }) {
  return <hr className={cn("rule-leaf my-0 w-full border-0", className)} />;
}

/** Short rule used as a heading accent. */
export function LeafMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block h-px w-12", className)}
      style={{ background: "var(--gradient-leaf-rule)" }}
    />
  );
}

/** Small-caps eyebrow above a section heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Eyebrow with the short rule beside it — the site's section-opening mark. */
export function RuledEyebrow({
  children,
  className,
  ruleClassName,
}: {
  children: React.ReactNode;
  className?: string;
  ruleClassName?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-clay-700",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-px w-8 bg-clay-500/70", ruleClassName)}
      />
      {children}
    </span>
  );
}

export function StatusDot({
  tone,
  className,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  className?: string;
}) {
  const colour = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-ink-400",
  }[tone];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-1.5 shrink-0 rounded-full", colour, className)}
    />
  );
}

/**
 * WhatsApp is a brand mark, so it is not in Lucide and gets a single hand-drawn
 * glyph here rather than a second icon library.
 */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5-.3.3c-.1.1-.2.3 0 .5.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.4.2.1.4.1.5-.1l.8-.9c.2-.2.3-.2.5-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.3Z" />
    </svg>
  );
}
