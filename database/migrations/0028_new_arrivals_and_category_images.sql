-- 0028_new_arrivals_and_category_images.sql
--
-- New arrivals, as a date rather than a flag.
--
-- A boolean "is new" has to be un-ticked by hand, and nobody ever does — which
-- is how a New Arrivals page ends up two years stale. A date expires on its
-- own: the product is new until a moment, and then it simply is not.

alter table products add column if not exists new_until timestamptz;

create index if not exists products_new_until_idx on products (new_until)
  where new_until is not null;

comment on column products.new_until is
  'Shown under New arrivals, and badged, while this is in the future. NULL for '
  'everything else. A date rather than a flag so it expires without anyone '
  'remembering to clear it.';

-- The derived category. Membership is computed from new_until, exactly as
-- pet-safe is computed from plant_attributes, so nothing is assigned by hand.
insert into categories (slug, kind, position, is_derived)
select 'new', 'plants', coalesce(min(position), 0) - 1, true from categories
on conflict (slug) do nothing;

insert into category_translations (category_id, locale, name, description)
select c.id, v.locale::locale_code, v.name, v.description
from categories c
cross join (values
  ('en', 'New arrivals', 'The plants that landed most recently, while they are still settling in.'),
  ('ms', 'Ketibaan baharu', 'Pokok yang baru sampai, semasa ia masih menyesuaikan diri.'),
  ('zh', '新到货', '最近到店的植物，趁它们还在适应期。')
) as v(locale, name, description)
where c.slug = 'new'
on conflict (category_id, locale) do nothing;

-- Category photography, on the same bucket as products.
alter table categories add column if not exists image_path text;

comment on column categories.image_path is
  'Storage path in the product-images bucket, under categories/. NULL falls '
  'back to generated artwork, same as a product with no photo.';
