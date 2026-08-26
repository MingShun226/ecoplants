-- 0020_order_events_allow_customers.sql
--
-- Fixes a bug that only appears where two features meet.
--
-- `stamp_order_event_actor()` (0011) was written when order_events was written
-- by admins and by the payment path, and nobody else. It raises "not an active
-- admin" for any session that is not an admin. Then 0018 gave customers
-- accounts — and `place_order()` writes an order_events row.
--
-- So: a guest could check out (auth.uid() is null, trigger skips), and a
-- **signed-in customer could not check out at all**. Every earlier test passed
-- because every earlier test was a guest.
--
-- The trigger's real job is stopping an admin attributing an action to a
-- colleague. That is kept. What changes is the else branch: a non-admin session
-- no longer raises, it is pinned to an anonymous 'customer' actor. Pinned
-- rather than trusted, so that if an INSERT policy for customers is ever added,
-- they still cannot claim to be a member of staff.
--
-- Direct inserts by customers remain impossible regardless: the only INSERT
-- policy on order_events requires is_admin(), so a non-admin row can only
-- arrive through a SECURITY DEFINER function in this schema.

create or replace function stamp_order_event_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id   uuid;
  v_name text;
begin
  -- No session: service_role, or a SECURITY DEFINER function called by a guest.
  -- Whatever it set stands — 'system' for the payment path, 'customer' for
  -- place_order().
  if (select auth.uid()) is null then
    return new;
  end if;

  select id, full_name into v_id, v_name
    from admin_users
   where auth_user_id = (select auth.uid()) and is_active;

  if v_id is not null then
    -- Staff are stamped as themselves, whatever the insert claimed.
    new.actor_id   := v_id;
    new.actor_name := v_name;
  else
    -- A signed-in customer. They have no admin identity to record, and must not
    -- be able to borrow one.
    new.actor_id   := null;
    new.actor_name := 'customer';
  end if;

  return new;
end;
$fn$;

comment on function stamp_order_event_actor is
  'Stamps order_events actor from the caller''s own session: staff as '
  'themselves, a signed-in customer as an anonymous ''customer'', and a '
  'sessionless caller left alone. A timeline entry cannot be attributed to '
  'someone else.';
