# ADR 0007 — Order placement, and a payment gateway that is a button

**Status:** accepted · **Date:** 2026-08-26

## Context

Checkout rendered a form and did nothing with it. The admin panel could manage
orders but no genuine order could reach it — the queue was fed entirely by a
demo seed. This ADR covers closing that loop, and what it means to ship a
checkout with no payment gateway behind it.

## The browser is not a source of truth about money

Everything that decides what a customer is charged is computed in Postgres, in
`place_order()`, inside one transaction. The browser sends variant ids, a
quantity per line, and an address. It does not send prices. It does not send a
total. It is not asked whether the address is in East Malaysia.

That is not defensive coding, it is the only arrangement that works: the cart is
a **cookie**, and a cookie is a note the customer wrote to themselves. It is
editable, it is stale by design, and it is not evidence. So `place_order()`:

- reads each price from `product_variants` and each name from
  `product_translations`, and snapshots them onto the order line;
- refuses a variant whose product is not `is_active`;
- derives East Malaysia from the *state* against each product's
  `peninsular_only`, so a browser cannot claim to be in Selangor;
- recomputes the delivery fee from `shop_settings`, so a page left open
  yesterday cannot buy someone free delivery on an old threshold;
- reserves stock line by line through `reserve_stock()`, which takes a row lock
  before it reads;
- rolls **everything** back if any line fails — including the order row and the
  reservations already taken.

There is still **no INSERT policy on `orders` or `order_items`**. Rows arrive
only through `place_order()`, which runs as the table owner. One door, and the
database is the lock. The same shape as `transition_order()` and
`adjust_stock()`: if a write has invariants, the write lives in the database.

## The order id is the capability

There are no customer accounts, so a guest needs some way to see the order they
just placed. A `SELECT` policy permissive enough for `anon` would have to be
`using (true)`, which hands every order to anyone who can enumerate ids.

Instead the order's UUID *is* the secret — 122 bits, given out once at checkout,
never listed anywhere — and the read goes through `get_order_receipt()`, which
returns only what a receipt needs. The customer's phone number is deliberately
not in it: a receipt proves what was bought, it does not hand back everything
the shop knows. Both `/pay/[orderId]` and `/order/[orderId]` are `noindex`,
because the URL is the credential.

This is a stopgap that behaves correctly, not a substitute for accounts. When
customer login exists, the receipt page gains an "orders" list behind it and
this function keeps working unchanged for guests.

## Payment is a button, and it says so

No gateway is connected. Rather than leave checkout inert, `/pay/[orderId]`
stands in for one: it shows the order reference, the amount and the chosen
method, and has Confirm and Cancel.

**It states on screen, above the button, that nothing is charged.** A convincing
fake payment page that does not say so is exactly the thing that ends up in
front of a real customer. The warning is in all three languages and it is not
subtle.

The seam is narrow on purpose. What the button calls — `confirm_payment()` — is
what the real webhook will call:

- it is **idempotent**: an order that is not `pending` returns its current
  status rather than committing stock a second time, so a customer refreshing
  the return page or a gateway retrying its webhook are both harmless;
- `orders.payment_ref` is **unique**, so a replay conflicts at the database
  rather than being caught by application logic;
- committing the reservation, stamping `paid_at` and writing the timeline entry
  all go through `transition_order()` — already the real implementation.

**What is genuinely temporary is one grant.** `confirm_payment()` is executable
by `anon` today, because the browser calls it. That means someone holding an
order id could mark that order paid without paying. Acceptable for a shop that
takes no payments; unacceptable the moment it does. Connecting a gateway is
therefore: revoke EXECUTE from `anon` and `authenticated`, grant to
`service_role`, and call it from the webhook. Nothing else about the flow
changes.

`abandon_order()` exists for the same screen — a customer who changes their mind
releases the plants they were holding instead of leaving them reserved until
something sweeps them up. It refuses anything already paid for.

## Order numbers

`EP-YYMM-NNNN` from a sequence. Sequential numbers leak volume, which for a
small nursery is not a secret worth keeping and is what customers here expect to
be able to read down a phone. Gaps appear when a placement fails after the
number is drawn — sequences do not roll back, and that is correct: reusing a
number is worse than skipping one.

## What this does not do

- **No email.** The receipt page says a confirmation is on its way; nothing
  sends it yet. That is the next obvious gap and it is a real one — a customer
  who loses the tab has lost the only link to their order.
- **The cart cookie is still JS-readable.** [ADR 0003](0003-guest-cart-in-cookie.md)
  said it would become `httpOnly` when checkout submitted. It has not, because
  the drawer and the badge still mutate it client-side; making it `httpOnly`
  means moving add/remove to server actions too. The security argument for that
  change was always weak — the cookie holds no secret and no price — so it is
  not blocking, but the ADR's claim should be read as still outstanding.
- **No coupon or tax handling.** `discount_sen` exists on the order and is
  always zero.
