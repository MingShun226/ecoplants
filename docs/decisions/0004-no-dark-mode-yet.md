# ADR 0004 — Single light theme for now

**Status:** accepted · **Date:** 2026-08-26

## Context

The scaffold shipped with a `prefers-color-scheme: dark` block. The brand
palette is a warm cream system where the neutral ground *is* the brand.

## Decision

Ship a single light theme. The dark block was removed rather than left
half-wired.

## Why

Inverting a warm earth palette does not produce a credible dark theme — it
produces mud. A real dark variant needs its own surface ramp, its own terracotta
(the `600` button fill fails against dark ground), and its own photography
treatment. That is a design exercise, not a token flip.

Leaving a partial dark block in place is worse than having none: it renders
unpredictably for anyone whose OS is set to dark and silently breaks the
contrast guarantees in `scripts/check-contrast.mjs`, which only measures the
light pairs.

## Consequences

- `body` sets an explicit cream background; nothing inherits a host theme.
- If dark mode is wanted, decide before the component library grows. Retrofitting
  costs a second full pass of the contrast audit.
