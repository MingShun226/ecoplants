# ADR 0002 — Money is integer sen, not `numeric(10,2)`

**Status:** accepted · **Date:** 2026-08-26

## Context

The blueprint recommends `numeric(10,2)` for MYR values. PostgREST serialises
Postgres `numeric` to a JSON number, which becomes a JavaScript double on the
way into the app.

## Decision

Store and pass every monetary value as **integer sen** (RM 1 = 100 sen).
Column names carry the unit: `price_sen`, `subtotal_sen`, `shipping_fee_sen`.
Values become decimals only inside `formatSen()` at render time.

## Why

- Floating-point drift on cart totals and tax lines is real and compounds.
- Payment gateways (Stripe, Fiuu, Xendit, Billplz) all take integer minor units.
  Storing sen means no conversion at the point where a mismatch costs money.
- Integer comparison in SQL is exact, so price filters and free-shipping
  thresholds cannot land on a rounding boundary.

## Consequences

- `types/catalog.ts` types all prices as `priceSen: number`.
- The schema uses `integer` (or `bigint` for order totals), never `numeric`.
- Anything rendering a price must go through `lib/utils/format.ts`. A raw
  `priceSen` reaching JSX is a bug.
