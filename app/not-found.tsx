import Link from "next/link";
import { routing } from "@/i18n/routing";

/**
 * Root-level 404, for a URL that matches **no route at all** — `/en/nonsense`,
 * or `/en/admin` before proxy.ts started redirecting it.
 *
 * Distinct from `app/[locale]/not-found.tsx`, which handles `notFound()` called
 * from inside a page (an unknown plant slug, an order id that does not exist).
 * That one renders within the locale layout and is fully translated. This one
 * has no locale context at all, so it renders in the default locale and links
 * back into it.
 *
 * **It must not render `<html>` or `<body>`.** This app has no `app/layout.tsx`
 * — there are two root layouts by design, `[locale]/layout.tsx` and
 * `(admin)/layout.tsx` (ADR 0006) — so for an unmatched URL Next has no root
 * layout to attach and wraps this in its own built-in one, which already emits
 * the document shell. Emitting a second `<html>` nests them, and React reports
 * it as a hydration mismatch on every such page.
 *
 * Inline styles because this renders outside both root layouts and therefore
 * never receives the font variables or the stylesheet.
 */
export default function RootNotFound() {
  return (
    <div
      style={{
        // Fixed rather than a flow block: this renders inside Next built-in
        // layout, whose <body> keeps the browser default margin, and a plain
        // div would leave a white strip around the fill.
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "system-ui, sans-serif",
        background: "oklch(0.983 0.006 85)",
        color: "oklch(0.152 0.009 50)",
      }}
    >
      <p style={{ fontSize: "3rem", color: "oklch(0.663 0.117 39)", margin: 0 }}>404</p>
      <p style={{ margin: 0 }}>We couldn&apos;t find that page.</p>
      <Link
        href={`/${routing.defaultLocale}`}
        // Explicit: no stylesheet reaches this file, so an unstyled link falls
        // back to browser blue on a cream background.
        style={{ color: "oklch(0.152 0.009 50)", textDecoration: "underline", textUnderlineOffset: "4px" }}
      >
        Back to EcoPlants
      </Link>
    </div>
  );
}
