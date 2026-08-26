# EcoPlants

Live plant storefront for the Malaysian market. Next.js 16 (App Router,
Turbopack) + Tailwind v4 + shadcn/ui, trilingual (EN / BM / 中文) via next-intl.

The design system architecture is shared with GoldChin — see
[ADR 0005](docs/decisions/0005-gold-design-system.md).

Supabase project `yeixalbahkjbchjzvlbo` (ap-southeast-1) is **live**: the
twenty-four migrations in [database/](database/) are applied, the catalogue is
seeded, and the storefront reads from Postgres. RLS is on for every table, and
the advisors report no errors — the four remaining notices are deliberate and
explained in [database/README.md](database/README.md#advisor-state).

```bash
npm run dev            # http://localhost:3000  → redirects to /en
npm run build
npm run lint
npm run check:contrast # WCAG audit of the OKLCH palette — fails on a bad token
npm run dump:seed      # re-dump database/seeds from the live catalogue
```

`.env.local` already carries the project URL and publishable key. The
`service_role` key is still blank, and **nothing in the application needs it**:
the admin panel runs on the signed-in admin's own session, gated by RLS
([ADR 0006](docs/decisions/0006-admin-panel-scope.md)). It is needed only by the
payment webhook, which has no session. Get it from the Supabase dashboard,
Project Settings → API keys, when that webhook is built.

## Routes

Every route is locale-prefixed (`localePrefix: "always"`), so hreflang is
unambiguous and there is no unprefixed duplicate of the default locale.

| Route | State |
|---|---|
| `/[locale]` | Home — dark hero + light board, categories, ledger collection, guarantee band, quiz, trust grid |
| `/[locale]/category/[slug]` | PLP with URL-driven facets, sort, mobile filter sheet |
| `/[locale]/plants/[slug]` | PDP — plate, variant picker, care panel, guarantee, JSON-LD |
| `/[locale]/quiz` | 6-question plant finder with transparent scoring |
| `/[locale]/checkout` | Contact, delivery address, payment method — places a real order |
| `/[locale]/pay/[orderId]` | Stand-in payment screen. Says on screen that nothing is charged |
| `/[locale]/order/[orderId]` | Receipt. The id is the capability; `noindex` |
| `/[locale]/login` · `/signup` | Split-panel auth — brand left, form right; the panel turns between them |
| `/[locale]/account` | Order history and profile; `noindex` |
| `/[locale]/guarantee` | 14-day survival guarantee terms |
| `/admin/login` | Staff sign-in by **username** — English-only, outside `[locale]` |
| `/admin/orders` | Order queue: views, counts, search |
| `/admin/orders/[orderNo]` | Order detail: lines, timeline, transitions, fulfilment |
| `/admin` | Overview: queue counts, trade, top sellers, low stock |
| `/admin/products` · `/[ref]` | Catalogue: copy in three locales, prices, attributes, visibility |
| `/admin/inventory` | Stock levels, adjustments, movement ledger |
| `/admin/categories` | Order and copy |
| `/admin/customers` · `/[email]` | Who has ordered, and their history |
| `/admin/reviews` | Moderation queue |
| `/admin/quiz` | Quiz answers, tallied |
| `/admin/settings` | Delivery rules, guarantee period, WhatsApp number |

Search and the basket are not pages. Search expands in place in the header and
drops live results under the field; the basket is a right-hand slide-over
drawer. Checkout is the only full page in that flow, reached from the drawer.

Product slugs are localised: `/en/plants/snake-plant`,
`/ms/plants/pokok-lidah-jin`, `/zh/plants/huweilan`. 42 PDPs prerender.

Footer links to `/delivery`, `/faq`, `/care`, `/about`, `/privacy`, `/terms`
resolve to the 404 page — those are content pages, not yet written.

## Structure

```
app/
  [locale]/
    (storefront)/    storefront — header/footer/WhatsApp chrome
    (auth)/ (account)/            empty, ready
  [locale]/(auth)/   split-panel auth — its own group, no shop chrome
  (admin)/           second root layout — own <html>, Lora, monochrome, noindex
    admin/(panel)/   guarded: layout redirects to /admin/login without a session
    admin/login/     outside (panel) so it does not guard itself
    layout.tsx       html/body, fonts, providers   (no app/layout.tsx by design)
    template.tsx     .page-enter route transition
  not-found.tsx      root 404 for paths outside any locale
components/
  ui/                shadcn primitives (new-york, neutral)
  brand/             DisplayHeading, primitives, logo, plant-image
  layout/            header shell, nav, footer, locale switcher, smooth scroll
  features/          hero, plant-card, care, buy-box, filter-bar, quiz,
                     cart-provider, cart-drawer, checkout-client, auth-forms,
                     phone-field (shared by login, signup and checkout)
  reactbits/         AnimatedContent, GlareHover (vendored from Gold)
  admin/             admin-page, admin-shell, order-controls, product-forms,
                     stock-forms, misc-forms, order-status-badge
i18n/                routing, navigation, request config
messages/            en.json · ms.json · zh.json
lib/
  account/           phone normalisation, customer session, auth actions
  checkout/          placeOrder / payForOrder / abandonOrder, and the receipt read
  admin/             session guard, reads per module, server actions, formatters
                     enums.ts is the client-safe half — constants the forms need
                     without dragging server-only code into the browser bundle
  cart/              cookie serialisation, line resolution, totals
  data/
    queries.ts       the data-access boundary — every catalogue read
    settings.ts      shop settings, read as anon; site.ts holds what is left
    facets.ts quiz.ts site.ts
  supabase/          client (browser) · server (cookies) · admin (service_role)
                     · public (anon, no cookies — catalogue reads)
  utils/             sen ↔ major conversion
database/            versioned SQL — migrations + seeds, all applied
docs/design/ decisions/ research/
scripts/             check-contrast.mjs, dump-seed.mjs
proxy.ts             locale negotiation (Next 16 renamed middleware → proxy)
```

## Conventions

- **Semantic tokens only.** Components never touch a primitive ramp or a raw
  colour. `npm run check:contrast` guards every text pair.
- **Money is integer sen**, formatted through next-intl
  ([ADR 0002](docs/decisions/0002-money-as-integer-sen.md)). Never
  `"RM " + amount`.
- **Labels are message keys.** Badges, sizes, pot colours and care attributes
  are all keys, not literals.
- **Translations are side tables** keyed by locale, not JSONB — the shape the
  Postgres schema will use, so per-locale slug lookup can be indexed.
- **Facets live in the URL.** Filtered listings must be shareable and backable,
  and every facet option carries the count it would yield.
- **The cart is the cookie.** `useSyncExternalStore` reads it, so the badge, the
  drawer and checkout cannot disagree
  ([ADR 0003](docs/decisions/0003-guest-cart-in-cookie.md)).
- **Pet safety is three-state** — safe / toxic / unverified.
- **Entrance animations are CSS keyframes**, so a failed bundle cannot blank the
  page. Scroll reveals are GSAP and honour `prefers-reduced-motion` explicitly.
- Import `Link` / `useRouter` from `@/i18n/navigation`, never from `next/*` —
  the plain versions drop the locale prefix.

## Data layer

`lib/data/queries.ts` is the only module that talks to the catalogue. It reads as
`anon` through `lib/supabase/public.ts` — deliberately not the cookie-bound
server client, because calling `cookies()` would opt all 42 prerendered product
pages out of static rendering to read data that carries no session.

Reads are deduped per render pass with React's `cache`, not a module-level
promise: a process-lifetime cache would pin stock levels, so "only 3 left" would
still say 3 long after they sold.

Stock shown to shoppers is `quantity_on_hand - reserved`. On-hand alone
oversells against checkouts in flight.

Faceting, facet counts and related-product scoring still run in TypeScript over
the fetched set. For fourteen plants that is right — facet counts need the whole
category in memory anyway. `plant_attributes` is indexed on every facet column
for the day that changes.

## Customer accounts

An account is a **Malaysian mobile number and a password** — not email. A
customer here gives you a number, expects WhatsApp, and may not check email;
Supabase stores it in E.164, which is also what `wa.me` wants. Staff keep email,
and the two identities cannot be confused: the `customers` row is created by a
trigger only when the auth user has a phone.

`012-345 6789`, `0123456789` and `+60 12 345 6789` are the same account. One
field enforces that everywhere it is asked for — login, signup and checkout all
use `components/features/phone-field.tsx`, where `+60` is a fixed label rather
than something to type and the national part regroups on every keystroke.

**No SMS provider is involved.** Supabase's own phone identity cannot be enabled
without Twilio credentials, even with confirmations off, so that subsystem is
skipped: the number is stored as an internal key
(`60123456789@phone.ecoplants.my`) that nobody sees or types, and
`customers.phone` holds the real E.164. Nothing to configure, and no unused
third-party credentials sitting in the project.

**No OTP** — the number and a password, nothing else. That leaves the number
unverified, so guest orders are never matched to an account by phone. Instead the
receipt page offers a signed-in customer a "save to my account" button: the order
id in that URL is 122 bits handed to one person at checkout, so holding it
already grants read access and claiming adds nothing. A forwarded link cannot
take an order off its buyer ([ADR 0008](docs/decisions/0008-customer-accounts-by-phone.md)).

## Buying something

Checkout places a real order. `placeOrder` reads the cart **from the cookie
server-side** and sends nothing but variant ids and quantities to
`place_order()`, which recomputes every price from the catalogue, the delivery
fee from settings, and the East Malaysia restriction from each product — then
reserves stock and rolls the lot back if any line fails. The totals rendered on
the page are display only. A tampered cookie can change what is in the basket
and never what it costs.

There is no INSERT policy on `orders`; rows arrive only through that function.
The cookie is deleted once the order exists, so a refresh cannot place it twice.

`/pay/[orderId]` stands in for a gateway and **says on screen, in all three
languages, that nothing is charged**. What its button calls — `confirm_payment()`
— is what the real webhook will call: idempotent, with a unique `payment_ref` so
a replay conflicts at the database rather than committing stock twice.

`/order/[orderId]` is the receipt. With no customer accounts, the order UUID is
the capability: handed over once, never listed, `noindex`, and read through a
function that returns what a receipt needs and not the customer's phone number.

## Admin panel

Overview, orders, products, inventory, categories, customers, reviews, quiz
answers and settings. Product photography is the one module not built — there is
no imagery to manage yet. [ADR 0006](docs/decisions/0006-admin-panel-scope.md)
has the scope and the reasoning.

Products, variants and categories can be **edited but not created or deleted**
from the panel. A variant carries a SKU, an inventory row and price snapshots on
historical orders; a category slug is baked into URLs and the nav. Both are code
changes as much as data changes.

It runs at `/admin`, outside `[locale]` and excluded from locale negotiation in
`proxy.ts`: staff share one language, and translating a back office triples the
copy for no customer benefit. It has its own root layout, renders monochrome so
colour means order status and nothing else, and is `noindex`.

**Access is enforced twice, independently.** The route guard redirects a
sessionless visitor, and every server action re-checks — a server action is a
public HTTP endpoint, not a private function. Underneath, RLS refuses anyone who
is not in `admin_users`, so the panel never holds a `service_role` key. Status
moves only through `transition_order()`, which locks the row, validates the
transition, applies the stock effect and writes the timeline entry in one
transaction, attributing it to the caller's own session.

Stock only moves by hand through `adjust_stock()`, which refuses to go below
zero or below what checkouts in flight have reserved, and writes a
`stock_movements` row saying who did it and why. `inventory` has no update
policy, so there is no second path.

Shop settings — the free-delivery threshold, delivery fee, guarantee period,
WhatsApp number, low-stock level — live in the database and drive the
storefront. Changing the guarantee period in the panel changes it in English,
Malay and Chinese copy and in page metadata, because those strings take it as a
parameter rather than spelling out a number.

Checkout still does not submit, so orders reach the panel only through
`database/seeds/0002_demo_orders.sql`. Those are scaffolding, prefixed `DEMO-`;
purge them with `0003_purge_demo_orders.sql` before the first real order, and
change the demo admin password before the panel is reachable from anywhere but
localhost.

## Translation status

English is the source. Malay and Chinese UI strings and catalogue copy are
complete but **pending review by native speakers** before launch. Missing
product fields fall back to English rather than rendering blank
(`lib/data/queries.ts`), and in development a missing key renders as `⟨key⟩` so
gaps are visible in review.

## Next steps

1. **Connect a payment gateway.** `/pay/[orderId]` is a button that says so.
   Swapping it for the real thing is: add `SUPABASE_SERVICE_ROLE_KEY`, build the
   webhook, then `revoke execute on confirm_payment from anon, authenticated`
   and grant it to `service_role`. Everything downstream of that function is
   already the real implementation
   ([ADR 0007](docs/decisions/0007-order-placement-and-payment.md)).
2. **Send the confirmation email.** The receipt page says one is on its way and
   nothing sends it. A customer who closes the tab has lost the only link to
   their order, so this is a real gap rather than a nicety.
3. Customer accounts: login, order history, saved addresses. The tables and
   their user-scoped policies already exist; there is no UI.
4. Real photography — `product_images` and `product_image_translations` are
   ready and empty. See the imagery direction in the design system. The panel's
   images module is deferred until there is imagery for it to manage.
5. Write the remaining content pages.
6. Bundle a CJK display face before the Chinese storefront launches — the `zh`
   headings currently synthesise their italic.

Background and market research: [docs/research/blueprint.md](docs/research/blueprint.md).
