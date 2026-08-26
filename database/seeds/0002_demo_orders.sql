-- 0002_demo_orders.sql
--
-- Eight orders spanning every status, so the admin ordering module has
-- something to show. THEY ARE REVIEW SCAFFOLDING, NOT REAL DATA.
--
-- Every order number is prefixed `DEMO-`, and 0003_purge_demo_orders.sql
-- removes them and returns the stock they hold. Purge before the first real
-- order.
--
-- Orders are not hand-inserted at their final status. Each is created as
-- `pending` with a real reservation and then driven through transition_order()
-- one step at a time, exactly as the panel would. That means the timelines and
-- the stock effects are genuine rather than fabricated — a demo order that got
-- to `delivered` really did commit its stock on the way.
--
-- Run after 0001_catalogue.sql. Safe to re-run: it refuses if demo orders
-- already exist.

begin;

do $$
declare
  v_spec    record;
  v_variant record;
  v_order   uuid;
  v_sub     bigint;
  v_ship    bigint;
  v_step    text;
  v_placed  timestamptz;
begin
  if exists (select 1 from orders where order_no like 'DEMO-%') then
    raise notice 'Demo orders already present — nothing to do. Run 0003_purge_demo_orders.sql first.';
    return;
  end if;

  for v_spec in
    select * from (values
      -- order_no,      customer,          email,                  phone,          sku,             qty, city,            postcode, state,          east,  path
      ('DEMO-1001', 'Nurul Aisyah',   'nurul@example.com',    '+60123456701', 'MON-DEL-M-TER', 1, 'Petaling Jaya', '59309', 'Selangor',      false, array['paid']),
      ('DEMO-1002', 'Tan Wei Ming',   'weiming@example.com',  '+60123456702', 'SNK-TRI-M-CHA', 2, 'Cheras',        '77196', 'Kuala Lumpur',  false, array['paid']),
      ('DEMO-1003', 'Priya Raman',    'priya@example.com',    '+60123456703', 'SPD-COM-H-CRE', 1, 'George Town',   '49181', 'Pulau Pinang',  false, array['paid', 'cancelled']),
      ('DEMO-1004', 'Ahmad Zaki',     'zaki@example.com',     '+60123456704', 'AGL-COM-M-CHA', 1, 'Johor Bahru',   '44646', 'Johor',         false, array['paid', 'packing']),
      ('DEMO-1005', 'Lim Siew Hoon',  'siewhoon@example.com', '+60123456705', 'ZZZ-ZAM-S-CHA', 3, 'Shah Alam',     '55466', 'Selangor',      false, array['paid', 'packing', 'shipped']),
      ('DEMO-1006', 'Farah Hanim',    'farah@example.com',    '+60123456706', 'POT-AUR-H-TER', 2, 'Melaka',        '51679', 'Melaka',        false, array['paid', 'packing', 'shipped', 'delivered']),
      -- Cancelled before payment: the reservation goes back, nothing was ever
      -- decremented.
      ('DEMO-1007', 'Kumar Selvam',   'kumar@example.com',    '+60123456707', 'BNF-NID-M-TER', 1, 'Ipoh',          '82551', 'Perak',         false, array['cancelled']),
      -- Sabah: the East Malaysia warning in the panel has something to fire on.
      ('DEMO-1008', 'Chong Mei Ling', 'meiling@example.com',  '+60123456708', 'BOS-EXA-H-CRE', 1, 'Kota Kinabalu', '45878', 'Sabah',         true,  array[]::text[])
    ) as t(order_no, full_name, email, phone, sku, qty, city, postcode, state, east, path)
  loop
    select v.id, v.price_sen, v.sku into v_variant
      from product_variants v where v.sku = v_spec.sku;

    if v_variant.id is null then
      raise exception 'demo seed: no variant with sku %', v_spec.sku;
    end if;

    v_sub := v_variant.price_sen * v_spec.qty;
    -- The storefront's rule, applied here so demo totals agree with what a
    -- customer would have been quoted. See site.freeShippingThresholdSen.
    v_ship := case when v_sub >= 15000 then 0 else 1200 end;

    -- Spread them over the last few days so "Placed" reads sensibly.
    v_placed := now() - ((right(v_spec.order_no, 1)::int) * 7 || ' hours')::interval;

    insert into orders (
      order_no, full_name, email, phone,
      status, payment_status, payment_method,
      subtotal_sen, shipping_fee_sen, discount_sen, total_sen,
      shipping_address, is_east_malaysia, placed_at
    ) values (
      v_spec.order_no, v_spec.full_name, v_spec.email, v_spec.phone,
      'pending', 'unpaid', 'fpx',
      v_sub, v_ship, 0, v_sub + v_ship,
      jsonb_build_object(
        'line1', (37 + (right(v_spec.order_no, 1)::int * 7)) || ', Jalan Contoh',
        'line2', null,
        'city', v_spec.city,
        'postcode', v_spec.postcode,
        'state', v_spec.state
      ),
      v_spec.east, v_placed
    ) returning id into v_order;

    insert into order_items (
      order_id, variant_id, quantity, unit_price_sen, product_name, variant_label, sku
    )
    select v_order, v_variant.id, v_spec.qty, v_variant.price_sen,
           t.name, v.size_key, v.sku
      from product_variants v
      join product_translations t
        on t.product_id = v.product_id and t.locale = 'en'
     where v.id = v_variant.id;

    -- Hold the stock, exactly as checkout does.
    perform reserve_stock(v_variant.id, v_spec.qty);

    -- Walk it to its final status through the real state machine.
    foreach v_step in array v_spec.path loop
      perform transition_order(
        v_order,
        v_step::order_status,
        case
          when v_step = 'paid'      then 'Payment confirmed (demo)'
          when v_step = 'cancelled' then 'Customer changed their mind (demo)'
          else null
        end
      );
    end loop;

    -- Anything that shipped has a courier and a tracking number.
    if 'shipped' = any(v_spec.path) then
      update orders
         set courier     = 'J&T Express',
             tracking_no = 'JT' || lpad((right(v_spec.order_no, 4)::int * 68207)::text, 9, '0')
       where id = v_order;
    end if;
  end loop;
end $$;

commit;

select order_no, status, payment_status, total_sen
from orders where order_no like 'DEMO-%' order by order_no;
