-- 0031 — every variant has an inventory row, from the moment it exists.
--
-- `adjust_stock()` refuses a variant with no inventory row, and nothing in the
-- panel could create one: `inventory` carries a SELECT policy and nothing else,
-- deliberately, so that stock only ever moves through the function that also
-- writes `stock_movements`. That was airtight for variants seeded with their
-- inventory alongside them, and a dead end for a variant created afterwards —
-- the panel could not add a product at all, because the last step of doing so
-- had no way through.
--
-- The row is created by the database rather than by the caller, which keeps the
-- rule "no writes to inventory except through adjust_stock" intact. A new row
-- is zero: opening stock is then an ordinary `received` movement, so the very
-- first plant to arrive is in the audit trail like every one after it.

create or replace function public.ensure_inventory_row()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into inventory (variant_id, quantity_on_hand, reserved)
  values (new.id, 0, 0)
  on conflict (variant_id) do nothing;
  return new;
end;
$$;

-- Not callable directly. It is a trigger body, and a SECURITY DEFINER function
-- that writes to inventory is exactly what the table's policies exist to
-- prevent anyone calling by hand.
revoke execute on function public.ensure_inventory_row() from public, anon, authenticated;

drop trigger if exists product_variants_ensure_inventory on public.product_variants;

create trigger product_variants_ensure_inventory
after insert on public.product_variants
for each row
execute function public.ensure_inventory_row();

-- Anything already missing one. Should be nothing today; cheap insurance
-- against a variant that predates the trigger.
insert into inventory (variant_id, quantity_on_hand, reserved)
select v.id, 0, 0
from product_variants v
left join inventory i on i.variant_id = v.id
where i.variant_id is null;
