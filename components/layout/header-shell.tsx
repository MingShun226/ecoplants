"use client";

/**
 * The header's chrome: a fixed cream bar with the claims strip above the nav.
 *
 * It used to float transparent over a dark photographic hero on the landing
 * page and resolve to this bar on scroll. The hero now sits on the page's own
 * cream ground, so there is one state everywhere and nothing to listen for.
 *
 * Still a client component for one reason: it mirrors the scroll-lock gap (see
 * the style below), and it is the boundary the server-rendered nav is passed
 * through.
 */
export function HeaderShell({
  children,
  strip,
}: {
  children: React.ReactNode;
  strip: React.ReactNode;
}) {
  return (
    <header
      // Radix scroll-lock (selects, sheets) hides the page scrollbar and pads
      // <body> to compensate — but a fixed element sits outside <body>'s
      // padding, so without the same gap its centred content slides right while
      // the lock is held. react-remove-scroll publishes the gap as
      // --removed-body-scroll-bar-size; mirror it here.
      style={{ paddingRight: "var(--removed-body-scroll-bar-size, 0px)" }}
      className="fixed inset-x-0 top-0 z-50 border-b border-border-subtle bg-canvas/90 text-text-primary backdrop-blur-md"
    >
      <div className="hidden bg-[var(--shop-sage)] md:block">{strip}</div>
      {children}
    </header>
  );
}

/** The header is fixed, so every route needs its height back as flow space. */
export function HeaderSpacer() {
  return <div aria-hidden="true" className="h-16 md:h-[7rem]" />;
}
