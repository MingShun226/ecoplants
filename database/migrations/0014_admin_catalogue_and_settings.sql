-- 0014_admin_catalogue_and_settings.sql
--
-- Everything the remaining admin modules need: write access to the catalogue,
-- an auditable stock ledger, and shop settings that live in the database
-- instead of a TypeScript constant.
--
-- One rule shapes every policy below: **`is_admin()` must never appear in a
-- policy that `anon` is subject to.** Migration 0012 revoked EXECUTE from anon,
-- so a policy calling it would raise "permission denied for function is_admin"
-- for every shopper, and the storefront would go down. Where a table needs both
-- a public rule and an admin rule, the policies are split by role rather than
-- merged with OR. `reviews` already used that shape; it is now the pattern.

-- ---------------------------------------------------------- catalogue read --
-- Admins need to see products that shoppers must not: drafts and anything
-- deactivated. Split by role so anon keeps the plain `is_active` test.

drop policy "active products are public" on products;

create policy "anon reads active products"
  on products for select to anon
  using (is_active);

create policy "authenticated reads active products, admins read all"
  on products for select to authenticated
  using (is_active or is_admin());

-- --------------------------------------------------------- catalogue write --
-- Read stays public on these; only the write side is new. `for all` would
-- collide with the existing public SELECT policy and cost every shopper an
-- is_admin() call, so each is spelled out per command.

do $do$
declare
  t text;
begin
  foreach t in array array[
    'products', 'product_translations', 'product_variants',
    'plant_attributes', 'categories', 'category_translations'
  ]
  loop
    execute format(
      'create policy "admins insert %1$s" on %1$I for insert to authenticated
         with check (is_admin())', t);
    execute format(
      'create policy "admins update %1$s" on %1$I for update to authenticated
         using (is_admin()) with check (is_admin())', t);
    execute format(
      'create policy "admins delete %1$s" on %1$I for delete to authenticated
         using (is_admin())', t);
  end loop;
end
$do$;

-- Inventory is deliberately absent from that list. Stock moves only through
-- adjust_stock() below, so that every change leaves a row explaining itself.

-- --------------------------------------------------------------- customers --
-- Merged into the existing policy rather than added alongside it: two
-- permissive SELECT policies for the same role means Postgres evaluates both
-- on every read (see 0013).

drop policy "customers read own row" on customers;
create policy "read own customer row, or any as admin"
  on customers for select to authenticated
  using (is_admin() or (select auth.uid()) = id);

drop policy "customers read own quiz responses" on quiz_responses;
create policy "read own quiz responses, or any as admin"
  on quiz_responses for select to authenticated
  using (is_admin() or (select auth.uid()) = customer_id);

-- ----------------------------------------------------------------- reviews --
-- Moderation. `is_approved` was always the gate; this is the hand that moves
-- it. Admins can also delete, because spam should leave no trace.

drop policy "authenticated reads approved reviews and own" on reviews;
create policy "read approved reviews and own, or any as admin"
  on reviews for select to authenticated
  using (is_approved or (select auth.uid()) = customer_id or is_admin());

create policy "admins moderate reviews"
  on reviews for update to authenticated
  using (is_admin()) with check (is_admin());

create policy "admins delete reviews"
  on reviews for delete to authenticated
  using (is_admin());

-- ------------------------------------------------------------ stock ledger --
-- Why stock changed, not just what it is now. "We are eleven short" is
-- unanswerable without this, and a plant nursery loses stock to death and
-- damage constantly. The ledger is the difference between shrinkage you can
-- explain and shrinkage you cannot.

create table stock_movements (
  id             uuid primary key default gen_random_uuid(),
  variant_id     uuid not null references product_variants(id) on delete cascade,
  delta          integer not null check (delta <> 0),
  quantity_after integer not null,
  reason         text not null,
  note           text,
  actor_id       uuid references admin_users(id) on delete set null,
  actor_name     text not null default 'system',
  created_at     timestamptz not null default now()
);

create index stock_movements_variant_idx on stock_movements (variant_id, created_at desc);
create index stock_movements_actor_idx on stock_movements (actor_id);

alter table stock_movements enable row level security;

create policy "admins read stock movements"
  on stock_movements for select to authenticated
  using (is_admin());

-- No insert policy: rows come from adjust_stock() only, which runs as the
-- table owner. As with order_events, there is no update or delete policy —
-- for an admin the ledger is append-only.

create or replace function adjust_stock(
  p_variant_id uuid,
  p_delta      integer,
  p_reason     text,
  p_note       text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_on_hand    integer;
  v_reserved   integer;
  v_after      integer;
  v_actor_id   uuid;
  v_actor_name text := 'system';
begin
  if p_delta = 0 then
    raise exception 'adjust_stock: a zero adjustment is not a movement';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'adjust_stock: every movement needs a reason';
  end if;

  if (select auth.uid()) is not null then
    if not is_admin() then
      raise exception 'adjust_stock: not authorised';
    end if;
    select id, full_name into v_actor_id, v_actor_name
      from admin_users where auth_user_id = (select auth.uid());
  end if;

  -- Lock before reading, for the same reason reserve_stock() does: two people
  -- counting the same shelf must not both write their own idea of the total.
  select quantity_on_hand, reserved into v_on_hand, v_reserved
    from inventory where variant_id = p_variant_id for update;

  if v_on_hand is null then
    raise exception 'adjust_stock: no inventory row for variant %', p_variant_id;
  end if;

  v_after := v_on_hand + p_delta;

  if v_after < 0 then
    raise exception 'adjust_stock: % would take stock to %, below zero', p_delta, v_after;
  end if;

  -- Reserved stock is already promised to a checkout in flight. Writing off
  -- below it would oversell someone who has their card out.
  if v_after < v_reserved then
    raise exception 'adjust_stock: % would leave % on hand but % is reserved',
      p_delta, v_after, v_reserved;
  end if;

  update inventory
     set quantity_on_hand = v_after
   where variant_id = p_variant_id;

  insert into stock_movements (variant_id, delta, quantity_after, reason, note, actor_id, actor_name)
  values (p_variant_id, p_delta, v_after, btrim(p_reason),
          nullif(btrim(coalesce(p_note, '')), ''),
          v_actor_id, coalesce(v_actor_name, 'system'));

  return v_after;
end;
$fn$;

comment on function adjust_stock is
  'Moves stock by a delta and records why, in one locked transaction. Refuses '
  'to go below zero or below what is already reserved. Actor comes from the '
  'session, never a parameter.';

revoke execute on function adjust_stock(uuid, integer, text, text) from public, anon;
grant execute on function adjust_stock(uuid, integer, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------- settings --
-- These were constants in lib/data/site.ts. A shipping threshold is a
-- commercial decision the shop owner should be able to change on a Tuesday
-- without a deploy.

create table shop_settings (
  -- Single row, enforced by the type: the only value that satisfies the check
  -- is true, and it is the primary key.
  id                          boolean primary key default true check (id),
  free_shipping_threshold_sen integer not null default 15000 check (free_shipping_threshold_sen >= 0),
  standard_shipping_sen       integer not null default 1200  check (standard_shipping_sen >= 0),
  guarantee_days              integer not null default 14    check (guarantee_days >= 0),
  whatsapp_number             text    not null default '60123456789',
  low_stock_threshold         integer not null default 5     check (low_stock_threshold >= 0),
  updated_at                  timestamptz not null default now()
);

create trigger shop_settings_set_updated_at
  before update on shop_settings
  for each row execute function set_updated_at();

insert into shop_settings (id) values (true);

alter table shop_settings enable row level security;

-- The storefront reads these on every page, so anon must be able to, and this
-- policy must therefore not call is_admin().
create policy "settings are public" on shop_settings
  for select to anon, authenticated using (true);

create policy "admins update settings" on shop_settings
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- No insert or delete policy: there is one row and it is not going anywhere.
