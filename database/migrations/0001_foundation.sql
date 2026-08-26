-- 0001_foundation.sql
-- Extensions, enums and shared helpers.
--
-- Conventions used by every migration that follows:
--   * Money is INTEGER SEN. 1 MYR = 100 sen. Never numeric, never a float.
--     See docs/decisions/0002-money-as-integer-sen.md.
--   * RLS is enabled in the same migration that creates the table. A table in
--     `public` without RLS is fully readable with the anon key.
--   * Write policies are deny-all for anon/authenticated. Admin mutations go
--     through server-side handlers using the service_role client, which bypasses
--     RLS — so there is no role-claim plumbing to get wrong.
--   * Translations live in side tables keyed by locale, not JSONB. A JSONB blob
--     cannot be indexed for per-locale slug lookup or full-text search.

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fuzzy / typo-tolerant search
create extension if not exists "unaccent";      -- fold diacritics in search

-- ---------------------------------------------------------------- enums ----
-- Mirrors the TypeScript unions in types/catalog.ts. Keeping them as real enums
-- means a typo in a seed or an admin write fails at the database rather than
-- silently producing a plant that no facet can find.

create type locale_code as enum ('en', 'ms', 'zh');

create type light_level as enum ('low', 'medium', 'bright-indirect', 'direct-sun');
create type water_frequency as enum ('weekly', 'fortnightly', 'when-dry', 'keep-moist');
create type care_difficulty as enum ('beginner', 'easy', 'moderate', 'expert');
create type plant_placement as enum ('indoor', 'outdoor', 'both');
create type category_kind as enum ('plants', 'pots', 'care', 'gifts');
create type image_kind as enum ('catalog', 'lifestyle', 'detail', 'scale');

create type order_status as enum (
  'pending',      -- created, awaiting payment
  'paid',
  'packing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

create type payment_status as enum ('unpaid', 'authorised', 'paid', 'failed', 'refunded');

-- ------------------------------------------------------------- helpers ----

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function set_updated_at is
  'Trigger helper: stamps updated_at on every UPDATE.';
