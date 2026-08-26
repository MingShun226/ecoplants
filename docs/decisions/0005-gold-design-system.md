# ADR 0005 — Adopt the GoldChin design system architecture

**Status:** accepted · **Date:** 2026-08-26 · **Supersedes parts of** [ADR 0004](0004-no-dark-mode-yet.md)

## Context

EcoPlants and GoldChin (`~/Desktop/Gold`) are built by the same team. Gold's
design system is mature and deliberate: OKLCH tokens layered primitive →
semantic, a 4px base radius, one display serif with roman/italic mixing inside
single headings, hairline structure, CSS-keyframe entrances, and a scroll-aware
header that sits transparent over a dark hero.

The instruction was to copy that design. The open question was how literally.

## Decision

Copy the **system**, not the palette.

- **Token architecture** is Gold's, verbatim in structure: OKLCH primitives
  (`clay`, `leaf`, `ink`, `sand`) → semantic layer (`--canvas`, `--surface`,
  `--surface-sunken`, `--text-primary/secondary/tertiary`,
  `--border-subtle/default/strong`) → shadcn contract. Components consume the
  semantic names only.
- **Palette** stays EcoPlants': terracotta as the 10% accent, sage/forest as the
  30% structure, cream/sand as the 60% ground. Gold's ramp on a plant shop would
  read as a bullion boutique and drop the botanical signal entirely.
- **Stack** mirrors Gold: shadcn/ui (new-york, neutral), lucide-react, motion +
  LazyMotion, GSAP + ScrollTrigger + Lenis, class-variance-authority,
  tailwind-merge, next-intl, sonner. The `reactbits` components
  (`AnimatedContent`, `GlareHover`) are vendored from Gold to stay in sync.
- **i18n** is Gold's shape with a different locale set: `en` / `ms` / `zh`,
  `localePrefix: "always"`, translations in side tables keyed by locale rather
  than JSONB.

## Why the palette is not copied

Gold's own principle §3.1 is "restraint over decoration — metallic tone on ≤10%
of visible surface". That rule is about proportion, not hue. Applying it to a
terracotta accent produces the same discipline with a different brand. Copying
the hue would satisfy the letter and break the intent.

## Consequences

- The contrast auditor was rewritten to parse OKLCH directly out of
  `app/globals.css` (it converts OKLCH → OKLab → linear sRGB). Six tokens had to
  be darkened to clear AA against the new grounds — the solved values are in the
  stylesheet.
- Radius dropped from `1rem` cards to a `0.25rem` base. Every rounded surface
  was re-tuned; a card at 16px radius next to a 4px input reads as two systems.
- The old bespoke icon set was deleted in favour of Lucide. WhatsApp is the one
  exception — it is a brand mark with no Lucide equivalent, so it lives as a
  single glyph in `components/brand/primitives.tsx` rather than pulling in a
  second icon library.
- Money formatting moved from a local `formatSen()` helper to next-intl's
  formatter with a `currencyWhole` / `currency` format set, so "RM 149.00"
  renders correctly in all three locales without string concatenation.
- ADR 0004 (single light theme) still holds, and the semantic layer now makes a
  future dark theme a token change rather than a component sweep — which is the
  reason Gold authored it that way.

## What was deliberately not copied

- `cacheComponents` stays off until the Supabase data layer lands (see
  [ADR 0001](0001-nextjs-16-baseline.md)); Gold has it commented out for the
  same reason.
- TanStack Query is not installed. Gold scopes it to the cart, wishlist and
  admin panel — none of which exist here yet. It goes in with the cart.
- Gold's `admin-mono` token override and the Google Places restyle are
  Gold-specific and were left behind.
