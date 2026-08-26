-- 0002_catalogue.sql
-- Categories, products, translations, attributes, variants, inventory, images.
--
-- The catalogue is world-readable and admin-writable. Read policies are granted
-- to anon + authenticated; no write policy is created at all, so writes are
-- denied to both roles and only the service_role client (which bypasses RLS)
-- can mutate.

-- ---------------------------------------------------------- categories ----

create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  kind        category_kind not null default 'plants',
  position    integer not null default 0,
  -- `pet-safe` and `beginner` are attribute-derived collections rather than
  -- stored memberships. The flag keeps the PLP honest about which is which.
  is_derived  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table category_translations (
  category_id uuid not null references categories(id) on delete cascade,
  locale      locale_code not null,
  name        text not null,
  description text not null default '',
  primary key (category_id, locale)
);

-- ------------------------------------------------------------ products ----

create table products (
  id              uuid primary key default gen_random_uuid(),
  -- Stable, locale-independent handle. Slugs are per locale and ids are
  -- generated, so without this a re-run of the seed has nothing to match on and
  -- inserts duplicates. It is also what an admin CSV import reconciles against.
  ref             text not null unique,
  -- Botanical name does not change with locale.
  name_botanical  text not null,
  category_id     uuid not null references categories(id) on delete restrict,
  -- Message keys resolved by the app, never display strings.
  badges          text[] not null default '{}',
  rating          numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count    integer not null default 0 check (review_count >= 0),
  -- Live plants that cannot survive 7–8 day transit to Sabah/Sarawak.
  peninsular_only boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index products_category_idx on products (category_id) where is_active;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

create table product_translations (
  product_id    uuid not null references products(id) on delete cascade,
  locale        locale_code not null,
  name          text not null,
  slug          text not null,
  tagline       text not null default '',
  description   text not null default '',
  care_summary  text not null default '',
  climate_note  text,
  toxicity_note text,
  -- Maintained by trigger in 0006_search.sql.
  search_doc    tsvector,
  primary key (product_id, locale)
);

-- Slugs are localised, so uniqueness is per locale, not global. This index is
-- also what makes `/[locale]/plants/[slug]` a single indexed lookup.
create unique index product_translations_locale_slug_idx
  on product_translations (locale, slug);

-- --------------------------------------------------- plant attributes ----
-- One row per product; the facet source for the PLP and the quiz.

create table plant_attributes (
  product_id        uuid primary key references products(id) on delete cascade,
  light             light_level not null,
  water             water_frequency not null,
  -- NULL means "not verified against the ASPCA database". The UI must render
  -- that as unverified, never as safe. Nullable on purpose.
  pet_safe          boolean,
  difficulty        care_difficulty not null,
  mature_height_cm  integer not null check (mature_height_cm > 0),
  placement         plant_placement not null,
  air_purifying     boolean not null default false
);

comment on column plant_attributes.pet_safe is
  'ASPCA-verified. NULL = unverified; never render as safe.';

-- Facet columns are the PLP's whole query surface.
create index plant_attributes_light_idx on plant_attributes (light);
create index plant_attributes_difficulty_idx on plant_attributes (difficulty);
create index plant_attributes_placement_idx on plant_attributes (placement);
create index plant_attributes_pet_safe_idx on plant_attributes (pet_safe) where pet_safe;

-- ------------------------------------------------------------ variants ----

create table product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id) on delete cascade,
  sku               text not null unique,
  -- Message keys; the display strings live in messages/*.json.
  size_key          text not null,
  pot_color_key     text not null,
  pot_material_key  text not null,
  price_sen         integer not null check (price_sen >= 0),
  compare_at_sen    integer check (compare_at_sen is null or compare_at_sen > price_sen),
  weight_grams      integer not null check (weight_grams > 0),
  height_cm         integer not null check (height_cm > 0),
  pot_diameter_cm   integer not null check (pot_diameter_cm > 0),
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index product_variants_product_idx on product_variants (product_id);

create trigger product_variants_set_updated_at
  before update on product_variants
  for each row execute function set_updated_at();

comment on column product_variants.price_sen is
  'Integer sen. 1 MYR = 100 sen. Never numeric — see ADR 0002.';

-- ----------------------------------------------------------- inventory ----
-- Split from variants so a reservation does not churn the variant row (and so
-- a price edit does not contend with a checkout holding a stock lock).

create table inventory (
  variant_id        uuid primary key references product_variants(id) on delete cascade,
  quantity_on_hand  integer not null default 0 check (quantity_on_hand >= 0),
  reserved          integer not null default 0 check (reserved >= 0),
  updated_at        timestamptz not null default now(),
  -- Cannot reserve more than exists.
  constraint inventory_reserved_within_stock check (reserved <= quantity_on_hand)
);

create trigger inventory_set_updated_at
  before update on inventory
  for each row execute function set_updated_at();

-- What the storefront should actually show as buyable.
--
-- security_invoker is not optional. A plain view runs as its owner and so
-- bypasses RLS on the tables beneath it — harmless here, because inventory is
-- public-read anyway, but it is exactly the habit that leaks a user-scoped
-- table the next time someone copies this pattern.
create view available_stock
  with (security_invoker = true)
  as
  select
    variant_id,
    quantity_on_hand - reserved as available
  from inventory;

-- -------------------------------------------------------------- images ----

create table product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  variant_id    uuid references product_variants(id) on delete set null,
  storage_path  text not null,
  kind          image_kind not null default 'catalog',
  position      integer not null default 0,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index product_images_product_idx on product_images (product_id, position);

-- Alt text is per locale — it is copy, and it carries the same SEO weight as
-- the product name.
create table product_image_translations (
  image_id uuid not null references product_images(id) on delete cascade,
  locale   locale_code not null,
  alt      text not null,
  primary key (image_id, locale)
);

-- =========================================================================
-- ROW LEVEL SECURITY
-- Public read, no write policy (writes denied to anon/authenticated; the
-- service_role client bypasses RLS for admin operations).
-- =========================================================================

alter table categories                 enable row level security;
alter table category_translations      enable row level security;
alter table products                   enable row level security;
alter table product_translations       enable row level security;
alter table plant_attributes           enable row level security;
alter table product_variants           enable row level security;
alter table inventory                  enable row level security;
alter table product_images             enable row level security;
alter table product_image_translations enable row level security;

create policy "categories are public"
  on categories for select to anon, authenticated using (true);

create policy "category translations are public"
  on category_translations for select to anon, authenticated using (true);

-- Inactive products are invisible to the storefront entirely. Admin reads go
-- through the service_role client.
create policy "active products are public"
  on products for select to anon, authenticated using (is_active);

create policy "product translations are public"
  on product_translations for select to anon, authenticated using (true);

create policy "plant attributes are public"
  on plant_attributes for select to anon, authenticated using (true);

create policy "variants are public"
  on product_variants for select to anon, authenticated using (true);

-- Stock level is a trust signal ("only 3 left"), so it is readable. It exposes
-- nothing an attacker could not learn by adding items to a basket.
create policy "inventory is public"
  on inventory for select to anon, authenticated using (true);

create policy "product images are public"
  on product_images for select to anon, authenticated using (true);

create policy "image alt text is public"
  on product_image_translations for select to anon, authenticated using (true);
