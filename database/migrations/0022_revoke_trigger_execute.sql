-- 0022_revoke_trigger_execute.sql
--
-- `handle_new_customer()` (0018) is a trigger function and was left exposed at
-- /rest/v1/rpc/. Postgres does not check EXECUTE when a trigger fires — only
-- when the trigger is created — so nothing needs the grant.
--
-- Calling it directly would fail anyway, since there is no NEW record outside a
-- trigger. That is not the point: a SECURITY DEFINER function that inserts into
-- `customers` should not be reachable from the public API at all, and relying
-- on "it happens to error" is not a boundary.
--
-- Migration 0012 did exactly this for `stamp_order_event_actor()`. This makes
-- the rule exception-free again.

revoke execute on function handle_new_customer() from public, anon, authenticated;
