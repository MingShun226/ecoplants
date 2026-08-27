/**
 * Shown while the account page resolves.
 *
 * `/account` reads the session cookie, so it can never be prerendered — it is
 * rendered on demand every time. Without a loading state that wait is a frozen
 * page: the link is tapped, nothing moves, and the only feedback is the browser
 * spinner. This mirrors the real layout closely enough that content replaces it
 * rather than shoving it aside.
 */
export default function AccountLoading() {
  return (
    <div className="container-page section-y" aria-busy="true">
      <span className="sr-only">Loading your account</span>

      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border-subtle pb-8">
        <div className="flex flex-col gap-3">
          <div className="h-9 w-64 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-surface-sunken" />
        </div>
        <div className="h-4 w-20 animate-pulse rounded-md bg-surface-sunken" />
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <section className="flex flex-col gap-3">
          <div className="mb-3 h-6 w-40 animate-pulse rounded-md bg-surface-sunken" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] animate-pulse rounded-xl border border-border-subtle bg-surface-sunken"
            />
          ))}
        </section>
        <aside className="h-64 animate-pulse rounded-xl border border-border-subtle bg-surface-sunken" />
      </div>
    </div>
  );
}
