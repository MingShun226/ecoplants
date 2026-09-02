import { ChevronDown } from "lucide-react";
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
  collapsible = false,
  defaultOpen = false,
  className,
  children,
}: {
  title?: string;
  lead?: string;
  actions?: React.ReactNode;
  /** No body padding — tables and lists run edge to edge. */
  flush?: boolean;
  /**
   * Folds the body away behind its own header.
   *
   * For the settings on a screen that are configured once and then left alone.
   * A long page of equally-weighted cards reads as a long list of chores even
   * when most of them are already done, so the ones that are not routine work
   * collapse and let the ones that are stay open.
   *
   * Built on `<details>` rather than state, so this stays a server component
   * and folds correctly before any JavaScript arrives.
   */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const shell = cn(
    "overflow-hidden rounded-xl border border-border-subtle bg-surface",
    className,
  );
  const body = <div className={flush ? "" : "px-5 py-4"}>{children}</div>;

  const heading = (
    <div className="min-w-0">
      {title ? <h2 className="text-[14px] font-medium tracking-tight">{title}</h2> : null}
      {lead ? <p className="mt-0.5 text-xs text-text-tertiary">{lead}</p> : null}
    </div>
  );

  if (collapsible) {
    return (
      <details open={defaultOpen} className={cn(shell, "group/card")}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-sunken [&::-webkit-details-marker]:hidden">
          {heading}
          <span className="flex shrink-0 items-center gap-2">
            {actions}
            <ChevronDown
              className="size-4 text-text-tertiary transition-transform group-open/card:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>
        <div className="border-t border-border-subtle">{body}</div>
      </details>
    );
  }

  return (
    <section className={shell}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border-subtle px-5 py-3.5">
          {heading}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {body}
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
