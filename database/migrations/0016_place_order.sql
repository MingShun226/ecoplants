-- 0016_place_order.sql
--
-- Checkout finally submits.
--
-- Everything that decides what a customer is charged is computed here, from the
-- catalogue, inside one transaction. The browser sends variant ids, quantities
-- and an address — nothing else. It does not send prices, it does not send a
-- total, and it is not asked whether the address is in East Malaysia. A cart
-- cookie is a note the customer wrote to themselves; it is not evidence.
--
-- There is still no INSERT policy on `orders` or `order_items`, deliberately.
-- Rows arrive only through place_order(), which runs as the table owner. That
-- means there is exactly one code path into the orders table and it is this one.

create sequence if not exists order_no_seq start with 1001;

-- Live plants that cannot survive 7-8 days in transit. Kept here rather than
-- taken as a parameter so the client cannot simply claim to be in Selangor.
create or replace function is_east_malaysian_state(p_state text)
returns boolean
language sql
immutable
as $$
  select lower(btrim(coalesce(p_state, ''))) in ('sabah', 'sarawak', 'labuan');
$$;

create or replace function place_order(
  p_lines   jsonb,   -- [{ "variant_id": uuid, "quantity": int }, ...]
  p_contact jsonb    -- { full_name, email, phone, line1, line2, city, postcode, state }
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
  v_east        boolean;
  v_order_id    uuid;
  v_order_no    text;
  v_settings    record;
  v_count       integer := 0;
  v_blocked     text[] := '{}';
  v_name        text := btrim(coalesce(p_contact->>'full_name', ''));
  v_email       text := lower(btrim(coalesce(p_contact->>'email', '')));
  v_phone       text := btrim(coalesce(p_contact->>'phone', ''));
  v_state       text := btrim(coalesce(p_contact->>'state', ''));
begin
  -- ------------------------------------------------------------- contact --
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

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'place_order: the basket is empty';
  end if;

  v_east := is_east_malaysian_state(v_state);

  select free_shipping_threshold_sen, standard_shipping_sen
    into v_settings from shop_settings where id;

  -- --------------------------------------------------------------- order --
  v_order_no := 'EP-' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM')
                      || '-' || lpad(nextval('order_no_seq')::text, 4, '0');

  insert into orders (
    order_no, full_name, email, phone, status, payment_status,
    subtotal_sen, shipping_fee_sen, total_sen, shipping_address, is_east_malaysia
  ) values (
    v_order_no, v_name, v_email, v_phone, 'pending', 'unpaid',
    0, 0, 0,
    jsonb_build_object(
      'line1',    btrim(p_contact->>'line1'),
      'line2',    nullif(btrim(coalesce(p_contact->>'line2', '')), ''),
      'city',     btrim(p_contact->>'city'),
      'postcode', btrim(p_contact->>'postcode'),
      'state',    v_state
    ),
    v_east
  ) returning id into v_order_id;

  -- --------------------------------------------------------------- lines --
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line->>'quantity')::integer, 0);

    if v_qty < 1 or v_qty > 99 then
      raise exception 'place_order: quantity must be between 1 and 99';
    end if;

    -- The price comes from here and nowhere else.
    select v.id, v.sku, v.size_key, v.price_sen, p.is_active, p.peninsular_only,
           t.name as product_name
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

    -- East Malaysia is checked per line, against the product, not against a
    -- flag the browser sent. Collected rather than raised immediately so the
    -- customer is told about every affected plant at once.
    if v_east and v_variant.peninsular_only then
      v_blocked := v_blocked || coalesce(v_variant.product_name, v_variant.sku);
    end if;

    -- Takes a row lock before it reads, so two people racing for the last
    -- plant serialise rather than both succeeding.
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

  if array_length(v_blocked, 1) > 0 then
    raise exception 'place_order: % cannot be delivered to %. Remove % to continue.',
      array_to_string(v_blocked, ', '), v_state, array_to_string(v_blocked, ', ');
  end if;

  -- ------------------------------------------------------------- totals --
  -- Recomputed from the settings row, so a stale threshold in a page the
  -- customer left open yesterday cannot buy them free delivery.
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

comment on function place_order is
  'Creates an order from variant ids and quantities. Recomputes every price, '
  'the delivery fee and the East Malaysia restriction from the database, '
  'reserves stock under a row lock, and rolls the whole thing back if any line '
  'fails. The client never supplies a price or a total.';

revoke execute on function place_order(jsonb, jsonb) from public;
grant execute on function place_order(jsonb, jsonb) to anon, authenticated, service_role;

-- ------------------------------------------------------------ the receipt --
-- A guest has no account, so the order id doubles as the capability to see it:
-- 122 bits of unguessable, handed back once at checkout. A SELECT policy would
-- have to be `using (true)` to work for anon, which would expose every order to
-- anyone who could enumerate ids.

create or replace function get_order_receipt(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order jsonb;
begin
  select jsonb_build_object(
           'order_no',         o.order_no,
           'status',           o.status,
           'payment_status',   o.payment_status,
           'full_name',        o.full_name,
           'email',            o.email,
           'subtotal_sen',     o.subtotal_sen,
           'shipping_fee_sen', o.shipping_fee_sen,
           'total_sen',        o.total_sen,
           'shipping_address', o.shipping_address,
           'is_east_malaysia', o.is_east_malaysia,
           'placed_at',        o.placed_at,
           'courier',          o.courier,
           'tracking_no',      o.tracking_no,
           'lines', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'product_name',   i.product_name,
                      'variant_label',  i.variant_label,
                      'sku',            i.sku,
                      'quantity',       i.quantity,
                      'unit_price_sen', i.unit_price_sen
                    ) order by i.product_name)
               from order_items i where i.order_id = o.id
           ), '[]'::jsonb)
         )
    into v_order
    from orders o
   where o.id = p_order_id;

  -- Phone and internal notes are deliberately absent: a receipt needs to prove
  -- what was bought, not hand back everything the shop knows.
  return v_order;  -- null when there is no such order
end;
$fn$;

comment on function get_order_receipt is
  'Order confirmation for a guest, keyed on the unguessable order id. Returns '
  'only what a receipt needs.';

revoke execute on function get_order_receipt(uuid) from public;
grant execute on function get_order_receipt(uuid) to anon, authenticated, service_role;

-- --------------------------------------------------------- dummy payment --
-- THIS IS A STAND-IN. No gateway is connected, so "paying" is a button.
--
-- When a real gateway arrives, this function stays and its grants change: the
-- webhook calls it with `service_role`, and EXECUTE is revoked from `anon` and
-- `authenticated`. Until then anon must be able to call it, which means someone
-- holding an order id could mark that order paid without paying. That is
-- acceptable for a shop with no payments and unacceptable the moment there are.
--
-- `payment_ref` is unique, so a replayed confirmation conflicts instead of
-- committing stock a second time. That part is not a stand-in — it is the
-- property the real webhook will depend on.

create or replace function confirm_payment(
  p_order_id    uuid,
  p_payment_ref text,
  p_method      text default 'fpx'
)
returns order_status
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status order_status;
begin
  select status into v_status from orders where id = p_order_id for update;

  if v_status is null then
    raise exception 'confirm_payment: no such order';
  end if;

  -- Idempotent: a customer who refreshes the return page, or a gateway that
  -- retries its webhook, must not commit stock twice.
  if v_status <> 'pending' then
    return v_status;
  end if;

  update orders
     set payment_ref    = p_payment_ref,
         payment_method = p_method
   where id = p_order_id;

  -- transition_order() does the rest: commits the reservation, stamps paid_at,
  -- writes the timeline entry. auth.uid() is null here for a guest, so it
  -- records the actor as 'system' rather than refusing.
  return transition_order(p_order_id, 'paid', 'Payment received (' || p_payment_ref || ')');
end;
$fn$;

comment on function confirm_payment is
  'Marks an order paid and commits its reserved stock. Idempotent. DUMMY '
  'GATEWAY SEAM: grant to service_role only and revoke from anon once a real '
  'payment webhook exists.';

revoke execute on function confirm_payment(uuid, text, text) from public;
grant execute on function confirm_payment(uuid, text, text) to anon, authenticated, service_role;

-- Cancelling an unpaid order from the pay screen, so a customer who changes
-- their mind releases the plants they were holding instead of leaving them
-- reserved until something sweeps them up.
create or replace function abandon_order(p_order_id uuid)
returns order_status
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status order_status;
begin
  select status into v_status from orders where id = p_order_id for update;

  if v_status is null then
    raise exception 'abandon_order: no such order';
  end if;

  -- Only ever an unpaid order. Anything further along is the shop's decision,
  -- not a link the customer still has open.
  if v_status <> 'pending' then
    return v_status;
  end if;

  return transition_order(p_order_id, 'cancelled', 'Abandoned at payment');
end;
$fn$;

comment on function abandon_order is
  'Cancels an unpaid order and releases its stock. Refuses anything already '
  'paid for.';

revoke execute on function abandon_order(uuid) from public;
grant execute on function abandon_order(uuid) to anon, authenticated, service_role;
