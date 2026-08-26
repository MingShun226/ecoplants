-- 0012_revoke_helper_execute.sql
--
-- The security advisor flags every SECURITY DEFINER function reachable through
-- PostgREST. Two of the three should not be reachable at all; the third must
-- be, and this migration records why.

-- `stamp_order_event_actor()` is a trigger function. Postgres does not check
-- EXECUTE when a trigger fires — only when the trigger is created — so nothing
-- needs this grant, and exposing it at /rest/v1/rpc/ is pure surface area.
revoke execute on function stamp_order_event_actor() from public, anon, authenticated;

-- `is_admin()` answers a question about the caller's own session, so an anon
-- call can only ever return false. It stays granted to `authenticated`, and
-- must: RLS policy expressions are evaluated as the querying role, so revoking
-- it there would break every admin policy that consults it.
revoke execute on function is_admin() from public, anon;

-- `transition_order()` remains executable by `authenticated`, and that is the
-- design rather than an oversight. The panel calls it as the signed-in admin so
-- that no service_role key has to exist in the application (ADR 0006). The
-- function refuses a caller who is not an active admin, refuses illegal
-- transitions, and derives the actor from the session — the advisor cannot see
-- those internal checks, so it will keep reporting this one. Leave it.
