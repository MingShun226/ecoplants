-- 0021_claim_order.sql
--
-- Attaching a guest order to an account, without SMS verification.
--
-- ADR 0008 ruled out matching orders to a new account by phone number: the
-- phone is unverified and order numbers are sequential, so "you know the
-- number" and "you know the order number" are two guessable things, not two
-- secrets. That still holds, and OTP is now explicitly not being added.
--
-- But there is already a real secret in this system: **the order id**. It is
-- 122 bits of unguessable, handed to exactly one person at checkout, never
-- listed anywhere, and it is the whole basis of the receipt page. Anyone
-- holding it can already read the order.
--
-- So the capability check is simply: are you signed in, and do you have the
-- link? Claiming grants continued access through /account to an order the
-- caller can already read by pasting the URL. No escalation, and no OTP.

create or replace function claim_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_caller uuid := (select auth.uid());
  v_owner  uuid;
  v_found  boolean;
begin
  if v_caller is null then
    raise exception 'claim_order: you need to be signed in';
  end if;

  -- Staff have no customers row, and orders.customer_id references it. An
  -- admin testing checkout must not end up owning a customer's order.
  if not exists (select 1 from customers where id = v_caller) then
    raise exception 'claim_order: this is not a shopping account';
  end if;

  select true, customer_id into v_found, v_owner
    from orders where id = p_order_id for update;

  if v_found is null then
    raise exception 'claim_order: no such order';
  end if;

  -- Already claimed. Idempotent for the owner — a customer who clicks twice, or
  -- reloads the receipt, gets the same answer rather than an error. Someone
  -- else's order is refused outright, which is the case that matters: a shared
  -- link must not let the recipient take the order off the person who bought it.
  if v_owner is not null then
    return v_owner = v_caller;
  end if;

  update orders set customer_id = v_caller where id = p_order_id;
  return true;
end;
$fn$;

comment on function claim_order is
  'Attaches an unclaimed order to the signed-in customer. The order id is the '
  'capability: holding it already grants read access via the receipt, so this '
  'grants nothing new. Refuses an order owned by someone else.';

-- authenticated only. A guest has no account to claim it into, and there is no
-- reason for service_role to reach it either.
revoke execute on function claim_order(uuid) from public, anon;
grant execute on function claim_order(uuid) to authenticated;
