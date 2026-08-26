-- 0004_orders.sql
-- Orders, order lines, and the stock-reservation function.
--
-- Two properties this migration exists to guarantee:
--
--  1. **Webhook replays cannot double-fulfil.** Gateways retry; a webhook will
--     arrive more than once. `payment_ref` is unique, so the second delivery
--     conflicts instead of decrementing stock twice.
--  2. **Concurrent checkouts cannot oversell.** `reserve_stock` takes a row
--     lock before it reads, so two buyers racing for the last plant serialise
--     rather than both succeeding.

create table orders (
  id                uuid primary key default gen_random_uuid(),
  -- Human-facing reference: what a customer quotes on WhatsApp.
  order_no          text not null unique,

  -- Guest checkout is supported, so customer_id is nullable and the contact
  -- details are stored on the order itself.
  customer_id       uuid references customers(id) on delete set null,
  email             text not null,
  phone             text not null,
  full_name         text not null,

  status            order_status not null default 'pending',
  payment_status    payment_status not null default 'unpaid',
  payment_method    text,
  -- The gateway's own reference. UNIQUE is the idempotency key: a replayed
  -- webhook hits this constraint instead of fulfilling twice.
  payment_ref       text unique,

  subtotal_sen      bigint not null check (subtotal_sen >= 0),
  shipping_fee_sen  bigint not null default 0 check (shipping_fee_sen >= 0),
  discount_sen      bigint not null default 0 check (discount_sen >= 0),
  total_sen         bigint not null check (total_sen >= 0),

  -- Snapshot, not a foreign key: the order must still read correctly after the
  -- customer edits or deletes the address it was placed against.
  shipping_address  jsonb not null,
  courier           text,
  tracking_no       text,

  -- Set when the state was chosen, so fulfilment can filter on it without
  -- re-deriving it from the address blob.
  is_east_malaysia  boolean not null default false,

  placed_at         timestamptz not null default now(),
  paid_at           timestamptz,
  shipped_at        timestamptz,
  delivered_at      timestamptz,
  updated_at        timestamptz not null default now()
);

create index orders_customer_idx on orders (customer_id, placed_at desc);
create index orders_status_idx on orders (status) where status <> 'delivered';

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  -- Kept for reporting, but nullable: a discontinued variant must not delete
  -- the history of what was sold.
  variant_id      uuid references product_variants(id) on delete set null,
  quantity        integer not null check (quantity > 0),

  -- Snapshots. An order line is a record of a transaction, not a live join —
  -- if the price or the name changes tomorrow, the invoice must not.
  unit_price_sen  bigint not null check (unit_price_sen >= 0),
  product_name    text not null,
  variant_label   text not null,
  sku             text not null
);

create index order_items_order_idx on order_items (order_id);

-- ------------------------------------------------- stock reservation ----

create or replace function reserve_stock(p_variant_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available integer;
begin
  if p_qty <= 0 then
    raise exception 'reserve_stock: quantity must be positive, got %', p_qty;
  end if;

  -- FOR UPDATE is the whole point. Without it two concurrent checkouts both
  -- read the same "1 left" and both succeed.
  select quantity_on_hand - reserved
    into v_available
    from inventory
   where variant_id = p_variant_id
     for update;

  if v_available is null then
    raise exception 'reserve_stock: no inventory row for variant %', p_variant_id;
  end if;

  if v_available < p_qty then
    return false;
  end if;

  update inventory
     set reserved = reserved + p_qty
   where variant_id = p_variant_id;

  return true;
end;
$$;

comment on function reserve_stock is
  'Atomically reserves stock for a variant. Returns false if insufficient. '
  'Takes a row lock, so concurrent checkouts serialise instead of overselling.';

create or replace function release_stock(p_variant_id uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update inventory
     set reserved = greatest(0, reserved - p_qty)
   where variant_id = p_variant_id;
end;
$$;

comment on function release_stock is
  'Releases a reservation — abandoned checkout, failed payment, cancellation.';

-- Payment confirmed: the reservation becomes a real decrement.
create or replace function commit_stock(p_variant_id uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update inventory
     set reserved = greatest(0, reserved - p_qty),
         quantity_on_hand = greatest(0, quantity_on_hand - p_qty)
   where variant_id = p_variant_id;
end;
$$;

comment on function commit_stock is
  'Converts a reservation into a decrement once payment is confirmed.';

-- These are called only from server-side handlers holding the service_role
-- key. Revoking the default EXECUTE grant stops a browser with the anon key
-- from reserving the whole catalogue.
revoke execute on function reserve_stock(uuid, integer) from public, anon, authenticated;
revoke execute on function release_stock(uuid, integer) from public, anon, authenticated;
revoke execute on function commit_stock(uuid, integer) from public, anon, authenticated;

-- =========================================================================
-- ROW LEVEL SECURITY
-- A customer reads their own orders. Nobody writes through the anon or
-- authenticated key: orders are created server-side, after the total has been
-- recomputed from the catalogue.
-- =========================================================================

alter table orders      enable row level security;
alter table order_items enable row level security;

create policy "customers read own orders"
  on orders for select to authenticated using ((select auth.uid()) = customer_id);

create policy "customers read own order items"
  on order_items for select to authenticated
  using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id and orders.customer_id = (select auth.uid())
    )
  );
