-- 0011_column_grants_and_actor_stamp.sql
--
-- Closes two gaps left by 0010, both of the same kind: a policy that describes
-- an intent the database was not actually enforcing.
--
-- 1. "admins update fulfilment" claimed to allow fulfilment fields only. RLS
--    gates rows, never columns, so an admin could PATCH /orders with
--    {"status":"delivered"} and skip transition_order() entirely — no legality
--    check, no stock effect, no timeline entry. A pending order could be marked
--    delivered while its reservation was still held and quantity_on_hand had
--    never been decremented. Verified exploitable before this migration.
--
--    Column privileges are the only mechanism that restricts columns, so the
--    blanket UPDATE grant is replaced with one naming the two fields the panel
--    actually writes.
--
-- 2. order_events accepted whatever actor_id and actor_name the client sent, so
--    an admin could attribute their own action to a colleague. An audit trail
--    that the audited party can write freely is not an audit trail.

-- ------------------------------------------------------- column privileges --

revoke update on orders from authenticated;
grant update (courier, tracking_no) on orders to authenticated;

-- transition_order() is SECURITY DEFINER and runs as the table owner, so it
-- keeps writing status, paid_at, shipped_at and delivered_at. That is the
-- point: the state machine becomes the only way status moves.

-- ------------------------------------------------------------ actor stamp --

create or replace function stamp_order_event_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text;
begin
  -- A NULL auth.uid() is service_role — the payment webhook, which has no
  -- session and legitimately writes 'system' events. Anything with a session
  -- must be an active admin, and is stamped as itself whatever it claimed.
  if (select auth.uid()) is not null then
    select id, full_name into v_id, v_name
      from admin_users
     where auth_user_id = (select auth.uid()) and is_active;

    if v_id is null then
      raise exception 'order_events: not an active admin';
    end if;

    new.actor_id   := v_id;
    new.actor_name := v_name;
  end if;

  return new;
end;
$$;

comment on function stamp_order_event_actor is
  'Overwrites actor_id and actor_name on order_events from the caller''s own '
  'session, so a timeline entry cannot be attributed to someone else.';

create trigger order_events_stamp_actor
  before insert on order_events
  for each row execute function stamp_order_event_actor();

-- Status rows are written only by transition_order(), which bypasses this
-- policy as the table owner. A session inserting one by hand would be a forged
-- transition with no stock effect behind it, so the policy refuses the kind.
drop policy "admins write order events" on order_events;

create policy "admins write order events"
  on order_events for insert to authenticated
  with check (is_admin() and kind in ('note', 'fulfilment'));
