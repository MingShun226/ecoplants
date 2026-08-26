# ADR 0006 — Admin panel scope, and why only ordering ships first

**Status:** accepted, extended 2026-08-26 (see [Second pass](#second-pass-the-rest-of-the-panel)) · **Date:** 2026-08-26

## Context

The storefront is built and reads from Postgres. Nothing behind it exists: no
auth, no account area, no admin panel. Every catalogue edit today is a SQL
statement or a click in the Supabase dashboard.

The full admin panel is comparable in size to everything built so far, so it
ships in slices. This ADR records the whole shape and which slice is first.

## The full panel

| Module | What it does | State |
|---|---|---|
| **Orders** | Queue, detail, status transitions, fulfilment, tracking | **This pass** |
| **Admin access** | `admin_users`, roles, login, route guard | **This pass** (prerequisite) |
| Products | Create/edit products, variants, prices, badges, three locales | **Second pass** |
| Inventory | Stock levels, manual adjustments, low-stock alerts, movement log | **Second pass** |
| Images | Upload to Storage, ordering, per-locale alt text | Still deferred |
| Customers | Profiles, order history, notes | **Second pass** |
| Reviews | Moderation queue (`is_approved` is already the gate) | **Second pass** |
| Quiz responses | Zero-party data, export for remarketing | **Second pass** |
| Categories | Reorder, edit copy | **Second pass** |
| Settings | Shipping rates, free-shipping threshold, guarantee terms | **Second pass** |
| Dashboard | Sales, top products, stock alerts | **Second pass** |

## Why orders first

It is the only module with a **clock on it**. A product that is mis-described
sits there until someone fixes it; an order that is not packed is a customer
waiting, and for live plants a delay is a dead plant. Everything else in the
table can be done from the Supabase dashboard by someone technical without much
pain. Fulfilment cannot.

## What "ordering module" includes here

- `admin_users` with roles, an admin login, and a route guard. **A panel with no
  door is not shippable**, so this is in scope even though it is not "ordering".
- Orders queue: filter by status, search by order number, email or phone.
- Order detail: lines with price snapshots, customer, delivery address, payment
  state, and a full event timeline.
- Status transitions with the correct stock effects, applied atomically in
  Postgres rather than in application code.
- Fulfilment: courier and tracking number.

## What it deliberately excludes

- **Customer-facing auth.** Admin login uses Supabase Auth, but there is still
  no customer login, signup or account area. An admin is not a customer.
- **Order creation.** Checkout still does not submit. Orders reach the panel
  only via the demo seed until that server action exists.
- **Refund execution.** `refunded` is a status the panel can set; it does not
  call a payment gateway, because there is no gateway yet.
- **Emails and WhatsApp notifications** on status change.
- **Translation.** The panel is English-only — see below.

## Three decisions inside this slice

### Stock effects live in Postgres, not in the action

`transition_order()` validates the move, applies the stock effect and writes the
timeline entry in one transaction. Doing it in TypeScript would mean three
round trips that can half-fail: an order marked shipped with stock never
committed, and no way to tell afterwards which half ran.

The state machine it enforces:

```
pending ──paid──> paid ──> packing ──> shipped ──> delivered
   │                │          │           │
   └───cancelled────┴──────────┴───────────┘        paid ──> refunded
```

Stock effects: `pending → paid` commits the reservation. `pending → cancelled`
releases it. `paid+ → cancelled` returns the goods to stock, because they never
shipped. `shipped → cancelled` is refused — chase the courier, do not edit
history.

### The panel holds no god-key

[ADR 0005](0005-gold-design-system.md) assumed admin writes would use the
`service_role` key, which bypasses RLS entirely. That is the wrong default here
and this ADR revises it.

The panel reads and writes through **the signed-in admin's own session**. An
`is_admin()` predicate in the policies decides access, and `transition_order()`
refuses a caller who is not an active admin. Three consequences:

- The route guard and the database enforce access **independently**. A mistake
  in the guard is not a breach on its own.
- One forgotten `.eq()` in a server component cannot leak every customer's
  address, because the row was never visible to that session.
- The `service_role` key is **not in the application at all**. It stays for the
  payment webhook, which has no session.

**Row policies are not column policies.** The first cut of this had a policy
named "admins update fulfilment" whose comment said status was not editable by
hand — but RLS gates rows, never columns, so a `PATCH /orders` with
`{"status":"delivered"}` was accepted. A pending order could be marked delivered
with its reservation still held and stock never decremented. Migration 0011
replaces the blanket grant with `grant update (courier, tracking_no)`, which is
the only mechanism Postgres has for restricting columns. `transition_order()` is
`security definer` and runs as the table owner, so it still writes status — which
is the point: the state machine becomes the *only* way status moves.

The same migration stamps `order_events.actor_id` and `actor_name` from the
caller's session in a trigger, so an admin cannot attribute an action to a
colleague. There is no `update` or `delete` policy on `order_events` at all: for
an admin the timeline is append-only.

### The panel is English-only, and not under `/[locale]`

The storefront is trilingual because customers are. Staff are a handful of
people who share one language, and translating an admin panel triples the copy
for zero customer benefit.

So the panel lives at `/admin`, outside the `[locale]` segment, with its own
root layout. `proxy.ts` excludes it from locale negotiation. If that changes,
moving it under `[locale]` later is a directory move plus message extraction —
no logic changes.

## Visual language

The panel runs **monochrome**: the `.admin-mono` token override desaturates the
clay ramp to neutral greys across the whole subtree, so a single class turns the
brand off without touching a component. Clay stays in the shop window, where it
means "buy this". In a working tool a warm accent on every other control is
noise, and it competes with the one place colour should mean something — order
status.

Display type drops from Fraunces to **Lora**: low-contrast and sturdy at small
sizes, so headings read as headings without performing. Same variable swap
trick — `--font-display` is redefined on the subtree.

Both are lifted from GoldChin, which solved the same problem
([ADR 0005](0005-gold-design-system.md)).

## Demo orders

The panel cannot be built or reviewed against an empty table, and checkout does
not submit yet. `database/seeds/0002_demo_orders.sql` inserts eight orders
spanning every status.

**They are review scaffolding, not real data.** Every one has an order number
prefixed `DEMO-`, and `database/seeds/0003_purge_demo_orders.sql` removes them
and restores the stock they hold. Purge before the first real order.

## Before this is used for real

This slice is reviewable, not launchable. In order:

1. **Change the demo admin credentials.** The review account is `admin` /
   `12341234` — a deliberately trivial password for local work, written down in
   this repository, and far too weak for anything reachable from a network.
   Rotate it and create real staff accounts before the panel leaves localhost.

   Staff sign in with a **username**, never an email address.
   `admin_users.username` is the real column — unique, validated by a check
   constraint, and what the rail displays. Supabase needs a unique string to key
   an identity on, so the username is carried as `admin@staff.ecoplants.my`,
   which is never shown and never typed. Typing a full address is **refused**
   rather than passed through: accepting it would make this an email login
   wearing a username label, and would let someone aim at an account on a domain
   we do not control.

   The subdomain is load-bearing. `ecoplants.my` is the shop's real domain, so
   keying staff on it would collide the day someone creates a real
   `admin@ecoplants.my` mailbox. `@staff.ecoplants.my` can never be an inbox —
   the same trick customer phone numbers use with `@phone.ecoplants.my`
   ([ADR 0008](0008-customer-accounts-by-phone.md)), which also guarantees the
   two kinds of account can never collide.
2. **Enable leaked password protection** in the Supabase dashboard (Auth →
   Policies). It checks new passwords against HaveIBeenPwned. Off today.
3. **Run `database/seeds/0003_purge_demo_orders.sql`.** Demo orders hold real
   reservations against real stock; leaving them makes every count wrong.
4. **Build checkout's submit action.** Until it exists no genuine order can
   reach the queue, so the panel has nothing to manage.
5. **Connect a payment gateway.** Payment state is set by hand today. Once a
   gateway exists it becomes webhook-driven, and that webhook is the one caller
   that legitimately uses `service_role`.

`SUPABASE_SERVICE_ROLE_KEY` must never carry a `NEXT_PUBLIC_` prefix. It is not
used by the application today; `lib/supabase/admin.ts` exists, is guarded by
`import "server-only"`, and is imported by nothing.

## Second pass: the rest of the panel

Everything in the table above except Images now exists. The reasoning that put
ordering first still holds — it was the module with a clock on it — but the rest
followed immediately rather than in separate slices, so the decisions below were
made once, across all of them.

### Writes go through the database's own guarantees, or not at all

Stock is the clearest case. `adjust_stock(variant, delta, reason, note)` is the
only way a quantity changes by hand: it locks the row, refuses a move that would
go below zero **or below what checkouts in flight have already reserved**, and
writes a `stock_movements` row explaining itself — all in one transaction. There
is no UPDATE policy on `inventory` at all, so there is no second path.

The ledger matters more than it looks. A nursery loses stock to death, damage
and miscounts constantly, and "we are eleven short" is unanswerable without a
record of who changed what and why. As with `order_events`, admins can read it
and nothing else: no update policy, no delete policy, append-only.

### Row policies still are not column policies

Migration 0011 learned this on `orders`. The same rule shaped every policy in
0014: **`is_admin()` must never appear in a policy that `anon` is subject to**,
because 0012 revoked EXECUTE on it from `anon` and a policy calling it would
raise for every shopper on the storefront. Where a table needs both a public
rule and an admin rule — `products`, so admins can see drafts and deactivated
rows — the policies are split by role rather than merged with OR.

Where both rules apply to the *same* role, they are merged into one policy
instead of added alongside, because Postgres evaluates every permissive policy
for a role and command on every read (0013 for orders, 0015 for reviews).

### Settings are values, never sentences

`shop_settings` is one row holding the free-delivery threshold, the delivery
fee, the guarantee period, the WhatsApp number and the low-stock level. These
were constants in `lib/data/site.ts`; a shipping threshold is a commercial
decision that should not need a deploy.

Copy stays in `messages/*.json` so it can be translated together. The guarantee
period is the interesting case: it appeared as a literal "14" in nine strings
across three languages, which would have made the settings field a control that
did nothing. Those strings now take a `{days}` parameter, so changing the number
in the panel changes it everywhere — including the Chinese and Malay copy and
the page metadata. **A setting that does not move anything is worse than no
setting**, because it looks like it works.

What is left in `site.ts` is structural: the brand name, and a nav list whose
entries are routes and message keys that have to exist in code anyway.

### What the panel still cannot do

- **Create or delete products, variants and categories.** A variant carries a
  SKU, an inventory row and price snapshots on historical orders; a category
  slug is baked into URLs, the nav and the footer. Both are code changes as much
  as data changes, and getting them wrong breaks orders that already reference
  them. Editing everything about an existing one is supported.
- **Images.** There is no photography yet, so there is nothing to manage. This
  is the one module still genuinely deferred.
- **Create admins.** Deliberate: a panel that can mint admins is one compromised
  session away from being permanent.
