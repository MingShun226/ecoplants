# EcoPlants Design System

The architecture is GoldChin's, the palette is EcoPlants' — see
[ADR 0005](../decisions/0005-gold-design-system.md) for why.

Tokens are the contract. Components consume the **semantic** names
(`--canvas`, `--text-secondary`, `--border-subtle`), never the primitives and
never a raw colour. That indirection is what makes a future dark theme a token
change instead of a component sweep.

Run `npm run check:contrast` before changing any colour. It parses the OKLCH
values straight out of [app/globals.css](../../app/globals.css) — there is no
duplicated palette to drift — and fails on a pair that drops below WCAG AA.

---

## 1. Colour

### Why OKLCH

This palette lives on one warm axis, clay through sand to cream. Hex ramps drift
grey through the mid-tones on a single-hue system; OKLCH holds perceptual
lightness across the ramp, so `clay-400` really does read as one step lighter
than `clay-500`.

### Strategy — 60 / 30 / 10

| Share | Role | Ramp |
|---|---|---|
| ~60% | Surfaces and page ground | `canvas`, `surface`, `sand` |
| ~30% | Structure and chrome | `leaf` |
| ~10% | Action and emphasis | `clay` |

Clay is scarce on purpose. It marks the primary action in a region and nothing
else — the moment a second clay element appears on a screen, the first stops
meaning "press this". Gold's own principle is "metallic tone on ≤10% of visible
surface"; that rule is about proportion, and it carries over unchanged.

### Primitives

**Clay** — the accent. `50` `.968/.012/45` · `100` · `200` · `300` · `400` ·
`500 .663/.117/39` (brand terracotta) · `600 .566/.113/38` · `700` · `800` ·
`900` · `950`

`500` is the brand accent but **fails AA behind white text** (3.07:1). Buttons
fill with `600` (4.55:1) and hover to `700`. Clay *text* on cream starts at
`700`.

**Leaf** — the structure. `50` … `400 .752/.062/129` (brand sage) … `950
.228/.030/145`. Deliberately desaturated: a saturated leaf green is the "generic
nursery" signal the brand direction exists to avoid. Leaf `400` is a **surface
colour, never body text** — 2.07:1 on cream.

**Ink** — warm neutrals, never pure grey. Cold grey beside terracotta reads like
newsprint and flattens the warmth out of the whole palette; a trace of chroma at
h≈60 keeps the neutrals in the same family as the accent.

**Sand** — the warm paper tones carrying the 60%.

### Semantic layer

`--canvas` `--surface` `--surface-raised` `--surface-sunken` `--surface-inverse`
· `--text-primary` `--text-secondary` `--text-tertiary` `--text-inverse`
`--text-accent` · `--border-subtle` `--border-default` `--border-strong`
`--border-accent`

`.on-dark` / `.on-dark-tokens` remap this layer for dark sections and for chrome
floating over a dark ground it does not own (the header above the hero). Without
the remap the nav keeps its light-theme ink tokens and renders near-invisible.

### Verified pairs

Every pair shipped in a component, measured (full list: `npm run check:contrast`):

| Foreground | Background | Ratio | Needs |
|---|---|---|---|
| text-primary | canvas | 18.70:1 | 4.5 |
| text-secondary | canvas | 9.81:1 | 4.5 |
| text-tertiary | surface-sunken | 4.54:1 | 4.5 |
| text-accent | canvas | 5.90:1 | 4.5 |
| ink-50 | clay-600 | 4.55:1 | 4.5 |
| ink-50 | leaf-950 | 16.08:1 | 4.5 |
| leaf-300 | leaf-950 | 9.86:1 | 4.5 |
| warning | canvas | 4.54:1 | 4.5 |
| clay-600 (focus ring) | canvas | 4.54:1 | 3.0 |
| border-strong | canvas | 3.05:1 | 3.0 |

Six tokens had to be darkened from their first draft to clear these. The solved
lightness values are in the stylesheet; do not nudge them by eye.

### Forbidden pairs

Asserted in the auditor so they cannot silently start passing:

| Pair | Ratio | Why |
|---|---|---|
| leaf-400 on surface / canvas | 2.07–2.17:1 | Sage is a surface, not a text colour |
| clay-500 on clay-100 | 2.62:1 | Light clay on peach |
| leaf-600 on leaf-500 | 1.41:1 | Green-on-green |

---

## 2. Type

**Fraunces** (display) + **Inter** (body), both variable, self-hosted through
`next/font`. One display voice, one UI voice, no third face.

Fraunces was kept over Playfair because the roman/italic accent inside a single
heading needs a **true drawn italic**, not a slanted roman — and its
optical-size axis holds up at display sizes without going spindly.

| Token | Size |
|---|---|
| `text-display-xl` | `clamp(3rem → 6.25rem)` |
| `text-display-lg` | `clamp(2.5rem → 4.75rem)` |
| `text-display-md` | `clamp(2rem → 3.5rem)` |
| `text-display-sm` | `clamp(1.625rem → 2.5rem)` |

The scale runs large on purpose: a plant catalogue that sets its headings at
32px reads like a spreadsheet of stock.

`.numeric` sets tabular figures. **Every price, size and count uses it** —
non-tabular figures in a price list are the fastest way to look unconsidered.

**CJK:** neither Latin face carries CJK glyphs, so the stack falls back to system
faces (Songti SC / Noto Serif CJK for display, PingFang SC / Microsoft YaHei /
Noto Sans CJK for body). The `zh` locale therefore renders in a serif for
headings, but the italic accent is *synthesised* rather than drawn. Bundling a
real CJK display face is an open item before the Chinese storefront launches.

---

## 3. Shape, depth, motion

- **`--radius: 0.25rem`.** Restrained. Heavy rounding reads consumer-app; the
  reference points are botanical plate books and seed catalogues, which are
  near-square. Buttons are the deliberate exception — pills, site-wide, against
  squared form fields. That contrast is the system, not an inconsistency.
- Shadows are **warm**, mixed from a clay-ink base rather than black. Black
  shadow on a cream canvas reads as dirt.
- `--ease-refined` (`cubic-bezier(0.16, 1, 0.3, 1)`) is the house curve.
  Durations 150 / 250 / 400ms. No spring, no bounce, no parallax on product
  imagery.
- **Entrances are CSS keyframes** (`.rise-in`, `.rise-in-lg`, `.page-enter`),
  not JS. A `motion` initial state writes `opacity: 0` into the server HTML, so
  a failed bundle blanks the page; a keyframe can only ever fail to the resting,
  visible state.
- `.page-enter` lives on `app/[locale]/template.tsx` — Next remounts templates
  on every navigation, so the transition replays with no router plumbing while
  the header and footer stay mounted.
- Scroll reveals (`RevealSection`) use GSAP/ScrollTrigger, which sequences more
  reliably than viewport callbacks once several elements share a scroll region.
  It checks `prefers-reduced-motion` itself — `MotionConfig` governs `motion`,
  not GSAP.

---

## 4. Components

| Component | File |
|---|---|
| shadcn primitives | [components/ui/](../../components/ui/) |
| `DisplayHeading` | [components/brand/display-heading.tsx](../../components/brand/display-heading.tsx) |
| `LeafRule` `RuledEyebrow` `WhatsAppIcon` | [components/brand/primitives.tsx](../../components/brand/primitives.tsx) |
| `PlantImage` / `BotanicalPlate` | [components/brand/plant-image.tsx](../../components/brand/plant-image.tsx) |
| `SiteHeader` / `HeaderShell` | [components/layout/](../../components/layout/) |
| `Hero` | [components/features/hero.tsx](../../components/features/hero.tsx) |
| `PlantCard` / `PlantGrid` | [components/features/plant-card.tsx](../../components/features/plant-card.tsx) |
| `CareLine` `CareGrid` `PetSafetyBadge` `DifficultyMeter` | [components/features/care.tsx](../../components/features/care.tsx) |
| `BuyBox` `FilterBar` `PlantQuiz` | [components/features/](../../components/features/) |
| `CartProvider` `CartDrawer` `CheckoutClient` | [components/features/](../../components/features/) |
| `HeaderActions` (in-place search + basket) | [components/layout/header-actions.tsx](../../components/layout/header-actions.tsx) |

### The repeated patterns

1. **Section head** — ruled eyebrow, display heading with an italic accent,
   optional lead, action pinned right. One shape for every section.
2. **Hairline grid** — `gap-px` over a `bg-border-subtle` ground draws dividers
   at every breakpoint without per-cell border logic. Used for the trust band,
   care grid, spec strip and quiz stats.
3. **Ledger row** — hairline-divided list, thumbnail left, fact line, price
   right, arrow that slides in on hover. Same content as a tile grid, a quarter
   the ink.
4. **Frameless plate** — product image on a sunken warm ground, no border to
   fight the photography, shadow on hover, arrow chip rising from the corner.
5. **Dark editorial band** — `.on-dark` token remap, masked backdrop, copy left,
   ledger right.
6. **Grow-in-place controls** — the search icon becomes the left edge of its own
   input rather than opening an overlay, so nothing appears from nowhere. Width
   is the only animated property, driven by CSS `min()` against the viewport so
   there is no resize listener and no state.
7. **Slide-over** — panel on the house curve from the right, scrim fading on a
   slower one so the panel leads and the dim follows. Portalled to `<body>`: a
   modal rendered inside the header would inherit its `on-dark-tokens` and paint
   near-white text onto its own cream panel.

### Rules that are not negotiable

1. **Tap targets ≥ 40px**; icon buttons are `size-10`.
2. **One focus style**, set once in the base layer. Never remove an outline.
3. **Pet safety is three-state** — safe / toxic / unverified. Missing data is
   never rendered as safe.
4. **Money is integer sen** and only becomes a decimal inside next-intl's
   formatter. A raw `priceSen` reaching JSX is a bug.
5. **Images are locked to 4:5**, so real photography drops in without reflow.
6. **Facets live in the URL**, never in component state — and every option
   carries the count it would yield, counted against the *other* groups'
   selections. An option that would yield nothing is disabled, never hidden;
   hiding makes the control jump under the cursor.
7. **No second icon library.** Lucide, 1.5px stroke, sizes 16/20/24.
8. **Labels are message keys**, never literals — three locales.

---

## 5. Imagery direction

No photography yet, so each plant renders a deterministic botanical plate seeded
by id, with four silhouettes (broad / blade / split / frond) inferred from the
botanical name so a grid does not read as one plant repeated. Backdrops use the
same component with `showPot={false}` — a pot blown up to hero scale reads as a
brown slab.

When shooting:

- **4:5 portrait**, fixed. Warm ground, never pure white — foliage on white
  loses its edge definition.
- Lifestyle shots for the PDP, catalogue shots for the grid.
- Include a **scale frame** — plant beside a common object or a hand.
- Shoot the plant that ships. The variation notice covers natural difference,
  not a bait-and-switch.
