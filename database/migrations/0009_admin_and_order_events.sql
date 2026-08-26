-- 0009_admin_and_order_events.sql
-- Admin identities, the order timeline, and the state machine that moves an
-- order between statuses.

create type admin_role as enum ('owner', 'manager', 'staff');

-- An admin is NOT a customer with a flag. They are separate identities against
-- the same auth provider: a staff member should never inherit shop-side data by
-- accident, and revoking panel access must not touch anyone's order history.
create table admin_users (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name    text not null,
  role         admin_role not null default 'staff',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger admin_users_set_updated_at
  before update on admin_users
  for each row execute function set_updated_at();

alter table admin_users enable row level security;

-- An admin may read their own row (the panel shows their name and role).
-- Nothing else is readable, and nothing is writable through the anon or
-- authenticated key — admins are provisioned server-side.
create policy "admins read own row"
  on admin_users for select to authenticated
  using ((select auth.uid()) = auth_user_id);

-- ------------------------------------------------------- order timeline ----
-- Every status change, note and fulfilment edit, with who did it. An order's
-- history is the answer to "why did this happen", and it has to survive the
-- person who did it leaving.

create table order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  -- Nullable and ON DELETE SET NULL: removing a staff account must not erase
  -- the record of what they did.
  actor_id    uuid references admin_users(id) on delete set null,
  actor_name  text not null default 'system',
  kind        text not null,
  from_status order_status,
  to_status   order_status,
  note        text,
  created_at  timestamptz not null default now()
);

create index order_events_order_idx on order_events (order_id, created_at desc);
create index order_events_actor_idx on order_events (actor_id);

alter table order_events enable row level security;
-- No policy: the timeline is read server-side through the service_role client.
-- A customer has no business seeing internal notes.

-- ---------------------------------------------------------- state machine --

create or replace function transition_order(
  p_order_id uuid,
  p_to       order_status,
  p_actor_id uuid default null,
  p_note     text default null
)
returns order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from        order_status;
  v_paid        boolean;
  v_actor_name  text := 'system';
  v_line        record;
begin
  -- Lock the order for the whole transition. Two admins clicking "Ship" at the
  -- same moment must not both apply the stock effect.
  select status into v_from from orders where id = p_order_id for update;
  if v_from is null then
    raise exception 'transition_order: no order %', p_order_id;
  end if;

  if v_from = p_to then
    return v_from;  -- idempotent: clicking twice is not an error
  end if;

  -- The legal moves. Anything not listed is refused, including
  -- shipped -> cancelled: once it is with the courier, chase the courier.
  if not (
       (v_from = 'pending'   and p_to in ('paid', 'cancelled'))
    or (v_from = 'paid'      and p_to in ('packing', 'cancelled', 'refunded'))
    or (v_from = 'packing'   and p_to in ('shipped', 'cancelled', 'refunded'))
    or (v_from = 'shipped'   and p_to in ('delivered', 'refunded'))
    or (v_from = 'delivered' and p_to in ('refunded'))
  ) then
    raise exception 'transition_order: % -> % is not a legal transition', v_from, p_to;
  end if;

  v_paid := v_from <> 'pending';

  -- Stock effects.
  for v_line in
    select variant_id, quantity from order_items
     where order_id = p_order_id and variant_id is not null
  loop
    if v_from = 'pending' and p_to = 'paid' then
      -- The reservation held since checkout becomes a real decrement.
      perform commit_stock(v_line.variant_id, v_line.quantity);

    elsif v_from = 'pending' and p_to = 'cancelled' then
      -- Never paid: hand the reservation back.
      perform release_stock(v_line.variant_id, v_line.quantity);

    elsif v_paid and p_to = 'cancelled' then
      -- Paid but never shipped, so the goods are still on the shelf.
      update inventory
         set quantity_on_hand = quantity_on_hand + v_line.quantity
       where variant_id = v_line.variant_id;
    end if;
  end loop;

  if p_actor_id is not null then
    select full_name into v_actor_name from admin_users where id = p_actor_id;
  end if;

  update orders
     set status         = p_to,
         payment_status = case
                            when p_to = 'paid'     then 'paid'::payment_status
                            when p_to = 'refunded' then 'refunded'::payment_status
                            else payment_status
                          end,
         paid_at      = case when p_to = 'paid'      then coalesce(paid_at, now())      else paid_at end,
         shipped_at   = case when p_to = 'shipped'   then coalesce(shipped_at, now())   else shipped_at end,
         delivered_at = case when p_to = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
   where id = p_order_id;

  insert into order_events (order_id, actor_id, actor_name, kind, from_status, to_status, note)
  values (p_order_id, p_actor_id, coalesce(v_actor_name, 'system'), 'status', v_from, p_to, p_note);

  return p_to;
end;
$$;

comment on function transition_order is
  'Moves an order between statuses, applying the stock effect and writing the '
  'timeline entry in one transaction. Refuses illegal transitions. Idempotent '
  'when the target status is already set.';

revoke execute on function transition_order(uuid, order_status, uuid, text)
  from public, anon, authenticated;
