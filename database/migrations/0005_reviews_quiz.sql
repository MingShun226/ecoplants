-- 0005_reviews_quiz.sql
-- Photo reviews and quiz responses (zero-party data).

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  -- A review is only trustworthy if it is attached to a real purchase.
  order_id     uuid references orders(id) on delete set null,
  rating       smallint not null check (rating between 1 and 5),
  body         text not null default '',
  image_paths  text[] not null default '{}',
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One review per customer per product.
  unique (product_id, customer_id)
);

create index reviews_product_idx on reviews (product_id) where is_approved;
create index reviews_customer_idx on reviews (customer_id);

create trigger reviews_set_updated_at
  before update on reviews
  for each row execute function set_updated_at();

-- --------------------------------------------------------------- quiz ----
-- Answers are zero-party data: volunteered, and the basis for the WhatsApp and
-- email follow-up. Guests can submit, so customer_id is nullable.

create table quiz_responses (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references customers(id) on delete set null,
  -- Opaque client-generated id, so a guest's answers can be stitched to their
  -- account if they sign up later. Never used as an access-control key.
  session_id      text,
  answers         jsonb not null,
  recommended_ids uuid[] not null default '{}',
  locale          locale_code not null default 'en',
  created_at      timestamptz not null default now()
);

create index quiz_responses_customer_idx on quiz_responses (customer_id);

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table reviews        enable row level security;
alter table quiz_responses enable row level security;

-- Approved reviews are public; an author can always see their own, including
-- one still in the moderation queue.
--
-- NOTE: 0008 merges these two SELECT policies into one per role. Two permissive
-- policies both run on every row, which the performance linter (correctly)
-- flags. They are left here as written so the migration history is honest.
create policy "approved reviews are public"
  on reviews for select to anon, authenticated using (is_approved);

create policy "authors read own reviews"
  on reviews for select to authenticated using ((select auth.uid()) = customer_id);

create policy "authors write own reviews"
  on reviews for insert to authenticated with check ((select auth.uid()) = customer_id);

-- Editing is allowed, but only back into the moderation queue: without the
-- is_approved check an author could publish, then rewrite the text.
create policy "authors edit own unpublished reviews"
  on reviews for update to authenticated
  using ((select auth.uid()) = customer_id)
  with check ((select auth.uid()) = customer_id and is_approved = false);

-- Anyone may submit a quiz response; nobody may read the pool. A signed-in
-- customer can read their own back.
create policy "anyone submits a quiz response"
  on quiz_responses for insert to anon, authenticated with check (true);

create policy "customers read own quiz responses"
  on quiz_responses for select to authenticated using ((select auth.uid()) = customer_id);
