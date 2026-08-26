-- 0003_customers.sql
-- Customers, addresses, saved carts and wishlists.
--
-- Every table here is user-scoped: the policy is `auth.uid() = customer_id`,
-- and the policy column is indexed because RLS runs that predicate on every
-- row the planner touches.
--
-- Guest carts are NOT here. They live in the `ep_cart` cookie — a `session_id`
-- column cannot be secured by RLS, because there is no `auth.uid()` to scope it
-- against and anyone with the anon key could enumerate it. See
-- docs/decisions/0003-guest-cart-in-cookie.md.

create table customers (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  -- Stored E.164 (+60...) so it is unambiguous and dedupable.
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

create table addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label       text,
  line1       text not null,
  line2       text,
  city        text not null,
  postcode    text not null check (postcode ~ '^[0-9]{5}$'),
  state       text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index addresses_customer_idx on addresses (customer_id);

-- At most one default per customer, enforced rather than hoped for.
create unique index addresses_one_default_idx
  on addresses (customer_id) where is_default;

-- ---------------------------------------------------------- saved cart ----
-- Signed-in customers only. On login the cookie cart merges into this row.

create table carts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references customers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger carts_set_updated_at
  before update on carts
  for each row execute function set_updated_at();

create table cart_items (
  cart_id    uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity   integer not null check (quantity > 0 and quantity <= 99),
  added_at   timestamptz not null default now(),
  primary key (cart_id, variant_id)
);

-- Deliberately no price column. A cart line stores what you want, not what it
-- costs; the price is read from the catalogue at checkout so a stale basket
-- cannot lock in an old price.

create table wishlists (
  customer_id uuid not null references customers(id) on delete cascade,
  variant_id  uuid not null references product_variants(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (customer_id, variant_id)
);

-- =========================================================================
-- ROW LEVEL SECURITY — user-scoped
-- =========================================================================

alter table customers  enable row level security;
alter table addresses  enable row level security;
alter table carts      enable row level security;
alter table cart_items enable row level security;
alter table wishlists  enable row level security;

-- auth.uid() is wrapped in a scalar subquery throughout. Postgres then
-- evaluates it once per statement instead of once per row, which is the
-- difference between a constant and a function call on every row RLS touches.
create policy "customers read own row"
  on customers for select to authenticated using ((select auth.uid()) = id);
create policy "customers insert own row"
  on customers for insert to authenticated with check ((select auth.uid()) = id);
create policy "customers update own row"
  on customers for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "addresses are owner-scoped"
  on addresses for all to authenticated
  using ((select auth.uid()) = customer_id) with check ((select auth.uid()) = customer_id);

create policy "carts are owner-scoped"
  on carts for all to authenticated
  using ((select auth.uid()) = customer_id) with check ((select auth.uid()) = customer_id);

-- cart_items has no customer_id of its own, so the check walks up to the cart.
-- The subquery is indexed by carts' primary key, so it stays cheap.
create policy "cart items are owner-scoped"
  on cart_items for all to authenticated
  using (
    exists (
      select 1 from carts
      where carts.id = cart_items.cart_id and carts.customer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from carts
      where carts.id = cart_items.cart_id and carts.customer_id = (select auth.uid())
    )
  );

create policy "wishlists are owner-scoped"
  on wishlists for all to authenticated
  using ((select auth.uid()) = customer_id) with check ((select auth.uid()) = customer_id);
