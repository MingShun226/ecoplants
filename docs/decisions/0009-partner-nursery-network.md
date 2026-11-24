# ADR 0009 — Partner nurseries: EcoPlants sells, local nurseries grow and pack

**Status:** proposed — nothing here is built yet · **Date:** 2026-11-24

## Context

EcoPlants delivers to West Malaysia only, and live plants do not survive long
trips well. A courier leg to another state means days in a hot van.
Peninsular → East Malaysia takes 7–8 working days
([blueprint](../research/blueprint.md)). So the shop can only reach as far as a
plant can survive the trip.

The fix is to move the order a long way instead of the plant. Every state has
nurseries that sell only to walk-in customers. EcoPlants becomes the shop front,
the brand and the customer service for a network of them:

1. A customer orders from EcoPlants.
2. The order goes to a partner nursery near them.
3. The nursery prepares and packs the plant.
4. EcoPlants books a local driver.

This ADR records how that works and the order it is built in.

## The model

- **EcoPlants is the seller.** The customer buys from EcoPlants, pays
  EcoPlants, and reports any problem on arrival to EcoPlants. A nursery is a supplier, and
  EcoPlants pays it a **net price** agreed per plant. This is the simplest
  arrangement legally and in the books, because EcoPlants is the merchant of
  record. It is also the easiest one to explain to a nursery owner: "you'll
  receive RM40 for this one."
- **It is not an open marketplace.** Nurseries do not run shops on the site,
  set retail prices or talk to customers. The customer shops one EcoPlants
  catalogue, and routing picks the nursery. The receipt names the nursery
  ("Grown by Kebun Ah Seng, Sungai Buloh"). Nothing else does.
- **EcoPlants' own stock is a partner too**, called the *house* partner. The
  shop keeps selling what it holds today, through the same pipeline.

What does not change:

- the catalogue (products, variants, three locales, images) and the
  storefront's look;
- the rule that the browser is not a source of truth about money
  ([ADR 0007](0007-order-placement-and-payment.md));
- access through RLS, with no `service_role` key in the app
  ([ADR 0006](0006-admin-panel-scope.md), migration 0010);
- the order statuses and the legal moves in `transition_order()`.

## Decisions

### 1. One retail price per variant, and a net price per nursery

`product_variants.price_sen` stays the price every customer pays, whichever
nursery fulfils the order. Each nursery's *offer* carries its own
`net_price_sen`. EcoPlants' margin therefore varies from order to order. Margin
is not an input to routing (decision 4), so a customer is never sent further
away to make EcoPlants more money.

The net price is snapshotted onto the order line when the order is placed, as
the retail price already is. Editing an offer never changes what an existing
order owes.

A later commission mode, where the nursery sets the price and EcoPlants keeps a
percentage, fits the same columns: net = price × (1 − rate). It is not built
now.

### 2. Nurseries report availability, not counts

Nurseries do not count their stock and will not keep counts current. So an offer
is `available`, `limited` or `out`. The real stock check is the nursery
accepting the order (decision 6).

The house partner keeps counted inventory exactly as it works today:
`inventory`, `reserve_stock()`, `adjust_stock()` and the movement ledger.
EcoPlants does count its own stock.

**The house has no offers.** Its inventory already records what it stocks, and
records it better: as counts, with an audit trail. A second list of the same
facts would only be another thing to keep in step. A variant the house does not
carry simply has nothing on hand, so routing never picks the house for it.
Migration 0032 refuses an offer on the house with a trigger, so the rule also
holds inside SECURITY DEFINER functions.

On the storefront, a `limited` offer shows "Few left" in place of "only 3 left".
House stock still shows a number.

### 3. One checkout, one payment, one order per nursery

A basket can hold plants that no single nursery has. Refusing such a basket
would break the pilot, because each nursery will list a different 20–30 plants.
So a checkout becomes an **order group**. The group has:

- one payment and one receipt;
- one number, which the customer quotes;
- one `orders` row per nursery, each with its own pickup and delivery fee.

Everything already built per order keeps working: `transition_order()`, the
timeline, the admin queue and the fulfilment fields. Each order maps to exactly
one pickup. Payment moves to the group.

Order numbers:

- the group is `EP-YYMM-NNNN`, the number a customer quotes on WhatsApp;
- its orders are `EP-YYMM-NNNN-A`, `-B`, and so on;
- existing orders are back-filled into one-order groups under their own numbers,
  so old receipt links keep working.

### 4. Routing chooses the fewest nurseries, then the nearest

Routing is deterministic and runs in Postgres. The checkout preview
(`quote_delivery()`) and `place_order()` both call it, so what the customer sees
is what gets placed. The steps:

1. **Candidates.** Active nurseries that are not closed today and whose delivery
   radius reaches the address.
2. **Per line.** The candidates whose offer for that variant is not `out`. For
   the house partner, the candidate needs available stock of at least the
   quantity.
3. **No candidate.** A line with no candidate refuses the checkout and names the
   plant: "Calathea Orbifolia isn't available for delivery to 47301 yet."
4. **Assign.** Pick the candidate that covers the most remaining lines. Break
   ties by distance, then by a manual `priority`. Repeat until every line is
   assigned.
5. **Too many nurseries.** If the plan needs more than
   `max_partners_per_checkout` (a setting, default 3), refuse with a suggestion
   to split the basket.
6. **Orders.** Each nursery's lines become one order, with a fee worked out as in
   decision 5.

Reliability (how fast a nursery confirms, how often it declines) becomes a
tie-break in Stage 3, once there is data to score it on.

### 5. Delivery fees by distance band and vehicle, booked by staff at first

**Coverage.** Each nursery has a location and a `delivery_radius_km` (default
30). Distance is straight-line (haversine). That is good enough to decide
whether a nursery can deliver and which fee band applies, and plain SQL can
compute it with no outside service.

**Where the address is.** The address field already calls Google Places
server-side. Adding `location` to the details field mask gives a latitude and
longitude. A typed address, or one entered with no API key configured, falls
back to its postcode. Each postcode is geocoded once, server-side, and cached in
`postcode_locations`.

**The fee** comes from a band table per vehicle class:

| Vehicle | ≤ 10 km | ≤ 20 km | ≤ 30 km | ≤ 40 km |
|---|---|---|---|---|
| bike | RM10 | RM15 | RM20 | RM25 |
| car | RM20 | RM28 | RM36 | RM45 |
| van | RM45 | RM60 | RM75 | RM90 |

**These numbers are placeholders.** Each order also records what its delivery
actually cost (`delivery_cost_sen`, entered when staff book it). After the first
few dozen deliveries, the bands should be reset from that evidence.

**The vehicle class** comes from fields the variant already has: `height_cm`,
`pot_diameter_cm` and `weight_grams`, compared against thresholds in settings. A
variant can override it. An order takes the largest class among its lines.
Check the thresholds against Lalamove's current size limits for each vehicle.

**Booking.** Staff book Lalamove or Grab Express by hand at first, then paste the
tracking link and the real cost into the order. The Lalamove API comes in
Stage 3, once the manual flow has shown what it needs: live quotes at checkout,
booking when an order is packed, and status updates by webhook.

**No free delivery.** Decided 2026-11-24: the customer always pays the fee
quoted for each delivery, whatever the basket is worth. Every delivery is now a
real drive with a real cost, so a free-delivery threshold would mean EcoPlants
paying for the drive. `shop_settings.free_shipping_threshold_sen` and
`standard_shipping_sen` stop being read, and everything on the site that shows
them is removed in Stage 1.

**Nursery self-delivery.** A nursery with its own lorry can deliver its own large
plants; the order is flagged `partner_delivers`. Only then does the nursery see
the delivery address and phone number, and only after it has accepted.

### 6. Statuses stay the same; the nursery's steps are timestamps

The `order_status` enum and the legal moves in `transition_order()` do not
change. What the nursery does is recorded in columns on the order. Functions set
those columns and write timeline events.

| SOP step | Status | Recorded as | Done by |
|---|---|---|---|
| Paid, waiting for the nursery | `paid` | `partner_due_at` | system |
| Nursery has it | → `packing` | `partner_accepted_at` | nursery or staff |
| Nursery doesn't have it | stays `paid` | decline event, then reassign or cancel | nursery or staff, then staff |
| Packed, photo sent | `packing` | `packed_at`, `packed_photo_path` | nursery or staff |
| Driver has collected it | → `shipped` | `courier`, `tracking_url`, `delivery_cost_sen` | staff |
| Delivered | → `delivered` | `delivered_at` | staff (by webhook in Stage 3) |

The panel and the seller page show these as plain labels:

- `paid` → "Waiting for nursery"
- `packing` → "Preparing", or "Ready for pickup" once `packed_at` is set
- `shipped` → "Out for delivery"

**The confirmation deadline.** `partner_due_at` is the paid time plus 2 hours,
counted inside the nursery's pickup hours. An order paid at 7pm is due at 11am
the next time the nursery opens. The queue's "Late" view is
`now() > partner_due_at and partner_accepted_at is null`. It is computed when
the queue is read, so no cron job is needed.

**A decline does not cancel the order.** Staff reassign it to another nursery
with `reassign_order()`, which re-runs eligibility for that one order. The
customer has already paid, so any difference in delivery cost is EcoPlants'.
The order is cancelled and refunded only when no nursery has the plant.

### 7. Nurseries never see the customer

A nursery sees, for each order:

- the order number;
- the lines: plant name, size, pot, quantity, photo, and what the nursery earns
  for each;
- the customer's first name, town and postcode;
- when it is due and when the driver is coming;
- EcoPlants' notes.

It never sees the customer's phone number, email or street address. The only
exception is decision 5's self-delivery case.

RLS filters rows, not columns. So nurseries get **no table access at all**.
Every read and write goes through `partner_*` functions that return exactly
those fields, the same pattern `get_order_receipt()` already uses. Hiding the
customer is also the main defence against nurseries taking customers off the
platform.

### 8. Everything a nursery can do, staff can do for it

Each `partner_*` write accepts either a member of that nursery or an admin. The
timeline records which of them it was. Some owners will reply on WhatsApp and
never open the seller page; staff press the button for them, and the record is
the same either way. This is also why the pilot needs no seller page at all.

### 9. Money owed moves through an append-only ledger

`partner_ledger` holds every amount owed to or by a nursery:

| Kind | Sign | When |
|---|---|---|
| `sale` | credit | the order reaches `delivered`: net price × quantity, summed over its lines |
| `claim` | debit | an arrival claim finds the nursery at fault (decision 13) |
| `packaging` | debit | packing kits supplied to the nursery |
| `adjustment` | either | a correction, always with a note |
| `payout` | debit | EcoPlants pays the nursery |

The ledger is insert-only, like `stock_movements`. A mistake is corrected with a
new entry, never by editing an old one.

**Payouts run every Monday** (decided 2026-11-24).

- Monday's run covers every unpaid entry whose order's damage window closed
  before Monday 00:00, Malaysia time. The window is a setting, default 48 hours.
  With the default, that means every order delivered by the end of Friday. An
  order delivered on Saturday or Sunday is paid the following Monday.
- `create_payout(partner, through)` takes those entries, sums them and links
  them to a payout. `through` is that Monday at 00:00.
- If the total is negative, it carries forward to the next week.
- `mark_payout_paid(payout, bank_ref)` records the bank transfer.

Payouts are ordinary bank transfers from EcoPlants' account, so any payment
gateway works. No split-payment feature is needed at this size.

The house partner has no ledger. EcoPlants does not pay itself.

### 10. A nursery login is a third kind of identity

Staff sign in by username (`@staff.ecoplants.my`), and customers by phone
(`@phone.ecoplants.my`). Nursery users get their own domain,
`<phone>@partner.ecoplants.my`. A nursery owner who also shops on the site
therefore has two separate accounts, and neither one inherits the other's data.
It is the same rule as "an admin is not a customer"
([ADR 0006](0006-admin-panel-scope.md)).

**There is no self-signup.**

1. Staff create a single-use invite code for a nursery. It expires after 7 days.
2. Staff send the link by WhatsApp.
3. The owner sets a password, and `claim_partner_invite()` links the new login
   to the nursery.

This needs no `service_role` key.

**A forgotten password** is handled the same way: staff deactivate the old login
and send a new invite.

`handle_new_customer()` has to skip signups on the partner domain, or every
nursery login would also get a shopping profile.

### 11. Packed photos are public but unguessable

The customer sees the packed photo on the receipt ("here's your actual plant").
The order group's id is already the receipt's credential
([ADR 0007](0007-order-placement-and-payment.md)).

Photos go in a `packed-photos` bucket that is public-read but has no SELECT
policy. An object can be fetched by its path, `<order id>/<uuid>.jpg`, but the
bucket cannot be listed. Uploads are allowed for a member of the order's nursery
or for an admin.

### 12. The seller page is translated; the admin panel is not

The admin panel is English-only, by decision
([ADR 0006](0006-admin-panel-scope.md)). The seller page is for nursery owners,
and many of them read Malay or Chinese first. So it lives under `[locale]` and
uses next-intl like the storefront. Each nursery has a preferred locale, which
the WhatsApp links use.

### 13. No survival guarantee; an arrival check instead

Decided 2026-11-24. The 14-day survival guarantee is dropped **for the whole
shop**, not only for nursery plants. The customer cannot choose who fulfils an
order. A promise that depended on which nursery routing picked is one nobody
could read before paying.

What stays is the **arrival check**:

- A plant that arrives wrong, damaged or with pests can be reported, with
  photos, within the damage window (48 hours by default).
- EcoPlants replaces or refunds it.
- The packed photo (decision 11) decides who carries the cost: the nursery, the
  driver or EcoPlants.

Goods sold online still have to arrive as described, so the arrival check is not
optional. The damage window is also what the Monday payout cut-off (decision 9)
is built on. Once a plant has arrived in good condition, its care is the
customer's, which makes the care panel on every product page matter more.

The guarantee is the site's headline claim today. It appears in:

- the header strip;
- the home page band;
- the product page;
- checkout;
- the footer;
- the sign-in panel;
- page metadata;
- its own `/guarantee` page.

Stage 1 removes all of it. The natural replacement for the headline is the
packed photo: "Every plant photographed before it leaves the nursery."

## Data model

### New tables

| Table | Holds |
|---|---|
| `partners` | id, slug, kind (`house` · `nursery`), name, display_name (for "Grown by"), area_label, lat, lng, delivery_radius_km, pickup_hours (jsonb), closed_until, self_delivery, priority, preferred_locale, contact_name, whatsapp (E.164), status (`onboarding` · `active` · `paused` · `ended`), agreement_signed_on, notes. One house row is seeded. |
| `partner_payout_accounts` | partner_id, bank_name, account_name, account_no, updated_by. **Owner role only.** |
| `partner_offers` | partner_id, variant_id, net_price_sen, availability, updated_by, updated_at. Primary key (partner_id, variant_id). Nurseries only; the house's stock is `inventory`. |
| `postcode_locations` | postcode, lat, lng, source, fetched_at. A geocoding cache. |
| `delivery_fee_bands` | vehicle, max_km, fee_sen |
| `order_groups` | group_no, customer_id, contact fields, payment_status, payment_method, payment_ref (unique), subtotal_sen, delivery_fee_sen, total_sen, placed_at, paid_at |
| `partner_ledger` | partner_id, kind, amount_sen (signed `bigint`), order_id, payout_id, note, actor, created_at. Insert-only. |
| `payouts` | partner_id, period_end, amount_sen, status (`draft` · `paid`), bank_ref, paid_at, created_by |
| `area_interest` | postcode, phone or email, locale, created_at. Collects "tell me when you deliver here", which shows where the next area should be. |
| *Stage 2:* `partner_users` | auth_user_id, partner_id, full_name, is_active |
| *Stage 2:* `partner_invites` | code, partner_id, expires_at, used_by, used_at |
| *Stage 2:* `partner_requests` | a nursery's "add this plant" or "change my price" request, with a photo, for staff to approve |
| *Stage 3:* `claims` | arrival claims only (decision 13): order, kind (`damaged` · `wrong` · `pests`), photos, decision, at_fault (`nursery` · `courier` · `ecoplants`), amount, linked ledger entry |

New `shop_settings` columns: the vehicle thresholds,
`max_partners_per_checkout`, `partner_confirm_minutes`, `damage_window_hours`
and `default_radius_km`.

Retired `shop_settings` columns: `guarantee_days`,
`free_shipping_threshold_sen` and `standard_shipping_sen`. Nothing reads them
after Stage 1. They are dropped in a later migration, once that is verified.

### Changed tables

- **`orders`** gains group_id, partner_id, vehicle, distance_km,
  partner_delivers, partner_due_at, partner_accepted_at, packed_at,
  packed_photo_path, tracking_url and delivery_cost_sen. `shipping_fee_sen`
  keeps its name and its meaning: what the customer paid for this delivery.
- **`order_items`** gains net_price_sen, a snapshot taken at placement.
- **`order_events`** gains actor_kind (`system` · `customer` · `admin` ·
  `partner`) and partner_user_id. `stamp_order_event_actor()` has to learn the
  partner identity; as written today, it would record a nursery as `customer`.
- **`product_variants`** gains vehicle_override, nullable.
- **`products`** gains fulfilment (`local` · `courier`), in Stage 4.

All money stays in integer sen ([ADR 0002](0002-money-as-integer-sen.md)).
RLS is enabled in the same migration that creates each table.

## Functions

| Function | Called by | What it does |
|---|---|---|
| `route_basket` | internal | Decision 4. Returns the plan: nursery per line, distance, vehicle and fee per order. |
| `quote_delivery` | anon | The checkout preview. Read-only; calls `route_basket`. |
| `place_order` (rewritten) | anon | Routes the basket, creates the group and one order per nursery, snapshots prices and net prices, reserves house stock. Everything rolls back if any part fails. |
| `confirm_payment` (rewritten) | `service_role` once a gateway exists | Marks the group paid and moves every order in it `pending → paid`, setting `partner_due_at`. Idempotent on `payment_ref`. |
| `get_checkout_receipt`, `claim_checkout`, `abandon_checkout` | anon / customer | The group versions of today's receipt, claim and abandon. Each also accepts an old order id. |
| `partner_respond(order, accept, reason)` | nursery or admin | Accept (→ `packing`) or decline (stays `paid`, flagged). |
| `mark_packed(order, photo_path)` | nursery or admin | Packed, with the photo. |
| `reassign_order(order, partner)` | admin | Moves a declined order to another nursery that is eligible for it. |
| `record_delivery(order, courier, tracking_url, cost)` | admin | Booking details, then `→ shipped`. |
| `transition_order` (changed) | admin, system | Credits the `sale` ledger entry on `delivered`, exactly once. Stock effects apply only to house lines. |
| `add_ledger_entry`, `create_payout`, `mark_payout_paid` | admin (payouts: manager and up) | Decision 9 |
| `register_area_interest` | anon | The "not in your area yet" form |
| *Stage 2:* `is_partner_member`, `claim_partner_invite` | nursery | Identity |
| *Stage 2:* `partner_orders`, `partner_order`, `partner_offer_list`, `partner_statement` | nursery | Reads that return only decision 7's fields |
| *Stage 2:* `partner_set_availability`, `partner_set_closed`, `partner_request` | nursery or admin | Writes |

## Screens

### Admin panel (English)

A new nav group, **Network**, holds Partners and Payouts.

- **Partners list.** Status, area, open or closed, average confirmation time,
  decline rate, 30-day sales and balance owed.
- **Partner detail.** Profile, location and radius, pickup hours, contacts,
  agreement date, bank details (owner only), offers with bulk availability
  editing, orders, ledger and invite codes.
- **Product detail.** A new *Nurseries* section shows who stocks each variant,
  at what net price, with what availability, and the margin as a percentage.
- **Orders queue.**
  - A partner column.
  - New views: "Waiting for nursery", "Late" (in red) and "Ready for pickup".
- **Order detail.**
  - A nursery panel with accept or decline, reassign, packed-photo upload and
    delivery booking.
  - A **WhatsApp nursery** button that opens `wa.me` with a message prefilled in
    the nursery's language, linking to the order.
  - The other orders in the same group.
- **Payouts.** The Monday run: who is owed what, a statement that can be copied
  as WhatsApp text, and "mark as paid" with the bank reference.
- **Settings.** A Delivery section for fee bands, vehicle thresholds, the
  confirmation deadline, the damage window and the default radius. The
  free-delivery and guarantee fields are removed.
- **Overview.** Margin (retail minus net), delivery charged against delivery
  cost, and nursery health.

### Seller page, `/[locale]/partner` (Malay, Chinese, English; `noindex`; for phones)

- **Orders** (the default screen): new orders with *Have it* / *Out of stock*,
  orders to pack with *Upload packed photo*, and ready orders with the driver's
  arrival time. `/partner/orders/[orderNo]` is what the WhatsApp links open.
- **Plants**: a toggle per plant for Available, Limited or Out. The net price is
  shown read-only, with a "request a change" link and an "add a new plant" form.
- **Money**: this week's earnings, the next payout, and past statements with
  their deductions.
- **Shop**: pickup hours and a *Closed today* switch.
- **`/partner/login`** (phone and password) and **`/partner/join?code=`**.

Two gates fail independently, as in the admin panel: the layout checks for a
nursery session, and the functions refuse anyone who is not a member.

### Storefront

- **Product page**: a postcode check that answers "Delivers to 47301 · from
  RM10 · today if ordered by 12pm", or "Not in your area yet" with the interest
  form.
- **Basket and checkout**: the deliveries the order will arrive in ("Arrives in
  2 deliveries"), each with its fee, plus decision 4's refusal messages.
- **Address**: `location` is added to the Places field mask, with the postcode as
  the fallback.
- **Receipt**: for each delivery, the nursery's "Grown by" name, the status, the
  packed photo and the tracking link.
- **Account**: order history listed by group.
- **The guarantee is removed** (decision 13) from the header strip, the home
  page band, the product page panel, the checkout note, the footer, the sign-in
  panel's stats and the page metadata. `/guarantee` becomes `/delivery`, which
  explains delivery areas, fees and the arrival check. The old address
  redirects there permanently.
- **Free delivery is removed** (decision 5): the basket drawer's progress bar,
  the product page's free-delivery line, and the amounts shown in the header
  strip, the footer and the sign-in panel.

## Build order

### Stage 0 — before code (the owner)

- [ ] Choose the first area. The default is Sungai Buloh and the Klang Valley.
- [ ] Sign 3–5 nurseries to a one-page supplier agreement covering:
  - net prices;
  - how fast they must confirm an order;
  - the packing standard;
  - no flyers or phone numbers in parcels, and no approaching EcoPlants'
    customers;
  - payout and claim terms.
- [ ] Write the nursery SOP sheet in Malay, Chinese and English.
- [ ] Get branded packing kits made, with a care card carrying a QR code.
- [ ] Photograph each nursery's top 20–30 plants to the site's canvas standard,
      and agree net prices.
- [ ] Open a Lalamove business account.
- [ ] Ask an accountant about reselling at net prices, SST and e-invoicing.
- [ ] **Real payments.** `/pay` is still a stand-in button that charges nothing
      ([ADR 0007](0007-order-placement-and-payment.md)). The pilot cannot take
      real orders without a gateway.
      - Stage 1 moves `confirm_payment()` to the group, so connect the gateway
        straight after that change, not before.
      - Until then, only friends-and-family test orders, paid by DuitNow and
        confirmed by staff, are honest.

### Stage 1 — the network, run by staff (the pilot)

Database (migration numbers are indicative):

- [x] `0032_partners`: partners, payout accounts, offers, and the seeded house
      partner. Applied to the live project on 2026-11-24 and probed there. The
      panel's Nurseries screens and the product screen's Nurseries card are
      built on it.
- [ ] Moving every existing order to the house partner happens in
      `0034_order_groups`, alongside the other new `orders` columns. 0032 leaves
      `orders` alone so the live checkout is untouched until routing replaces
      it.
- [ ] `0033_delivery`: postcode cache, fee bands, settings columns, vehicle
      class, haversine.
- [ ] `0034_order_groups`: order groups, the new columns on orders and order
      items, back-filled groups, `actor_kind` on events.
- [ ] `0035_routing`: `route_basket`, `quote_delivery`, the rewritten
      `place_order` and `confirm_payment`, and the group versions of receipt,
      claim and abandon.
- [ ] `0036_fulfilment`: `partner_respond`, `mark_packed`, `reassign_order`,
      `record_delivery`, the `transition_order` changes and the `packed-photos`
      bucket.
- [ ] `0037_ledger`: ledger, payouts and area interest.

App:

- [x] Admin: Nurseries list, add and detail screens (profile, status and
      priority, closed today, location and radius, pickup hours, offers, and the
      owner-only bank details), and the Nurseries section on the product page.
- [ ] Admin: the order queue views and nursery panel, the WhatsApp button,
      Payouts, and the Delivery section in Settings.
- [ ] Storefront:
  - the `location` field and the postcode fallback;
  - deliveries and fees shown in checkout;
  - the receipt and account pages working by group;
  - the postcode check and interest form on the product page;
  - "Few left" for `limited` offers;
  - the guarantee and free delivery removed everywhere they appear, and
    `/guarantee` turned into `/delivery` with a redirect;
  - new copy in `messages/{en,ms,zh}.json`.
- [ ] Update `database/README.md` and the routes table in `README.md`.

**Done when:** a real basket split across two nurseries is placed, paid,
accepted, packed with photos, delivered, credited on both statements and paid
out, and every step appears on the timeline.

### Stage 2 — the seller page (after 2–4 weeks of pilot)

- [ ] `partner_users`, invites, `is_partner_member()`, and the changes to
      `stamp_order_event_actor()` and `handle_new_customer()`.
- [ ] The `partner_*` read and write functions, the storage upload policy, and
      `partner_requests`.
- [ ] The four screens, plus login and join, in three languages.
- [ ] WhatsApp messages link to `/partner/orders/[orderNo]` in the nursery's
      locale.
- [ ] Build what the pilot showed nurseries actually tap, which may be less than
      this list.

### Stage 3 — automation and claims

- [ ] Lalamove API: a live quote at checkout in place of the bands, booking when
      an order is packed, and a status webhook that moves orders to `shipped` and
      `delivered`. It needs `service_role` server-side, like the payment webhook.
- [ ] WhatsApp Business API: the new-order message to the nursery, a reminder at
      `partner_due_at`, and the customer's packed, out-for-delivery and delivered
      updates.
- [ ] The claims module, with its ledger effects, and nursery scorecards that
      feed routing's tie-break.

### Stage 4 — beyond the first area

- [ ] `products.fulfilment = 'courier'` for pots, soil, tools and hardy cuttings:
      shipped by courier at weight-based fees to any state, including East
      Malaysia.
- [ ] Once nurseries there exist, all states in checkout. The West-Malaysia-only
      rule (migration 0026) is replaced by "is there a nursery near this
      address".
- [ ] A "Deliver to" area picker that filters browsing to what is available near
      the customer.
- [ ] Nurseries listing their own plants, and the commission mode.
- [ ] The second area, chosen from the `area_interest` data.

## Verification

These are the probes to run, in the style of
[database/README.md](../../database/README.md#verified-on-the-live-database).
Test nurseries are named `TEST-…` and use phone numbers from the reserved
`+6019-000 00XX` block. They are deleted by id, never by pattern.

- **Routing.**
  - The same basket and address give the same plan from `quote_delivery` and
    `place_order`.
  - A basket that one nursery can fill is never split.
  - A nursery that is out of radius, closed or paused is never chosen.
  - A line no nursery can fill is refused by name.
  - Too many nurseries is refused.
- **Money.**
  - A hand-built request cannot choose the nursery, the fee or the net price.
  - Editing an offer does not change existing orders.
  - The group total equals the sum of its orders, and each order's total equals
    its lines plus its fee.
- **Payment.**
  - One `payment_ref` per group.
  - A replayed confirmation is idempotent.
  - Every order in a group becomes paid together.
- **Ledger.**
  - `delivered` credits exactly once, even if the transition is repeated.
  - Entries cannot be updated or deleted.
  - A payout equals the sum of its entries.
  - A refund after a payout produces a debit the following week and never edits
    the paid week.
  - With a 48-hour window, Monday's run includes an order delivered Friday at
    23:00 and leaves out one delivered Saturday at 01:00.
- **Copy.**
  - No page, metadata or message file, in any locale, mentions a survival
    guarantee, a guarantee period or free delivery.
  - `/guarantee` redirects to `/delivery`.
  - A RM300 basket is still charged its quoted delivery fee.
- **Isolation (Stage 2).**
  - Signed in as nursery A, `orders` returns 0 rows.
  - `partner_orders()` returns only A's orders, with no phone, email or street
    address.
  - A cannot respond to B's order, change a net price or read bank details.
  - A customer session cannot call any `partner_*` function.
  - A nursery's actions are stamped as that nursery on the timeline.
- **Isolation (now).** `anon` and customers read 0 rows of `partners`,
  `partner_offers`, `partner_ledger`, `payouts` and `partner_payout_accounts`.
  Managers read 0 rows of payout accounts.

## Open decisions

These are business calls for the owner, not technical ones.

**Decided on 2026-11-24:**

| Decision | Outcome |
|---|---|
| Guarantee | None, for the whole shop. Only the arrival check remains (decision 13). |
| Free delivery | None. The customer always pays the quoted fee (decision 5). |
| Payout | Every Monday, covering orders delivered by the end of Friday. A negative balance carries forward (decision 9). |

**Still open.** Each has a default, so building can start:

| Decision | Default here |
|---|---|
| First area | Sungai Buloh and the Klang Valley |
| Keep EcoPlants' own stock as the house partner | Yes |
| Window to report damage on arrival | 48 hours |
| Nursery confirmation deadline | 2 hours, within pickup hours |
| Delivery fee bands | The placeholders above, reset after about 30 deliveries |
| Most nurseries in one checkout | 3 |
| Nurseries delivering themselves | Allowed per nursery, with the address revealed after acceptance |
| Payment for the pilot | A real gateway straight after Stage 1's group change; manual DuitNow for test orders only |

## What this does not do

- **No nursery storefronts and no nursery-set prices.** Both are Stage 4 or
  later, and only if wanted.
- **No live delivery quotes until Stage 3.** Fees come from bands, and staff book
  the drivers.
- **No automatic WhatsApp until Stage 3.** Staff send prefilled links.
- **No password reset for nurseries** beyond a fresh invite.
- **No reliability scoring until there is data** to score.
- **No multi-day stock holds.** Nursery availability is a flag. An order that
  nobody can fill after acceptance is caught by the decline path, not prevented.
