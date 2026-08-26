import { cn } from "@/lib/utils";

/**
 * The admin content-area design system. Every panel screen composes these so
 * the whole thing reads as one calm surface:
 *
 * - AdminPage: page header (title, one-line lead, actions) plus vertical rhythm.
 * - AdminCard: THE single level of boxing. Nothing inside a card gets its own
 *   border box — internal structure is typography, whitespace and hairline
 *   dividers. `flush` is for tables and lists that should run edge to edge.
 */
export function AdminPage({
  title,
  lead,
  actions,
  children,
  className,
}: {
  title: string;
  lead?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[1.45rem] leading-tight tracking-tight">
            {title}
          </h1>
          {lead ? (
            <p className="max-w-2xl text-sm leading-relaxed text-text-tertiary">{lead}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function AdminCard({
  title,
  lead,
  actions,
  flush = false,
  className,
  children,
}: {
  title?: string;
  lead?: string;
  actions?: React.ReactNode;
  /** No body padding — tables and lists run edge to edge. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border-subtle bg-surface",
        className,
      )}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border-subtle px-5 py-3.5">
          <div className="min-w-0">
            {title ? <h2 className="text-[14px] font-medium tracking-tight">{title}</h2> : null}
            {lead ? <p className="mt-0.5 text-xs text-text-tertiary">{lead}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "" : "px-5 py-4"}>{children}</div>
    </section>
  );
}

/** Label + value, for the detail panels. */
export function AdminField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <dt className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
