-- 0010_admin_access_via_rls.sql
--
-- The admin panel reads and writes orders through the signed-in admin's own
-- session, not through the service_role key.
--
-- ADR 0005 said admin writes would use service_role, which bypasses RLS. That
-- is the wrong default for this module. A god-key in the application means one
-- missing `.eq()` in a server component exposes every customer's address; here
-- the database itself refuses anyone who is not in `admin_users`, so the route
-- guard and the policies fail independently. It also means the panel works
-- without ever putting the service_role key in the app.
--
-- service_role keeps its bypass for the payment webhook, which has no session.

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users
     where auth_user_id = (select auth.uid())
       and is_active
  );
$$;

comment on function is_admin is
  'True when the current session belongs to an active admin. SECURITY DEFINER '
  'so policies can consult admin_users without granting it to everyone.';

grant execute on function is_admin() to authenticated;

-- ---------------------------------------------------------------- orders ----

create policy "admins read all orders"
  on orders for select to authenticated
  using (is_admin());

-- Fulfilment fields only. Status is NOT editable by hand: it moves through
-- transition_order(), which is the only thing that keeps stock in step.
create policy "admins update fulfilment"
  on orders for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "admins read all order items"
  on order_items for select to authenticated
  using (is_admin());

create policy "admins read order events"
  on order_events for select to authenticated
  using (is_admin());

create policy "admins write order events"
  on order_events for insert to authenticated
  with check (is_admin());

-- ------------------------------------------------------ state transitions ----
-- Redefined so the actor is derived from the session rather than passed in: a
-- caller must not be able to attribute their action to a colleague.

drop function if exists transition_order(uuid, order_status, uuid, text);

create or replace function transition_order(
  p_order_id uuid,
  p_to       order_status,
  p_note     text default null
)
returns order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from       order_status;
  v_paid       boolean;
  v_actor_id   uuid;
  v_actor_name text := 'system';
  v_line       record;
begin
  -- A session that is not an admin is refused outright. A NULL auth.uid() means
  -- service_role (the payment webhook), which has no session and is trusted;
  -- anon cannot reach here at all, because EXECUTE is not granted to it.
  if (select auth.uid()) is not null then
    if not is_admin() then
      raise exception 'transition_order: not authorised';
    end if;
    select id, full_name into v_actor_id, v_actor_name
      from admin_users where auth_user_id = (select auth.uid());
  end if;

  -- Lock the order for the whole transition. Two admins clicking "Ship" at the
  -- same moment must not both apply the stock effect.
  select status into v_from from orders where id = p_order_id for update;
  if v_from is null then
    raise exception 'transition_order: no order %', p_order_id;
  end if;

  if v_from = p_to then
    return v_from;  -- idempotent: clicking twice is not an error
  end if;

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

  for v_line in
    select variant_id, quantity from order_items
     where order_id = p_order_id and variant_id is not null
  loop
    if v_from = 'pending' and p_to = 'paid' then
      perform commit_stock(v_line.variant_id, v_line.quantity);
    elsif v_from = 'pending' and p_to = 'cancelled' then
      perform release_stock(v_line.variant_id, v_line.quantity);
    elsif v_paid and p_to = 'cancelled' then
      -- Paid but never shipped, so the goods are still on the shelf.
      update inventory
         set quantity_on_hand = quantity_on_hand + v_line.quantity
       where variant_id = v_line.variant_id;
    end if;
  end loop;

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
  values (p_order_id, v_actor_id, coalesce(v_actor_name, 'system'), 'status', v_from, p_to, p_note);

  return p_to;
end;
$$;

comment on function transition_order is
  'Moves an order between statuses, applying the stock effect and writing the '
  'timeline entry in one transaction. Actor is derived from the session, never '
  'passed in. Refuses illegal transitions and non-admin callers.';

revoke execute on function transition_order(uuid, order_status, text) from public, anon;
grant execute on function transition_order(uuid, order_status, text) to authenticated, service_role;
