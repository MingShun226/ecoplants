-- 0006_search.sql
-- Full-text search over product translations.
--
-- Postgres FTS is the launch choice: free, in-database, and good enough for a
-- catalogue this size. pg_trgm covers typos, which plain FTS does not.
-- Meilisearch/Typesense is the migration path if instant search-as-you-type
-- becomes a growth lever — Postgres stays the source of truth either way.

-- Malay and English both index well with the 'simple' + unaccent pipeline.
-- 'english' stemming would mangle Malay, and there is no Malay dictionary
-- shipped with Postgres; 'simple' plus trigram fuzziness is the honest choice
-- for a trilingual catalogue.
create or replace function product_translation_search_doc(
  p_name text,
  p_tagline text,
  p_description text,
  p_care_summary text,
  p_botanical text
)
returns tsvector
language sql
-- STABLE, not IMMUTABLE: unaccent() resolves its dictionary through the
-- search_path. Declaring it immutable would let Postgres accept it in an index
-- expression, where a dictionary change would silently corrupt the index. It is
-- only ever called from the trigger below, which stores the result in a column.
stable
set search_path = public, extensions
as $$
  select
    setweight(to_tsvector('simple', unaccent(coalesce(p_name, ''))),        'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(p_botanical, ''))),   'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(p_tagline, ''))),     'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(p_care_summary, ''))),'C') ||
    setweight(to_tsvector('simple', unaccent(coalesce(p_description, ''))), 'D');
$$;

create or replace function product_translations_refresh_search_doc()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_botanical text;
begin
  select name_botanical into v_botanical from products where id = new.product_id;

  new.search_doc := product_translation_search_doc(
    new.name, new.tagline, new.description, new.care_summary, v_botanical
  );
  return new;
end;
$$;

create trigger product_translations_search_doc
  before insert or update of name, tagline, description, care_summary
  on product_translations
  for each row execute function product_translations_refresh_search_doc();

create index product_translations_search_idx
  on product_translations using gin (search_doc);

-- Typo tolerance. `lidah gin` should still find `Pokok Lidah Jin`.
create index product_translations_name_trgm_idx
  on product_translations using gin (name gin_trgm_ops);

create index products_botanical_trgm_idx
  on products using gin (name_botanical gin_trgm_ops);

-- Renaming a plant changes its botanical name, which is weighted 'A' in every
-- locale's document — so all of them have to be rebuilt.
create or replace function products_refresh_translation_search_docs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name_botanical is distinct from old.name_botanical then
    update product_translations
       set search_doc = product_translation_search_doc(
             name, tagline, description, care_summary, new.name_botanical
           )
     where product_id = new.id;
  end if;
  return new;
end;
$$;

create trigger products_search_doc_cascade
  after update of name_botanical on products
  for each row execute function products_refresh_translation_search_docs();
