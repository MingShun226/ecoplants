# ADR 0003 — Guest carts live in a cookie, not in Postgres

**Status:** accepted · **Date:** 2026-08-26 · **Revised** when the cart was implemented

## Context

The blueprint schema has `carts (id, customer_id nullable, session_id)` so guests
can have persisted carts. With RLS and the anon key, a `session_id` column is not
a security boundary: any client holding the anon key can select rows by guessing
or enumerating session ids. There is no `auth.uid()` to scope the policy against.

## Decision

- **Guest cart** → the `ep_cart` cookie, holding variant ids and quantities and
  nothing else.
- **Signed-in cart** → `carts` + `cart_items`, RLS scoped to `auth.uid()`.
- On login, merge the cookie cart into the customer's row and clear the cookie.

## Why

A cookie cart is unguessable by other users, needs no RLS gymnastics, survives a
refresh, and is readable from both the client and the server — which is what
lets the drawer, the header badge and the checkout page render the same basket
without a round trip.

Nothing of value is stored in it. **Prices are never read from the client.**
Order creation re-reads every variant price from the database and recomputes the
total server-side, so a tampered cookie can change what is in the basket but
never what it costs.

## The cookie is currently readable by JavaScript

The original decision said httpOnly. It is not, yet, because the client owns
cart mutations today: `components/features/cart-provider.tsx` writes
`document.cookie` directly and `useSyncExternalStore` reads it back, which is
what keeps every surface in sync without a store to drift.

That is a deliberate, bounded trade. The cookie carries no session, no price and
no identity — only variant ids — so JS access grants nothing an attacker could
not already do by adding items to their own basket. When add/remove move to
server actions (alongside stock reservation, which has to be server-side
anyway), the same cookie becomes httpOnly with **no change to its shape** and no
change to anything that reads it.

**Update, 2026-08-26.** Checkout now submits, and this did *not* change. The
prediction above tied the switch to stock reservation moving server-side, and it
has: `place_order()` reserves stock in Postgres, reads the cart from the cookie
**server-side**, and recomputes every price from the catalogue — so a tampered
cookie can change what is in the basket but still never what it costs
([ADR 0007](0007-order-placement-and-payment.md)). What has not moved is
add/remove, which is what actually requires JS access. The security argument was
always weak, so this is not blocking; but the claim above is still outstanding
rather than satisfied, and saying otherwise would be convenient rather than
true.

The one thing that did change: `placeOrder` **deletes** the cookie once the
order exists, so a refresh cannot place the same order twice. The client store
is told to re-read via `refreshCart()`, because a server-set cookie fires no
event the provider could otherwise see.

## Consequences

- The cart is the cookie: there is no second source of truth to reconcile.
- Cookie size stays small by design — short keys (`{v,q}`), no names, no prices.
  Every byte rides on every request.
- A malformed cookie parses to an empty cart rather than an error page; the next
  mutation overwrites it.
- Abandoned-cart remarketing for guests still needs an email or phone capture
  step, since there is no server-side guest cart row to query.
- Cross-tab sync is a re-read on window focus. There is no cookie change event,
  and polling for one would not be worth it.
