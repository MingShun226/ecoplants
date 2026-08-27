-- 0027_product_images.sql
--
-- Product photography: a storage bucket, the policies that guard it, and admin
-- write access to the `product_images` rows that point into it.
--
-- The bucket is **public read**. Product photos are the least secret thing the
-- shop owns — they are the reason someone visits — and serving them publicly
-- means Next/Image can cache and transform them at the edge without minting a
-- signed URL per request. Writes are admin-only, which is the half that matters.
--
-- Storage holds bytes; `product_images` holds meaning. A row records which
-- product (and optionally which variant) an image belongs to, what kind of shot
-- it is, and its position. Deleting the row does not delete the object, so the
-- admin action does both — see lib/admin/images.ts.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB. A plant photo that needs more than this needs resizing.
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------ object rules --
-- Storage policies live on storage.objects and are matched by bucket_id.

drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- is_admin() is never used in a policy anon is subject to (see 0014), so these
-- three are scoped to authenticated only. anon has no write path at all.
drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and is_admin());

drop policy if exists "admins replace product images" on storage.objects;
create policy "admins replace product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());

drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and is_admin());

-- -------------------------------------------------------------- image rows --
-- `product_images` and its translations were read-only. The admin needs to
-- create, reorder and remove them.

create policy "admins insert product images" on product_images
  for insert to authenticated with check (is_admin());
create policy "admins update product images" on product_images
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete product images" on product_images
  for delete to authenticated using (is_admin());

create policy "admins write image alt text" on product_image_translations
  for insert to authenticated with check (is_admin());
create policy "admins update image alt text" on product_image_translations
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete image alt text" on product_image_translations
  for delete to authenticated using (is_admin());

-- One primary image per product, enforced here rather than trusted to the
-- application: "which photo is the card image" must have exactly one answer.
create unique index if not exists product_images_one_primary_per_product
  on product_images (product_id) where is_primary;
