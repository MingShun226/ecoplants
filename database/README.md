# Database

Supabase project `yeixalbahkjbchjzvlbo`, region **ap-southeast-1 (Singapore)**.

**Applied and verified.** All twenty-four migrations have run against the live
project and the catalogue is seeded. The advisors report no errors and no
performance warnings; every remaining notice is deliberate — see
[Advisor state](#advisor-state).

## Layout

```
database/
  migrations/   Numbered, forward-only. Apply in order.
  seeds/        0001 is dumped from the database; 0002/0003 are demo scaffolding.
```

RLS policies and functions live **inside the migration that creates the table
they protect**, not in separate folders. A table that ships without its policy
in the same transaction is a table that is briefly world-writable.

## Migrations

| File | Contents |
|---|---|
| `0001_foundation.sql` | Extensions (`pgcrypto`, `pg_trgm`, `unaccent`), enums, `set_updated_at()` |
| `0002_catalogue.sql` | Categories, products, translations, attributes, variants, inventory, images + RLS |
| `0003_customers.sql` | Customers, addresses, saved carts, wishlists + user-scoped RLS |
| `0004_orders.sql` | Orders, order lines, `reserve_stock` / `release_stock` / `commit_stock` + RLS |
| `0005_reviews_quiz.sql` | Reviews, quiz responses + RLS |
| `0006_search.sql` | `search_doc` tsvector, triggers, GIN + trigram indexes |
| `0007_extensions_out_of_public.sql` | Moves `pg_trgm` / `unaccent` into the `extensions` schema (security advisor) |
| `0008_advisor_fixes.sql` | Indexes five unindexed FKs; merges two overlapping SELECT policies on `reviews` |
| `0009_admin_and_order_events.sql` | `admin_users`, the `order_events` timeline, `transition_order()` state machine |
| `0010_admin_access_via_rls.sql` | `is_admin()`; admin policies on orders/lines/events; actor derived from the session |
| `0011_column_grants_and_actor_stamp.sql` | Column-level UPDATE grant on `orders`; trigger stamping the event actor |
| `0012_revoke_helper_execute.sql` | Removes RPC exposure from two SECURITY DEFINER helpers |
| `0013_merge_order_select_policies.sql` | Merges the overlapping admin/customer SELECT policies on orders and lines |
| `0014_admin_catalogue_and_settings.sql` | Admin catalogue writes, the `stock_movements` ledger + `adjust_stock()`, `shop_settings` |
| `0015_merge_review_update_policies.sql` | Merges the author and admin UPDATE policies on `reviews` |
| `0016_place_order.sql` | `place_order()`, `get_order_receipt()`, `confirm_payment()`, `abandon_order()` |
| `0017_pin_search_path.sql` | Pins `search_path` on `is_east_malaysian_state` |
| `0018_customer_accounts.sql` | `normalise_my_phone()`, customer-on-signup trigger, `place_order` links the buyer |
| `0019_fix_phone_length.sql` | Corrects the mobile-number rule — 0018 rejected every 011 number |
| `0020_order_events_allow_customers.sql` | Lets a signed-in customer check out; 0011's trigger refused them |
| `0021_claim_order.sql` | Attaching a guest order to an account, keyed on the receipt link |
| `0022_revoke_trigger_execute.sql` | Removes RPC exposure from the `handle_new_customer` trigger |
| `0023_customer_from_metadata.sql` | Customers keyed on signup metadata, not `auth.users.phone`; unique phone |
| `0024_admin_usernames.sql` | `admin_users.username` as real data; staff auth moved to `@staff.ecoplants.my` |

## Seeds

`seeds/0001_catalogue.sql` is **generated** — regenerate with `npm run dump:seed`
rather than editing it.

The database is the source of truth; the seed is a reproducible dump of it, so a
fresh project can be brought to the same state. The dump reads as `anon`, which
means if it is complete then the storefront's view is complete.

The file is idempotent: `products.ref` and `product_variants.sku` are the
natural keys, so re-running updates rather than duplicating. Inventory is the
one exception — it seeds `on conflict do nothing`, because a re-run must not
silently restore stock that has since been sold.

`seeds/0002_demo_orders.sql` adds eight orders spanning every status so the
admin panel has something to show. **They are review scaffolding, not real
data**, all prefixed `DEMO-`. They are not hand-inserted at their final status:
each is created `pending` with a real reservation and then driven through
`transition_order()` one step at a time, so the timelines and stock effects are
genuine. Run `seeds/0003_purge_demo_orders.sql` before the first real order — it
returns the stock they hold.

## Customer accounts

An account is a Malaysian mobile number and a password. `normalise_my_phone()`
is the authority on what a number means — `012-345 6789`, `0123456789` and
`+60 12 345 6789` all resolve to one E.164 string, so one person cannot end up
with three accounts. `lib/account/phone.ts` mirrors it for the forms; **the
database wins** if they ever disagree.

`handle_new_customer()` creates the `customers` row from a trigger on
`auth.users`, and only when the new user has a phone — so staff, who sign in
with email, never acquire a shopping profile. A signup that half-succeeded would
otherwise leave someone who can log in and has no account.

There is **no OTP**, by design — signing in is the number and a password. That
leaves the number unverified, so orders are never matched to an account by phone.
`claim_order()` uses the one real secret instead: the order id, which the
receipt page is already built on. Holding it already grants read access, so
claiming grants nothing new. It refuses an order owned by someone else, so a
forwarded link cannot take an order off its buyer. See
[ADR 0008](../docs/decisions/0008-customer-accounts-by-phone.md).

## Placing an order

`place_order(lines, contact)` is the only way a row reaches `orders` — there is
no INSERT policy on `orders` or `order_items` at all. It takes variant ids,
quantities and an address, and computes everything else itself: prices and names
from the catalogue, the delivery fee from `shop_settings`, and East Malaysia
from the state against each product's `peninsular_only`. It reserves stock line
by line and rolls the whole transaction back if any line fails.

The client never supplies a price or a total. The cart is a cookie, and a cookie
is not evidence. See [ADR 0007](../docs/decisions/0007-order-placement-and-payment.md).

`get_order_receipt(order_id)` reads one back for a guest. The order UUID is the
capability — a SELECT policy loose enough for `anon` would be `using (true)` —
and the function returns only what a receipt needs, not the customer's phone
number.

`confirm_payment(order_id, ref, method)` marks it paid and commits the
reservation. It is idempotent and `payment_ref` is unique, so a replayed webhook
conflicts instead of committing stock twice. **It is granted to `anon` only
because the dummy pay screen calls it; revoke that and grant `service_role` when
a real gateway arrives.**

## Stock

`adjust_stock(variant_id, delta, reason, note)` is the only way a quantity
changes by hand. It locks the row, refuses a move below zero **or below what
checkouts in flight have reserved**, and writes a `stock_movements` row saying
who did it and why — one transaction. `inventory` has no UPDATE policy at all,
so there is no second path. The ledger is append-only for admins: read policy
only, no update, no delete.

Orders move stock through `reserve_stock` / `release_stock` / `commit_stock`,
driven by `transition_order()`. Those changes land on the order timeline, not
the movement ledger — the ledger is for stock that moved without an order.

## Order state

`transition_order(order_id, to_status, note)` is the only way an order's status
moves. It validates the transition, applies the stock effect and writes the
timeline entry in one locked transaction, and derives the actor from the session
rather than trusting a parameter. Illegal moves raise — including
`shipped -> cancelled`, because once it is with the courier you chase the
courier.

## Rules

1. **Migrations are files, never Studio clicks.** A schema that only exists in
   the dashboard cannot be reviewed, rolled back, or reproduced on a branch.
2. **RLS on every table in `public`.** Enabled in the same migration that
   creates the table.
3. **No write policy on catalogue tables.** Writes are denied to `anon` and
   `authenticated` outright. Catalogue editing has no admin module yet, so
   there is nothing to grant.
4. **Admin access is RLS, not `service_role`.** The panel works through the
   signed-in admin's own session, gated by `is_admin()`. The god-key is not in
   the application. See [ADR 0006](../docs/decisions/0006-admin-panel-scope.md).
5. **Restricting a column needs a `grant`, not a policy.** RLS filters rows and
   nothing else. `orders` carries `grant update (courier, tracking_no)` so the
   only route to `status` is `transition_order()`.
6. **`is_admin()` must never appear in a policy `anon` is subject to.** EXECUTE
   was revoked from `anon` in 0012, so such a policy raises "permission denied
   for function is_admin" for every shopper. Where a table needs a public rule
   and an admin rule, split the policies **by role**; where both apply to the
   same role, **merge them into one** so Postgres evaluates one expression.
7. **Money is `integer` sen** (`bigint` for order totals). Never `numeric` —
   PostgREST serialises `numeric` to a JavaScript double. See
   [ADR 0002](../docs/decisions/0002-money-as-integer-sen.md).
8. **`service_role` never reaches the client.** No `NEXT_PUBLIC_` prefix; the
   admin client is guarded by a `server-only` import.
9. **`plant_attributes.pet_safe` is nullable on purpose.** NULL means
   unverified, and the UI must never render that as safe.

## Two invariants worth restating

- **Webhook replays cannot double-fulfil.** `orders.payment_ref` is unique, so a
  retried webhook conflicts instead of decrementing stock a second time.
- **Concurrent checkouts cannot oversell.** `reserve_stock()` takes a
  `select … for update` row lock before it reads, so two buyers racing for the
  last plant serialise. Execute is revoked from `anon`/`authenticated`.

## Verified on the live database

- **RLS** — no table in `public` reports `rowsecurity = false`.
- **Search** — `monstera` matches 3 rows, `lidah jin` 1, `虎尾兰` 1; the trigram
  index turns the typo `lidah gin` into `Pokok Lidah Jin`.
- **Oversell guard** — reserving 2 of 2 succeeds, a third reservation returns
  false, `available_stock` reads 0. Released afterwards.
- **Admin isolation** — signed in as an admin, 8 orders are visible; as `anon`,
  0. `anon` calling `transition_order` gets "permission denied"; an admin
  attempting `shipped -> cancelled` gets "not a legal transition".
- **Column grant holds** — an admin `PATCH`ing `orders.status` directly is
  refused with "permission denied for table orders" and the status is unchanged,
  while `courier` and `tracking_no` still write. This was exploitable before
  migration 0011; the probe was run before and after.
- **Timeline cannot be forged** — an event insert claiming `actor_name`
  "Someone Else" is stored as the caller's own name; a hand-written `status`
  event is refused by the policy; `delete` and `update` on `order_events`
  affect zero rows.
- **Demo seed round trip** — purging takes stock to 594 on hand / 0 reserved and
  re-seeding returns it to 585 / 1, reproducing all eight orders with identical
  statuses, totals and event counts.
- **Catalogue writes** — as an admin, product facts, variant prices, plant
  attributes, and product and category translations all write; a duplicate
  locale slug is refused by the unique constraint (23505). As `anon`, every one
  of those affects zero rows.
- **Stock ledger** — `adjust_stock` moves stock and records the actor. Zero
  deltas, blank reasons, going below zero, and `anon` callers are all refused.
- **Settings reach the storefront** — changing the threshold to RM 250 and the
  WhatsApp number changes both on the live page in all three locales, and
  restores cleanly. Changing the guarantee period from 14 to 30 changes it in
  English, Malay and Chinese copy and in page metadata. `anon` writes affect
  zero rows.
- **Order placement** — validation refuses an empty basket, a malformed email,
  a bad postcode, quantity 0 or 9999, and an unknown variant. A real order
  recomputes its total from the catalogue (RM 149 × 2 + RM 12 = RM 310, matched),
  reserves stock, and is readable by id without leaking the phone number, while
  `anon` reading `orders` directly gets zero rows. Paying commits the
  reservation; a replay is idempotent. A peninsular-only plant to Sabah is
  refused by name. Abandoning releases the stock.
- **Order placement, through the app** — invoking the `placeOrder` server action
  over HTTP with a cart cookie creates the order, clears the cookie, and reserves
  the stock; the order then appears in the admin queue with its customer, lines
  and payment timeline.
- **Phone normalisation** — 010/011/012/015/017/019 in every written form
  resolve to one E.164 string; landlines, Singapore numbers, short numbers and
  junk are rejected. 011 was rejected by the first version of the rule and is
  covered by a test now.
- **Customer isolation** — signed in as a customer, `orders` returns 1 (their
  own) against 8 in the table, `admin_users` 0, `stock_movements` 0, and the
  order timeline is not readable at all. `anon` sees no orders.
- **Signed-in checkout** — `place_order` under a customer session links
  `customer_id`, normalises the phone to E.164, and records the timeline actor
  as an anonymous `customer` with no admin id. This path was broken until
  migration 0020 and is the reason that migration exists.
- **Order claiming** — the holder of the link claims an unclaimed order and it
  appears in their account; claiming twice is idempotent; a *different*
  customer gets `false` and still sees nothing; an admin session is refused for
  having no `customers` row; `anon` has no EXECUTE at all.
- **Staff sign in by username** — `admin`, `ADMIN` and `  Admin  ` all reach the
  one account; `admin@ecoplants.my`, `admin@staff.ecoplants.my`, a two-letter
  name and a leading digit are all refused, as is a wrong password.
- **No overlapping policies** — no table has two permissive policies for the
  same role and command, and no table in `public` is without RLS.
- **Round trip** — `npm run dump:seed` reproduces all 148 seed rows exactly:
  three locales, CJK, em dashes and curly quotes all survive unchanged. This is
  what caught a stray test value left behind by an earlier probe.

## Advisor state

`get_advisors` reports only `SECURITY DEFINER … executable` notices plus one
Auth setting. Every one is deliberate, and the reason is the same in each case:
**this application holds no `service_role` key**, so anything it needs to do
that RLS cannot express is a `security definer` function with its checks
inside — where the linter cannot see them.

- **`transition_order()` and `adjust_stock()`, by `authenticated`.** The panel
  calls them as the signed-in admin. Both refuse a non-admin caller internally,
  and both refuse illegal moves — an unlawful status transition, a write-off
  below reserved stock.
- **`place_order()`, `get_order_receipt()` and `abandon_order()`, by `anon`.**
  A guest checking out has no session, so these must be reachable. Each carries
  its own rules: `place_order` computes every price itself,
  `get_order_receipt` needs the unguessable order id and returns only receipt
  fields, `abandon_order` refuses anything already paid for.
- **`confirm_payment()`, by `anon` — the one that is temporary.** Only the dummy
  pay screen needs it. Someone holding an order id could mark it paid without
  paying, which is fine for a shop taking no payments and unacceptable the
  moment it takes one. Connecting a gateway means revoking this grant and giving
  it to `service_role`. See
  [ADR 0007](../docs/decisions/0007-order-placement-and-payment.md).
- **`is_admin()` is executable by `authenticated`.** Required — RLS policy
  expressions are evaluated as the querying role, so revoking it would break
  every policy that consults it. It only ever reports on the caller's own
  session. Revoked from `anon` in 0012.
- **Leaked password protection is disabled.** An Auth setting, not schema. Turn
  it on in the dashboard before real staff accounts exist.

The performance advisor reports only INFO-level unused-index notices. They are
expected: the database has no production traffic yet, and those indexes cover
facets, search and FK joins that the storefront will use once it is live. Do
not drop them on the strength of a linter reading an idle database.

## Test data hygiene

**Never delete by pattern.** A cleanup written as

```sql
delete from auth.users where email like '%@phone.ecoplants.my';
```

matches every customer account on the project, not just the ones a test made —
and it has already destroyed a real account that had been registered through
the signup form minutes earlier. Nothing distinguished it from test data
because nothing was ever meant to.

So test accounts carry a marker, and cleanup targets the marker:

- **Phone numbers** for test customers come from the reserved block
  `+6019-000 00XX`. Real Malaysian numbers are issued in ranges that do not
  overlap it, and it is obvious on sight in the admin panel.
- **Delete by explicit id or by that block**, never by domain, never by
  `is like '%'`.
- **Demo orders** already follow this rule with their `DEMO-` prefix and a
  dedicated purge script (`seeds/0003_purge_demo_orders.sql`). Accounts should
  have been held to the same standard from the start.

The general rule: a destructive statement should name what it removes, not
describe a shape that real data might also fit.

## Files versus applied history

Migrations 0009–0012 are byte-identical to the SQL recorded in
`supabase_migrations.schema_migrations` (md5-checked). For 0013–0015 the stored
copy omits some of the comments in the file — the statements are the same, so
the schema is identical, but the files are the fuller version and the ones to
read.

## Applying to a fresh project

Migrations in order, then `seeds/0001_catalogue.sql`. Add
`seeds/0002_demo_orders.sql` only if you want the admin panel populated for
review. Then confirm every table is protected:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```
