-- 0017_pin_search_path.sql
--
-- `is_east_malaysian_state` shipped without a pinned search_path. It is
-- `immutable` and touches no tables, so the practical risk is small, but a
-- function with a role-mutable search_path is a shape worth never having: it is
-- the same shape that, on a SECURITY DEFINER function, lets a caller redirect
-- an unqualified name to something of their own.
--
-- Every other function in this schema already sets it. This makes the rule
-- exception-free.

create or replace function is_east_malaysian_state(p_state text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(btrim(coalesce(p_state, ''))) in ('sabah', 'sarawak', 'labuan');
$$;
