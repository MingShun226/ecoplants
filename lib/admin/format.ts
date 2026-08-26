/**
 * Formatting for the panel.
 *
 * The storefront formats through next-intl, which is locale-aware and right for
 * customers. The panel is English-only (ADR 0006) and, more importantly, is a
 * working tool: staff read these numbers side by side all day, so they are
 * formatted once, the same way, with no locale in the mix.
 */

const MYR = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
});

/** Integer sen to "RM 149.00". */
export function formatSen(sen: number): string {
  return MYR.format(sen / 100);
}

const STAMP = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kuala_Lumpur",
});

const FULL = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kuala_Lumpur",
});

/**
 * Relative for the last day, absolute after that. "3h ago" is what you want
 * for something that just came in; "12 Aug, 14:30" is what you want for
 * anything you are reconciling.
 *
 * Pinned to Asia/Kuala_Lumpur so a server in another region does not quietly
 * shift every timestamp the warehouse reads.
 */
export function formatWhen(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return STAMP.format(then);
}

export function formatStamp(iso: string): string {
  return FULL.format(new Date(iso));
}
