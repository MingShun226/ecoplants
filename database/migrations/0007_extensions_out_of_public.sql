-- 0007_extensions_out_of_public.sql
--
-- The Supabase security linter flags pg_trgm and unaccent living in `public`.
-- An extension there puts its functions and operators in the same namespace the
-- app writes to, so a table or function added later can shadow one — and every
-- object it creates inherits public's grants.
--
-- Supabase provisions an `extensions` schema for exactly this. Moving them is
-- transparent to callers as long as the search_path includes it, which is why
-- product_translation_search_doc pins `public, extensions`.

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

alter extension pg_trgm set schema extensions;
alter extension unaccent set schema extensions;

-- The trigram indexes reference the gin_trgm_ops operator class, which has just
-- moved. Rebuild them against the new location.
drop index if exists product_translations_name_trgm_idx;
drop index if exists products_botanical_trgm_idx;

create index product_translations_name_trgm_idx
  on product_translations using gin (name extensions.gin_trgm_ops);

create index products_botanical_trgm_idx
  on products using gin (name_botanical extensions.gin_trgm_ops);
