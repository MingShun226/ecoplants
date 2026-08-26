-- 0003_purge_demo_orders.sql
--
-- Removes the demo orders and returns the stock they hold, so the catalogue is
-- back to exactly what 0001 seeded.
--
-- Run this before the first real order. Demo rows are identifiable by their
-- `DEMO-` order number prefix and nothing else keys off them, so this is safe
-- to run at any time — including twice.

begin;

-- Reverse each order's stock effect according to where it got to.
--
--   pending                              still holds a reservation  -> release it
--   paid / packing / shipped / delivered committed the stock        -> add it back
--   cancelled                            already returned           -> nothing
--   refunded                             committed, never restored  -> add it back
do $$
declare
  v_line record;
begin
  for v_line in
    select oi.variant_id, oi.quantity, o.status
      from orders o
      join order_items oi on oi.order_id = o.id
     where o.order_no like 'DEMO-%'
       and oi.variant_id is not null
  loop
    if v_line.status = 'pending' then
      perform release_stock(v_line.variant_id, v_line.quantity);
    elsif v_line.status in ('paid', 'packing', 'shipped', 'delivered', 'refunded') then
      update inventory
         set quantity_on_hand = quantity_on_hand + v_line.quantity
       where variant_id = v_line.variant_id;
    end if;
  end loop;
end $$;

-- order_items and order_events cascade.
delete from orders where order_no like 'DEMO-%';

commit;

-- Expect 594 on hand and 0 reserved, matching the state after 0001.
select sum(quantity_on_hand) as total_on_hand, sum(reserved) as total_reserved
from inventory;
