# ADR 0001 — Next.js 16 baseline, caching deferred

**Status:** accepted · **Date:** 2026-08-26

## Context

The blueprint specifies Next.js 16 with Cache Components (`"use cache"`),
Turbopack, `proxy.ts` and async params. Installed and verified: Next 16.3.3,
React 19.2.8, Tailwind 4.3.3, Node 24.16 (blueprint requires ≥20.9).

## Decision

Build on Next.js 16.3.3 with Turbopack (now the default) and async
`params`/`searchParams`, but **do not enable `cacheComponents` or the React
Compiler yet**.

## Why

Caching is opt-in in Next 16, so nothing is silently wrong without it. Turning
on Cache Components before the catalogue pages exist means debugging cache
boundaries instead of building screens, and the correct `"use cache"` placement
depends on which parts of a page turn out to be per-user — which we only know
once the cart and account areas are real.

React Compiler is Babel-based and raises build times for auto-memoisation we do
not currently need at this component count.

## Consequences

- Every page renders dynamically in dev; static pages still prerender at build
  (14 PDPs + home + quiz + guarantee are already static).
- Adopt `"use cache"` at Milestone 2.5, once PLP/PDP data comes from Postgres:
  home and PLP cached with a `cacheLife` profile, PDP as a cached shell with
  Suspense holes for live stock, cart/checkout/account uncached.
- Session refresh goes in `proxy.ts`, not `middleware.ts`, when auth lands.
