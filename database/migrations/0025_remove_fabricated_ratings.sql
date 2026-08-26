-- 0025_remove_fabricated_ratings.sql
--
-- Two removals, both because the data was saying something untrue.
--
-- 1. FABRICATED RATINGS. The catalogue seed invented a rating and a review
--    count for every product — 1,773 reviews across 14 products, none of which
--    exist. `reviews` has always been empty. Those numbers were rendering on
--    live product pages as social proof.
--
--    Invented reviews are deceptive advertising, not placeholder copy. The
--    columns stay, because real reviews will populate them, but they start
--    empty and a product with no reviews now says so.
--
-- 2. PENINSULAR-ONLY. The shop delivers to West Malaysia only, so a per-product
--    "cannot survive the trip to Sabah" flag describes a trip that is never
--    taken. Nothing can be ordered to East Malaysia at all, which is a simpler
--    and stricter rule than the one it replaces — enforced in place_order()
--    rather than per product.

-- ------------------------------------------------------------- ratings ----
-- `rating` was NOT NULL, so a product with no reviews had to carry a number.
-- That is what made seeding a plausible-looking one feel necessary. Zero is not
-- the honest default either: it renders as the worst possible score rather than
-- as "nobody has said anything yet".

alter table products alter column rating drop not null;
alter table products alter column rating drop default;

update products set rating = null, review_count = 0;

alter table products alter column review_count set default 0;

comment on column products.rating is
  'Average of approved reviews. NULL until there is at least one. Never seeded '
  'with a plausible-looking number: an invented rating is a lie told to a '
  'customer at the moment they are deciding.';

comment on column products.review_count is
  'Count of approved reviews. Maintained from the reviews table, never by hand.';

-- ---------------------------------------------------- delivery coverage ----
-- East Malaysia is refused outright now, so the per-product flag has nothing
-- left to decide.

update products set peninsular_only = false;

comment on column products.peninsular_only is
  'DEPRECATED. The shop serves West Malaysia only, so every product is '
  'implicitly peninsular. place_order() refuses an East Malaysian address for '
  'any order. Kept as a column only to avoid rewriting historical orders.';
