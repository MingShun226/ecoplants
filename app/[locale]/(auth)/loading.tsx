/**
 * Shown while `/login` and `/signup` resolve.
 *
 * Both check for an existing session before rendering, so neither prerenders.
 * The skeleton sits in the form column only — the brand panel beside it is
 * layout, already painted, and flashing a placeholder over it would be motion
 * for its own sake.
 */
export default function AuthLoading() {
  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10" aria-busy="true">
      <span className="sr-only">Loading</span>

      <div className="mx-auto flex w-full max-w-[25rem] flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="h-8 w-32 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-4 w-full animate-pulse rounded-md bg-surface-sunken" />
        </div>

        {[0, 1].map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <div className="h-3.5 w-28 animate-pulse rounded-md bg-surface-sunken" />
            <div className="h-10 animate-pulse rounded-sm border border-border-subtle bg-surface-sunken" />
          </div>
        ))}

        <div className="h-11 animate-pulse rounded-full bg-surface-sunken" />
      </div>
    </div>
  );
}
