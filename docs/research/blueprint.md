# EcoPlants: Design, UX & Technical Build Blueprint for a Malaysian/SEA Plant Ecommerce Store

## TL;DR
- **Build it mobile-first on Next.js 16 (App Router + stable Turbopack + explicit `"use cache"`/Cache Components) with Supabase (Postgres + Auth via `@supabase/ssr` + Storage), hosted on Vercel Singapore (`sin1`) with the Supabase project in `ap-southeast-1` (Singapore).** This single-region co-location is the most important performance decision for SEA latency.
- **Payments and trust are the make-or-break conversion levers for Malaysia:** you MUST offer FPX, DuitNow QR, and e-wallets (Touch 'n Go, GrabPay, ShopeePay, Boost) — cards cover only ~28% of Malaysian online purchases, so a card-only Stripe integration misses the majority of buyers. Pair Stripe (cards + FPX) with a local gateway (Billplz, ToyyibPay, Chip, or Fiuu), plus WhatsApp support and a clear live-plant replacement guarantee.
- **Differentiate visually** with a warm earthy palette (terracotta + sage + cream + deep forest, NOT generic bright green), a serif/sans pairing (Fraunces or Lora + Inter/Plus Jakarta Sans), consistent lifestyle photography, and plant-specific PDPs (light, water, pet-safety, mature size, difficulty) with a plant-finder quiz.

## Key Findings
1. **Next.js 16 (released October 21, 2025) is a major release** that changes the caching mental model: caching is now opt-in via `"use cache"` and Cache Components, Turbopack is the default bundler, `middleware.ts` is renamed to `proxy.ts`, params are async, and Node.js 20.9+ is required. This directly affects how you architect a catalog site's rendering and where you put Supabase session refresh.
2. **Malaysia's payment market is fragmented and mobile-dominant.** Cards account for only ~28% of online purchases (Antom); account-to-account transfers (FPX/DuitNow) are the most-used method. E-wallet adoption reached 88% of Malaysians in 2024 (Oppotus), up from 63% in 2023. No single gateway cleanly covers everything, so a two-gateway strategy is standard.
3. **Live plants are legally and operationally "perishable goods"** — every serious plant retailer runs a time-boxed health guarantee (7–30 days) with photo proof and replacement-not-refund terms. This must be a first-class part of your PDP and policy design.
4. **Plant-finder quizzes convert well** (quiz-takers convert ~2.75× the site-wide baseline per RevenueHunt) and capture zero-party data for personalization — a proven pattern for this exact category.
5. **Co-locating Vercel + Supabase in Singapore is essential.** Developers repeatedly report ~5-second auth latency and ~500ms page delays when Vercel functions default to Washington (`iad1`) while Supabase sits in Singapore.

## Details

### PART 1 — VISUAL DESIGN & UI

#### 1.1 Design direction & trends (2025–2026)
The dominant ecommerce design trends for 2026 are minimalism with strong visual hierarchy, mobile-first layouts, fast Core Web Vitals, subtle micro-animations, and "web sustainability" (lighter pages, conscious design). For a plant/eco brand these align naturally: clean layouts let the product (the plant) breathe, and a lighter page is both faster and on-brand for sustainability.

The strategic risk for a plant store is the **"generic green trap"** — defaulting to a saturated leaf-green everywhere, which makes you indistinguishable from every other nursery. The differentiation move is to treat green as a supporting/structural color and lead with a warm earthy accent (terracotta/clay) that signals craft and sustainability.

#### 1.2 Reference sites to study
- **The Sill** (thesill.com) — Shopify-based; the gold standard for approachable, education-forward plant retail. Notably restructured its information architecture to **one PDP per product** with size/color variants selected on the PDP (not separate PDPs per variant) — a direct lesson for your variant model. Broad top-level nav (Plants, Supplies, Gifts, Featured) with faceted drill-down on category pages.
- **Bloomscape** (bloomscape.com) — pre-potted, fully-grown plants; 5 pot sizes and colors; PDPs include care tips, light, and pet-friendliness. Strong "arrives healthy" positioning.
- **Patch Plants** (patchplants.com, UK) — playful tone, plant nicknames, styling/installation services.
- **Léon & George**, **Beards & Daisies**, **Plant Circle** — premium/design-forward European references.
- **Malaysian/SEA players to study directly:** Bloomspace.co, The Plants (theplants.com.my), Melur.com (20+ years, also on Shopee/Lazada), GardenMart4U (since 2010, Penang), Little Eden Succulents (KL/PJ terrariums), Bangsar Garden, Floristika. Also study the Shopee/Lazada plant category pages, since that is where most Malaysian buyers currently shop and set expectations.

#### 1.3 Color palette (concrete hex codes)
Lead with earth tones, use green structurally. Recommended tokens:

**Primary / brand**
- Terracotta (primary CTA / brand accent): `#C36F4E` (or the canonical terracotta `#E2725B`)
- Clay (secondary warm): `#B66A50`
- Ochre (badges/highlights): `#CC9544`

**Greens (structural, not "generic green")**
- Deep Forest (headers, footer, eco badges): `#4A5A35`; deeper UI chrome `#065F46`
- Olive (secondary): `#6B7A3F`
- Sage (panels, cards, calm surfaces): `#9CAF88`
- Moss: `#7A7C4E`

**Neutrals**
- Off-white / cream background: `#FAF9F6`
- Pale sand: `#E5D2B8` / `#D9C2A3`
- Walnut / espresso text: `#5C4433`
- Charcoal / near-black for body copy (max contrast)

Use the **60-30-10 rule**: ~60% neutral (cream/sand surfaces), ~30% green structure, ~10% terracotta accent reserved for CTAs and badges, so calls to action pop. Limit terracotta to key actions to avoid "visual heat overload." Avoid pairing terracotta with saturated rose (`#FF1D8D`), neon green (`#2CFF05`), or bright yellow (`#FFED29`) — they clash with its earthy warmth.

**Accessibility:** Green-on-green and terracotta-on-cream are the two biggest contrast risks. Deep forest `#065F46` on cream passes WCAG AA for text; sage `#9CAF88` does NOT have enough contrast for body text on white and should be used only for surfaces/large elements, with walnut/charcoal text on top. Always run every text-on-color combination through a WCAG contrast checker and target **AA (4.5:1 body, 3:1 large text)**; document forbidden pairs (e.g., light terracotta captions on peach) in the design system README.

#### 1.4 Typography
Use a serif display + humanist/geometric sans body pairing for the "organic but modern" feel. All are free Google Fonts / open source:
- **Fraunces** (variable, "soft, wonky" serif) + **Inter** or **Plus Jakarta Sans** for body — modern, distinctive, high legibility.
- **Lora** (calligraphic-rooted serif) + **Open Sans** or **Inter** — safe, warm, highly readable.
- **Alegreya** (friendly, organic, book-designed serif) + **Alegreya Sans** or **Lato** — natural/editorial feel from a single type family.
- Softer alternative body: **Nunito** (rounded, friendly).
- For characterful headings, **DM Serif Display** or **Vollkorn** (explicitly recommended for "crafts, food, or nature" sites) paired with a neutral sans body.

**Regional character support:** Malay (Bahasa Malaysia) uses standard Latin script, so any of the above works. If you plan Chinese or Tamil UI (relevant to Malaysia's multilingual market), use **Noto Sans** / **Noto Serif** families for full CJK and Tamil coverage and pair them with your Latin fonts for visual consistency.

#### 1.5 Imagery & photography direction
- **Blend lifestyle and isolated shots.** Use a clean off-white/cream seamless background for the primary catalog/PLP thumbnail (consistency, fast scanning) and lifestyle/in-context shots (plant styled in a home) in the PDP gallery. The Sill and Bloomscape both do this.
- **Consistency rules:** fixed aspect ratio (e.g., 4:5 portrait for plants), consistent soft daylight lighting, consistent pot for size reference, a human hand or common object for scale.
- **Show scale explicitly** — plant + pot size is a top purchase question. Include a "size guide" image.
- Because plants are natural products, include a "your plant may vary" note (see 2.2).

#### 1.6 Layout patterns
- **Hero:** single strong lifestyle image + short value prop + one primary CTA (Shop Plants) and a secondary "Take the plant quiz." Avoid carousels.
- **Product grid:** medium density — 2 columns on mobile, 3–4 on desktop; generous whitespace; card = image, name (common + botanical), price, 1–2 care icons (light/water), pet-safe badge, quick-add.
- **Category nav:** broad top-level (Indoor, Outdoor/Garden, Pots & Planters, Soil & Care, Gifts) with faceted filtering on the PLP.
- **Whitespace** is a feature, not waste — it reads as premium and calm, on-brand for plants.

#### 1.7 Iconography, illustration & motion
- Simple line icons for care attributes (sun/light level, watering droplet, pet paw for pet-safe, ruler for size, leaf-meter for difficulty).
- Hand-drawn botanical line illustrations as brand texture (dividers, empty states, packaging).
- Micro-interactions: subtle card hover lift, "added to cart" leaf animation, smooth page transitions. Next.js 16 ships React 19.2 **View Transitions** natively — use them for tasteful PLP→PDP transitions, keep motion subtle, and respect `prefers-reduced-motion`.

#### 1.8 Mobile-first
SEA ecommerce is overwhelmingly mobile; most Malaysian plant buyers currently transact on Shopee/Lazada mobile apps. Design for thumb-reachable CTAs, a sticky add-to-cart bar on the PDP, large tap targets, and a mobile filter drawer. Performance is a conversion factor — every extra second of load reduces conversions.

### PART 2 — ECOMMERCE UX & CONVERSION

#### 2.1 PLP & PDP essentials for plants
Buyers need decision info that generic ecommerce PDPs lack. Include on every plant PDP:
- **Light requirement** (low / bright indirect / direct)
- **Watering frequency**
- **Pet safety / toxicity** (reference ASPCA data — e.g., Spider Plant, Peperomia, Parlor Palm, Bird's Nest Fern, Boston Fern are non-toxic; note that "Lucky Bamboo" (*Dracaena sanderiana*), aloe vera, jade, and kalanchoe are toxic despite common assumptions)
- **Mature size** plus current size / pot size
- **Difficulty level** (beginner/easy → expert)
- **Indoor vs outdoor**, and for garden plants, sun/climate suitability framed for **Malaysia's tropical climate** — do NOT use US/EU "hardiness zones," which don't apply
- Care guide / "how to keep it alive" section and a link to a fuller care article (content marketing + SEO).

Follow The Sill's IA lesson: **one PDP per product**, with size/pot/color chosen as variants on the PDP, rather than a separate PDP per variant (which clutters PLPs and hurts conversion).

#### 2.2 Handling live/perishable-goods challenges
- **Plant health guarantee** (benchmarked against real, current policies):
  - **Bloomscape (US):** 30-day guarantee — *"all plants are guaranteed for 30 days after arrival… We will happily send you a replacement plant free of charge in the unlikely event that your plant arrives dead."* Repotting within 30 days voids it; photo proof required.
  - **The Sill (US):** 30-Day Customer Happiness Guarantee — plants replaceable only if they arrive damaged/unhealthy (not change-of-mind), reported within 30 days with photos.
  - **Patch Plants (UK):** *"If you're unhappy with your plant for any reason, contact us within 30 days… we can collect it and refund the cost of the plant, provided you've been following our care instructions."* Free standard delivery over £50, else £4.90.
  - **Malaysian benchmarks:** Bloomspace.co runs a **14-day** guarantee (*"if your plant perish within 14 days upon delivery… we will arrange a replacement… Limited to one replacement only for each purchase"*), free shipping above **RM150**; The Plants (theplants.com.my) runs a **7-day** guarantee, damage reported within 3 days, one replacement per order.
  - **Recommendation for EcoPlants:** offer a **14-day survival guarantee** (competitive with Malaysian norms, more generous than 7 days), replacement-not-refund, one replacement per item, photo proof, a repotting-voids-guarantee clause, and a "collect your parcel within 24 hours" clause standard among MY sellers.
- **"No two plants alike" disclaimer:** use wording like The Sill's — *"Live plants… will have variations in color, texture, finish, and size. While we make every effort to display our plants as accurately as possible, there may be subtle differences from what is displayed online."*
- **Shipping restrictions & seasonality:** flag which plants ship to East Malaysia (Sabah/Sarawak) vs Peninsular only; large/fragile plants may be Klang Valley-only or self-pickup; offer heat-safe packaging where relevant (sun/heat stress in transit is the tropical-market analogue of cold-pack shipping).
- **Size/pot variants:** model as SKU variants (size × pot color).

#### 2.3 Filtering & faceted search
Offer facets specifically for: light level, care difficulty, pet-friendly, size, price, indoor/outdoor, and "beginner-friendly." Use a mobile filter drawer with applied-filter chips. These map directly to your plant-attribute schema (Part 3.3).

#### 2.4 Plant-finder quiz
Add a **5–8 question** plant-finder quiz ("How much light? Do you have pets? How often will you water? Beginner or expert?") that outputs a curated shortlist. Evidence: per RevenueHunt's *State of Product Recommendation Quizzes: 2026 Benchmark Report*, **5.5% of shoppers who finish a quiz place a tracked order — about 2.75× a ~2% site-wide baseline** (noting this is a self-selected quiz-taker rate, not a like-for-like site-wide rate). Quizzes also capture zero-party data for email/WhatsApp remarketing and lift AOV. Keep to ≤8 questions (completion drops sharply beyond that). Tools: RevenueHunt or Octane AI if on Shopify; for a custom Next.js build, implement natively and store responses in Supabase (`quiz_responses`).

#### 2.5 Cart, checkout & payments (Malaysia-specific)
This is the highest-leverage conversion area. Malaysian consumers switch between FPX online banking, e-wallets, cards, DuitNow QR, and BNPL. Cards cover only ~28% of online purchases (Antom); account-to-account (FPX/DuitNow) is the most-used method; COD remains relevant.
- **Must-have methods:**
  - **FPX** — the #1 online method, backed by 29+ banks, high limits, low fees.
  - **DuitNow QR** — the national QR standard; transactions **more than doubled from 360M (2023) to 870M (2024), worth RM31.1bn** across 2.6M acceptance points (Bank Negara Malaysia Annual Report 2024).
  - **E-wallets** — Touch 'n Go eWallet (**20M+ verified users, 13M+ monthly actives, 2M+ merchants, >RM15bn monthly volume; 38% of DuitNow QR acquisitions** per BNM/SoyaCincau), GrabPay, ShopeePay, Boost. E-wallet adoption hit **88% of Malaysians in 2024, up from 63% in 2023** (Oppotus).
  - **Cards** (Visa/Mastercard) for higher-value orders; **BNPL** (Atome, SPayLater) optional to lift AOV.
- **Gateway strategy:** Stripe supports **cards + FPX** in Malaysia (requires a Malaysian entity + Business Registration Number; ~3% + MYR 1.00 per transaction; FPX is single-use/redirect-based and NOT supported for subscriptions or Express Checkout). Stripe alone does not cover local e-wallets well, so pair it with a **local gateway** — Billplz (cheap FPX flat rate ~RM0.70), ToyyibPay, Chip, or **Fiuu** (Razer Merchant Services, Malaysian-native: FPX + DuitNow + TNG + GrabPay + cards + BNPL + OTC cash). **HitPay** and **Xendit** are strong single-integration options covering FPX + all e-wallets + DuitNow. **Recommendation:** Fiuu or Xendit/HitPay for local breadth, optionally Stripe for international cards.
- **COD:** Malaysian buyers expect a COD option; Ninja Van, Flash Express, and GDEX support COD. Offer it at least in the Klang Valley.
- **Delivery/couriers:** J&T Express (default for MY ecommerce, from ~RM5.42), Flash Express (cheapest, from ~RM5.27), Ninja Van (good Klang Valley coverage, strong COD + tracking), Pos Laju (widest rural + East Malaysia coverage). For **same-day plant delivery** in KL/Penang/JB use **Lalamove** (motorcycle from ~RM5 base + ~RM0.70/km; car/van for larger plants). Use **EasyParcel** to compare/aggregate couriers. Peninsular→East Malaysia takes ~7–8 working days — flag this for live plants (may be too long); restrict fragile live plants to Peninsular or Lalamove same-day.

#### 2.6 Trust signals & social proof
- Reviews with photos (UGC of plants thriving in real homes), star ratings on PLP cards.
- Prominent guarantee badge, secure-payment icons, courier logos.
- Longevity/trust framing (Melur.com leans on "20+ years, trusted on Shopee/Lazada" — replicate this).
- Real customer plant photos build confidence that plants arrive healthy.

#### 2.7 Conversion optimization
- **WhatsApp is essential in Malaysia** — it is the country's single most-used platform: **90.7% of Malaysian internet users use WhatsApp monthly**, with an **80.1% instant-messaging market share** (DataReportal Digital 2025 Malaysia; Elite Asia). Add a click-to-WhatsApp button for pre-sale plant advice and post-sale care/order tracking; consider WhatsApp Business API automation for order confirmations, shipping updates, and abandoned-cart nudges (very high open rates).
- Care-guide content marketing (blog) for SEO and to reduce "will it die?" purchase anxiety.
- Bundles (plant + pot + soil), subscriptions (monthly plant / care box — The Sill and Bloomscape both do this), stock/urgency cues ("only 3 left"), and free-shipping thresholds (**RM150** is the common MY benchmark).

#### 2.8 SEO
- Product + category schema (JSON-LD `Product`, `Offer`, `AggregateRating`), fast Core Web Vitals (design + SEO are now linked), descriptive plant-care articles targeting long-tail queries ("pet-safe indoor plants Malaysia," "pokok dalam rumah").
- **Local SEO for Malaysia:** Google Business Profile if you have a physical nursery, Malaysia-targeted keywords in both English and Bahasa Malaysia, `hreflang` if multilingual, and consistency with your Shopee/Lazada storefronts.

### PART 3 — NEXT.JS 16 + SUPABASE ARCHITECTURE

#### 3.1 What's actually new in Next.js 16 (verified against the official release, Oct 21 2025)
- **Cache Components + `"use cache"`:** Caching is now **opt-in and explicit**. All dynamic code runs at request time by default; you opt specific pages/components/functions into caching with the `"use cache"` directive (enable `cacheComponents: true` in `next.config.ts`). This completes Partial Prerendering (PPR) — static shells with dynamic Suspense holes. The old implicit fetch caching is gone; the experimental `experimental.ppr` flag was removed.
- **Turbopack is the default bundler** (stable) for dev and build — 2–5× faster production builds, up to 10× faster Fast Refresh. Opt back with `--webpack` if you have custom webpack config.
- **`middleware.ts` → `proxy.ts`:** middleware renamed to `proxy.ts`, running on the Node.js runtime (`middleware.ts` still works for Edge but is deprecated). **This directly affects the standard Supabase SSR pattern, which puts session refresh in `middleware.ts` — place it in `proxy.ts` now.**
- **Async `params`/`searchParams`:** now async — must be awaited.
- **New caching APIs:** `revalidateTag(tag, profile)` now requires a `cacheLife` profile for stale-while-revalidate (recommend `'max'`); new `updateTag()` (read-your-writes in Server Actions, ideal after inventory/cart mutations) and `refresh()` (refresh uncached data only).
- **React 19.2 / React Compiler stable:** View Transitions, `useEffectEvent`, `<Activity>`; React Compiler auto-memoization is stable (opt-in via `reactCompiler: true`, Babel-based so build times rise).
- **Requirements/breaking:** Node.js 20.9+, TypeScript 5.1+, modern browsers (Chrome/Edge/Firefox 111+, Safari 16.4+); `next/image` defaults tightened; AMP and `next lint` removed.
- **DevTools MCP** for AI-assisted debugging.
- **16.3 follow-up:** added Instant Navigations, ~90% less dev RAM, faster builds/type-checking, and up to 22% more requests under load — verify against the exact minor version you install.

#### 3.2 Recommended project structure
```
/app
  /(shop)              # storefront route group
    /page.tsx          # home (static + cached)
    /plants/[slug]     # PDP
    /category/[slug]   # PLP
    /cart
    /checkout
  /(auth)/login, /signup
  /(account)           # orders, wishlist, addresses (server-rendered, per-user)
  /(admin)             # inventory management (protected)
  /api/webhooks/...    # payment webhooks (route handlers)
/lib/supabase
  client.ts            # createBrowserClient
  server.ts            # createServerClient (reads cookies)
  middleware-helper.ts # updateSession() used by proxy.ts
proxy.ts               # (was middleware.ts) — refresh Supabase session
/components
```
Scaffold with `create-next-app@latest` (App Router, TypeScript, Tailwind by default).

#### 3.3 Supabase schema (core tables)
- `categories` (id, slug, name, parent_id, type: indoor/outdoor/pots/soil/care)
- `products` (id, slug, name_common, name_botanical, description, category_id, base_price, is_active, seo fields, `search_doc tsvector`)
- `plant_attributes` (product_id FK, light_level, water_frequency, pet_safe bool, toxicity_note, difficulty, mature_height_cm, indoor_outdoor, humidity, sun_requirement) — the facet source
- `product_variants` (id, product_id, sku, size, pot_color, price, weight_grams for shipping)
- `inventory` (variant_id, quantity_on_hand, reserved) — or columns on variants
- `product_images` (id, product_id/variant_id, storage_path, alt, position, is_primary)
- `customers` (id → `auth.users.id`), `addresses` (customer_id, …state, poscode, is_default)
- `carts` (id, customer_id nullable for guest, session_id) + `cart_items` (cart_id, variant_id, qty) — persist carts for logged-in users
- `orders` (id, customer_id, status, subtotal, shipping_fee, total, payment_method, payment_status, courier, tracking_no, shipping_address_json)
- `order_items` (order_id, variant_id, qty, unit_price snapshot)
- `reviews` (id, product_id, customer_id, rating, body, image_paths, is_approved)
- `wishlists` (customer_id, variant_id)
- `quiz_responses` (customer_id/session, answers_json, recommended_ids) — zero-party data
Use `numeric(10,2)` for MYR money values; add a GIN index on `search_doc`.

#### 3.4 Auth with `@supabase/ssr` + Next.js 16
- Install `@supabase/supabase-js` + `@supabase/ssr`. Create `createBrowserClient` (client components) and `createServerClient` (server components/actions, reads cookies via `next/headers`).
- **Session refresh in `proxy.ts`** (formerly middleware) is the single most important auth correctness step: it must silently refresh expired sessions AND pass the refreshed cookies back on the response, or users get randomly logged out (a very common production bug).
- **Always use `supabase.auth.getUser()` (not `getSession()`) in server code** to validate — `getSession()` reads cookies that can be spoofed and isn't guaranteed to revalidate the token.
- Calling `cookies()` before Supabase opts those fetches out of Next.js caching — correct for per-user data.

#### 3.5 RLS policy patterns
Enable RLS on **every** public-schema table.
- `products`, `categories`, `plant_attributes`, `product_images`: public read (`select` policy `true` for `anon, authenticated`), writes restricted to admin role only.
- `orders`, `order_items`, `addresses`, `carts`, `wishlists`: user-scoped — `using (auth.uid() = customer_id)` for select/insert/update.
- `reviews`: public read where `is_approved = true`; insert where `auth.uid() = customer_id`.
- Index policy columns (e.g., `customer_id`) for performance.
- **Never expose the `service_role` key to the client** — it bypasses RLS; a leaked service key is a total database compromise. Use it only server-side for admin/webhook operations.

#### 3.6 Storage + image optimization
- Store product imagery in a public Supabase Storage bucket. Supabase Storage provides on-the-fly **Image Transformations** (imgproxy under the hood: resize/quality/auto-WebP, plus a Smart CDN) on **Pro plan and above**.
- Integrate with `next/image` via a **custom loader** (`supabase-image-loader.js`) pointing at `/storage/v1/render/image/public/...?width=&quality=`; set `loader: 'custom'` in `next.config`.
- Pre-generate common variants, set long `Cache-Control`, and upload reasonably sized originals to control egress costs.

#### 3.7 Payment integration + webhooks
- **Stripe:** use Checkout or Payment Element; enable FPX + cards in the Malaysian Stripe dashboard. Handle confirmation via a Stripe **webhook** route handler (`/api/webhooks/stripe`) that verifies the signature, then updates `orders.payment_status` and decrements inventory. FPX is single-use/redirect-based, not for subscriptions.
- **Local gateway (Fiuu/Billplz/ToyyibPay/Chip/Xendit/HitPay):** each provides a redirect + webhook/callback; implement a route handler per provider, verify signatures, and use idempotency keys.
- Keep webhook handlers on the Node.js runtime, use the Supabase `service_role` client server-side, and make order fulfillment **idempotent** (webhooks can fire more than once).

#### 3.8 Rendering strategy & Core Web Vitals
- **Home & category (PLP):** static/ISR with `"use cache"` — catalog changes infrequently; cache with a `cacheLife` profile and `revalidateTag` on product updates.
- **PDP:** mostly cached shell (name, description, images, care attributes) with dynamic Suspense holes for live stock level and variant price.
- **Cart/checkout/account:** fully dynamic, per-request, per-user (no caching).
- **Admin:** dynamic, protected.
- Use `updateTag()` in Server Actions after inventory/price edits for read-your-writes. This static-first approach maximizes Core Web Vitals (LCP/CLS), which matters for both conversion and SEO.

#### 3.9 Search
- **Start with Postgres full-text search** (`tsvector` + GIN index) — free, in-database, good enough for a modest catalog; add `pg_trgm` for fuzzy/typo tolerance and use `websearch` query type via `.textSearch()`.
- **Graduate to Meilisearch or Typesense** when search UX becomes a growth lever — they offer superior typo tolerance, prefix/instant search-as-you-type (sub-50ms), and faceting out of the box, which Postgres approximates only clumsily. Keep Postgres as the source of truth and sync to the search engine.
- **Recommendation:** Postgres FTS + `pg_trgm` at launch; plan a Meilisearch migration path if catalog/search grows.

#### 3.10 Admin/CMS
- Simplest: build a protected `/(admin)` area in the same Next.js app with Supabase Auth (admin role) + RLS-gated writes, for managing products, variants, inventory, and orders.
- Alternatives: Supabase Studio for quick internal DB edits, or a headless CMS if non-technical staff need rich content editing. For a lean launch, a custom admin panel keeps everything in one stack.

#### 3.11 Deployment (SEA latency)
- **Deploy Vercel functions to Singapore (`sin1`)** and create the **Supabase project in Singapore (`ap-southeast-1`)**. Co-location is critical: the default Vercel region is Washington (`iad1`); a US-function → Singapore-DB round trip has caused ~5s auth times and ~500ms page delays in reported cases. Singapore delivers sub-50ms latency to 600M+ people across SEA and is the natural hub for Malaysia (~900 km from Jakarta, central to the region).
- Use Supabase Edge Function regional invocation (`ap-southeast-1`) if you add edge functions.

#### 3.12 Known gotchas combining Next.js App Router + Supabase
1. **Session refresh must live in `proxy.ts`/middleware and must pass cookies back** — the #1 cause of random logouts.
2. **Use the right client:** browser client in Client Components, server client in Server Components — mixing them causes "localStorage is not defined" / hydration errors.
3. **Use `getUser()` not `getSession()`** in server code for security.
4. **Never leak the `service_role` key** to the client (no `NEXT_PUBLIC_` prefix on it).
5. **Enable RLS on every table** — a table without RLS is fully readable via the anon key.
6. **Async params** in Next.js 16 — await them.
7. **New opt-in caching** — don't assume data is cached; wrap intentionally with `"use cache"` and tag for revalidation.
8. **Clean up Realtime subscriptions** to avoid memory leaks if you use them (e.g., live stock).

## Recommendations
**Stage 0 — Foundations (weeks 1–2):**
- Scaffold with `create-next-app@latest` (Next.js 16, TS, Tailwind). Create the Supabase project in **`ap-southeast-1`**; set Vercel region **`sin1`**.
- Implement `@supabase/ssr` clients + `proxy.ts` session refresh; enable RLS on all tables from day one.
- Lock the design system: tokens above (terracotta `#C36F4E`, sage `#9CAF88`, forest `#065F46`, cream `#FAF9F6`, walnut `#5C4433`), Fraunces/Lora + Inter, and run all combos through a WCAG AA checker.

**Stage 1 — MVP catalog + checkout (weeks 3–8):**
- Build the schema (3.3), PLP/PDP with plant attributes, faceted filters, cart persistence, and a one-PDP-per-product variant model.
- Integrate **Stripe (cards + FPX) + one local gateway (Fiuu or Xendit/HitPay)** with webhook order fulfillment; add COD for the Klang Valley.
- Ship the 14-day survival guarantee + "plants may vary" disclaimer; add courier options (J&T default, Lalamove same-day for KL/Penang/JB) via EasyParcel.
- Add a click-to-WhatsApp support button.
- Postgres FTS + `pg_trgm` search; static/ISR home + PLP, dynamic cart/checkout.

**Stage 2 — Conversion & growth (post-launch):**
- Launch the plant-finder quiz (native, storing to `quiz_responses`); wire zero-party data to WhatsApp/email remarketing.
- Add reviews-with-photos UGC, bundles, and a subscription/plant-of-the-month.
- Start a care-guide blog for SEO (EN + BM); add Product JSON-LD.

**Benchmarks that change the plan:**
- If search usage/catalog grows and typo/instant-search complaints appear → migrate to **Meilisearch/Typesense**.
- If e-wallet checkout share is high but gateway settlement (e.g., GrabPay's slower cycle) hurts cash flow → consolidate on a T+1 local gateway.
- If East Malaysia orders show high DOA/complaint rates due to 7–8 day transit → restrict live plants to Peninsular + same-day Lalamove; sell hardier plants/accessories to East MY.
- If image egress costs climb → pre-generate variants and raise cache TTLs.

## Caveats
- **Fast-moving tech:** Next.js 16 shipped Oct 21, 2025, and 16.3 followed with further routing/build improvements; the `"use cache"`/Cache Components API and `proxy.ts` naming were still stabilizing — confirm against the official Next.js docs for your exact installed minor version.
- **Payment gateway details** (fees, settlement timing, e-wallet coverage) change frequently and vary by contract — confirm current rates directly with Stripe Malaysia and your chosen local gateway; Stripe requires a Malaysian entity + BRN for FPX.
- **Plant-care facts** (light/water/toxicity) in most online sources are US/EU-centric; toxicity should reference the **ASPCA** database, and hardiness/sun guidance must be re-framed for Malaysia's tropical climate rather than US/EU hardiness zones.
- **Quiz conversion figures** (RevenueHunt's ~2.75× and vendor-cited 25–55% figures from Digioh/Interact) come largely from quiz-vendor marketing and are self-selected quiz-taker rates, not like-for-like site-wide rates — treat as directional.
- **The COD "~11% of online purchases" figure** could not be tied to a single authoritative named source and should be verified before relying on it; the broader point (COD remains a meaningful, expected option in Malaysia) is well established.
- **Bloomscape** has faced publicized financial difficulties; its policy pages were live at research time (Aug 26, 2026) but its long-term status is uncertain — use it as a design reference, not a guaranteed-stable competitor.
- **Guarantee windows** (7/14/30 days) reflect specific retailers' current published policies and may change; set your own after checking current competitor pages and your logistics reality.