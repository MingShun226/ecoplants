/**
 * Shown while checkout resolves.
 *
 * Checkout reads the cart cookie, so it renders on demand. This is the worst
 * place on the site for an unexplained pause — it is the step where someone is
 * deciding whether to trust the shop with money, and a dead screen after
 * "Checkout" reads as a failed payment attempt.
 */
export default function CheckoutLoading() {
  return (
    <div className="container-page section-y" aria-busy="true">
      <span className="sr-only">Loading checkout</span>

      <div className="h-9 w-52 animate-pulse rounded-md bg-surface-sunken" />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div className="flex flex-col gap-8">
          {[0, 1].map((section) => (
            <div key={section} className="flex flex-col gap-4">
              <div className="h-5 w-36 animate-pulse rounded-md bg-surface-sunken" />
              {[0, 1, 2].map((field) => (
                <div key={field} className="flex flex-col gap-2">
                  <div className="h-3.5 w-24 animate-pulse rounded-md bg-surface-sunken" />
                  <div className="h-10 animate-pulse rounded-sm border border-border-subtle bg-surface-sunken" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <aside className="h-80 animate-pulse rounded-xl border border-border-subtle bg-surface-sunken" />
      </div>
    </div>
  );
}
