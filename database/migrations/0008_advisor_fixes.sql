-- 0008_advisor_fixes.sql
--
-- Two findings from the Supabase performance linter that are worth acting on.
-- (The "unused index" findings are not: this database had served no queries
-- when it was run, so every index was unused by definition. The facet indexes
-- exist for a catalogue of hundreds, not the fourteen seeded today.)

-- 1. Unindexed foreign keys.
--    Postgres indexes the referencing side of a FK only if you ask. Without
--    these, deleting a variant or an order has to sequentially scan every child
--    table to enforce the constraint, and the joins the account pages will run
--    have nothing to work with.
create index cart_items_variant_idx     on cart_items (variant_id);
create index order_items_variant_idx    on order_items (variant_id);
create index product_images_variant_idx on product_images (variant_id);
create index reviews_order_idx          on reviews (order_id);
create index wishlists_variant_idx      on wishlists (variant_id);

-- 2. Two permissive SELECT policies on `reviews` for the same role.
--    Postgres ORs permissive policies together but evaluates every one of them
--    on every row. Collapsing them into a single expression per role halves the
--    work on the busiest read on a PDP.
--
--    Behaviour is unchanged: anonymous visitors see approved reviews; a
--    signed-in author additionally sees their own while it is in moderation.
drop policy "approved reviews are public" on reviews;
drop policy "authors read own reviews" on reviews;

create policy "anon reads approved reviews"
  on reviews for select to anon
  using (is_approved);

create policy "authenticated reads approved reviews and own"
  on reviews for select to authenticated
  using (is_approved or (select auth.uid()) = customer_id);
