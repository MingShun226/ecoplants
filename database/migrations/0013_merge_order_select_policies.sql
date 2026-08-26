-- 0013_merge_order_select_policies.sql
--
-- `orders` and `order_items` each carried two permissive SELECT policies for
-- `authenticated` — one for the owning customer, one for admins. Postgres must
-- evaluate every permissive policy on a table for the same role and action, so
-- a customer opening their own order paid for the admin check as well.
--
-- Merged into one policy per table with an OR. Same access, one expression.
-- This is the fix migration 0008 applied to `reviews`, for the same reason.
--
-- `is_admin()` is first in the OR deliberately: it is a cheap indexed lookup and
-- short-circuits the correlated EXISTS on order_items, which is the admin
-- panel's hot path.

drop policy "admins read all orders" on orders;
drop policy "customers read own orders" on orders;

create policy "read own orders, or any as admin"
  on orders for select to authenticated
  using (
    is_admin()
    or (select auth.uid()) = customer_id
  );

drop policy "admins read all order items" on order_items;
drop policy "customers read own order items" on order_items;

create policy "read own order items, or any as admin"
  on order_items for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from orders
       where orders.id = order_items.order_id
         and orders.customer_id = (select auth.uid())
    )
  );
