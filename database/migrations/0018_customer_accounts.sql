-- 0018_customer_accounts.sql
--
-- Customer accounts, keyed on a Malaysian mobile number.
--
-- Phone rather than email because that is how this market works: a customer
-- gives you a number, expects to hear from you on WhatsApp, and often does not
-- have an email they check. Supabase Auth stores it as E.164 (+60...), which is
-- also exactly the format wa.me wants, so the number the shop messages is the
-- number the customer logs in with.
--
-- REQUIRES the Phone provider enabled in Supabase Auth. With no SMS provider
-- connected, "Confirm phone" must be off — otherwise every signup waits on an
-- OTP that is never sent.

-- --------------------------------------------------------- normalisation --
-- One person, one account. Malaysians write their number half a dozen ways
-- (012-345 6789, 0123456789, +60 12 345 6789) and every one of them has to
-- land on the same row, or the same customer quietly ends up with three.

create or replace function normalise_my_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $fn$
declare
  v_digits text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
begin
  -- 60123456789 -> as-is. 0123456789 -> drop the trunk zero. 123456789 -> bare.
  if left(v_digits, 2) = '60' then
    v_digits := v_digits;
  elsif left(v_digits, 1) = '0' then
    v_digits := '60' || substr(v_digits, 2);
  else
    v_digits := '60' || v_digits;
  end if;

  -- Malaysian mobile: 01X prefix, so E.164 is 60 then 1 then 8-9 more digits.
  -- 011 and 015 carry an extra digit, which is why this is a range and not a
  -- fixed length. Landlines are rejected on purpose — deliveries and the whole
  -- support channel run on WhatsApp.
  if v_digits !~ '^601[0-9]{7,8}$' then
    return null;
  end if;

  return '+' || v_digits;
end;
$fn$;

comment on function normalise_my_phone is
  'Any way a Malaysian writes their mobile number to one E.164 string, or NULL '
  'if it is not a valid Malaysian mobile.';

grant execute on function normalise_my_phone(text) to anon, authenticated, service_role;

-- ------------------------------------------------------- customer on join --
-- A customer row is created by the database when the auth user appears, not by
-- the application afterwards. A signup that half-succeeds — auth user created,
-- profile insert failed — leaves someone who can log in and has no account.

create or replace function handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Phone is the discriminator. Admins sign in with an email address and must
  -- never acquire a customer profile by accident: they are separate identities
  -- against the same auth provider (ADR 0006).
  if new.phone is null or new.phone = '' then
    return new;
  end if;

  insert into customers (id, full_name, phone)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    '+' || new.phone
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

comment on function handle_new_customer is
  'Creates the customers row when a phone-based auth user is created. Skips '
  'email-based users, who are staff.';

drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created
  after insert on auth.users
  for each row execute function handle_new_customer();

-- Supabase stores auth.users.phone without the leading '+'; customers.phone
-- keeps it so it matches orders.phone and wa.me links without special-casing.

-- ------------------------------------------------- orders know their owner --
-- place_order() gains one line: if the caller has a session, the order belongs
-- to them. Guests keep working exactly as before, with customer_id null.
--
-- Deliberately NOT matching guest orders to an account by phone number. The
-- phone is unverified (no OTP), and order numbers are sequential, so neither
-- "you know the number" nor "you know the order number" is a secret. Claiming
-- past orders waits for real phone verification.

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
  v_east        boolean;
  v_order_id    uuid;
  v_order_no    text;
  v_settings    record;
  v_count       integer := 0;
  v_blocked     text[] := '{}';
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

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'place_order: the basket is empty';
  end if;

  -- Stored normalised, so an order placed as "012-345 6789" still matches the
  -- account that signed in as "+60123456789".
  v_phone := coalesce(normalise_my_phone(v_phone), v_phone);

  -- An admin session is not a customer. Without this, a staff member testing
  -- checkout would attach the order to an account that has no customers row,
  -- and the foreign key would refuse it.
  if v_customer is not null and not exists (select 1 from customers where id = v_customer) then
    v_customer := null;
  end if;

  v_east := is_east_malaysian_state(v_state);

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
    v_east
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line->>'quantity')::integer, 0);

    if v_qty < 1 or v_qty > 99 then
      raise exception 'place_order: quantity must be between 1 and 99';
    end if;

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

    if v_east and v_variant.peninsular_only then
      v_blocked := v_blocked || coalesce(v_variant.product_name, v_variant.sku);
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

  if array_length(v_blocked, 1) > 0 then
    raise exception 'place_order: % cannot be delivered to %. Remove % to continue.',
      array_to_string(v_blocked, ', '), v_state, array_to_string(v_blocked, ', ');
  end if;

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
  'fails. Attaches the order to the signed-in customer, if there is one. The '
  'client never supplies a price or a total.';

revoke execute on function place_order(jsonb, jsonb) from public;
grant execute on function place_order(jsonb, jsonb) to anon, authenticated, service_role;

-- --------------------------------------------------------- saved addresses --
-- The address book already existed with an owner-scoped policy and no UI. The
-- account area writes to it, so it needs a unique default per customer rather
-- than trusting the application to keep only one flag set.

create unique index if not exists addresses_one_default_per_customer
  on addresses (customer_id) where is_default;
