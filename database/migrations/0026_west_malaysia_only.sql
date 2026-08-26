-- 0026_west_malaysia_only.sql
--
-- The shop delivers to West Malaysia only.
--
-- Until now that was expressed per product: a `peninsular_only` flag, checked
-- against the delivery state, refusing individual lines. 0025 cleared the flag
-- because it described a decision the shop does not actually make — and that
-- left place_order() with nothing to refuse, so an order to Sabah would have
-- gone straight through.
--
-- The real rule is simpler and stricter, and belongs on the address rather than
-- on the plant: no order ships to Sabah, Sarawak or Labuan, whatever is in it.

create or replace function place_order(
  p_lines   jsonb,
  p_contact jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_line        jsonb;
  v_variant     record;
  v_qty         integer;
  v_subtotal    bigint := 0;
  v_shipping    bigint;
  v_order_id    uuid;
  v_order_no    text;
  v_settings    record;
  v_count       integer := 0;
  v_customer    uuid := (select auth.uid());
  v_name        text := btrim(coalesce(p_contact->>'full_name', ''));
  v_email       text := lower(btrim(coalesce(p_contact->>'email', '')));
  v_phone       text := btrim(coalesce(p_contact->>'phone', ''));
  v_state       text := btrim(coalesce(p_contact->>'state', ''));
begin
  if v_name = '' or v_email = '' or v_phone = '' then
    raise exception 'place_order: name, email and phone are all required';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'place_order: that email address does not look right';
  end if;

  if btrim(coalesce(p_contact->>'line1', '')) = ''
     or btrim(coalesce(p_contact->>'city', '')) = ''
     or v_state = '' then
    raise exception 'place_order: a full delivery address is required';
  end if;

  if btrim(coalesce(p_contact->>'postcode', '')) !~ '^[0-9]{5}$' then
    raise exception 'place_order: postcode must be five digits';
  end if;

  -- One rule, on the address, before anything else is considered.
  if is_east_malaysian_state(v_state) then
    raise exception 'place_order: we deliver to West Malaysia only — % is outside our coverage', v_state;
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'place_order: the basket is empty';
  end if;

  v_phone := coalesce(normalise_my_phone(v_phone), v_phone);

  if v_customer is not null and not exists (select 1 from customers where id = v_customer) then
    v_customer := null;
  end if;

  select free_shipping_threshold_sen, standard_shipping_sen
    into v_settings from shop_settings where id;

  v_order_no := 'EP-' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM')
                      || '-' || lpad(nextval('order_no_seq')::text, 4, '0');

  insert into orders (
    order_no, customer_id, full_name, email, phone, status, payment_status,
    subtotal_sen, shipping_fee_sen, total_sen, shipping_address, is_east_malaysia
  ) values (
    v_order_no, v_customer, v_name, v_email, v_phone, 'pending', 'unpaid',
    0, 0, 0,
    jsonb_build_object(
      'line1',    btrim(p_contact->>'line1'),
      'line2',    nullif(btrim(coalesce(p_contact->>'line2', '')), ''),
      'city',     btrim(p_contact->>'city'),
      'postcode', btrim(p_contact->>'postcode'),
      'state',    v_state
    ),
    false
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line->>'quantity')::integer, 0);

    if v_qty < 1 or v_qty > 99 then
      raise exception 'place_order: quantity must be between 1 and 99';
    end if;

    select v.id, v.sku, v.size_key, v.price_sen, p.is_active, t.name as product_name
      into v_variant
      from product_variants v
      join products p on p.id = v.product_id
      left join product_translations t on t.product_id = p.id and t.locale = 'en'
     where v.id = (v_line->>'variant_id')::uuid;

    if v_variant.id is null then
      raise exception 'place_order: one of the plants in your basket no longer exists';
    end if;

    if not v_variant.is_active then
      raise exception 'place_order: % is no longer for sale', coalesce(v_variant.product_name, v_variant.sku);
    end if;

    if not reserve_stock(v_variant.id, v_qty) then
      raise exception 'place_order: there is not enough % left', coalesce(v_variant.product_name, v_variant.sku);
    end if;

    insert into order_items (
      order_id, variant_id, quantity, unit_price_sen, product_name, variant_label, sku
    ) values (
      v_order_id, v_variant.id, v_qty, v_variant.price_sen,
      coalesce(v_variant.product_name, v_variant.sku), v_variant.size_key, v_variant.sku
    );

    v_subtotal := v_subtotal + (v_variant.price_sen::bigint * v_qty);
    v_count := v_count + 1;
  end loop;

  v_shipping := case
                  when v_subtotal >= v_settings.free_shipping_threshold_sen then 0
                  else v_settings.standard_shipping_sen
                end;

  update orders
     set subtotal_sen     = v_subtotal,
         shipping_fee_sen = v_shipping,
         total_sen        = v_subtotal + v_shipping
   where id = v_order_id;

  insert into order_events (order_id, actor_name, kind, to_status, note)
  values (v_order_id, 'customer', 'status', 'pending',
          v_count || (case when v_count = 1 then ' item' else ' items' end) || ', awaiting payment');

  return jsonb_build_object(
    'order_id',  v_order_id,
    'order_no',  v_order_no,
    'total_sen', v_subtotal + v_shipping
  );
end;
$fn$;


