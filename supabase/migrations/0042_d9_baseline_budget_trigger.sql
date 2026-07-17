-- D9: Enforce cost_codes.baseline_budget = SUM(baseline_budgets.amount)
--
-- Previously this was application-enforced: BaselineBudget.tsx wrote the
-- sum back to cost_codes after each mutation. That pattern can drift silently
-- if any write path is missed (imports, bulk edits, direct DB writes).
--
-- This trigger enforces the invariant at the DB layer: any INSERT, UPDATE,
-- or DELETE on baseline_budgets immediately recomputes the sum and writes it
-- back to the affected cost_code row(s). The application no longer needs to
-- call updateCostCode({ baselineBudget }) — it remains correct as a no-op.

create or replace function refresh_baseline_budget()
returns trigger
language plpgsql
as $$
declare
  affected_cost_code_id uuid;
begin
  -- Determine the affected cost_code_id (NEW for inserts/updates, OLD for deletes)
  if TG_OP = 'DELETE' then
    affected_cost_code_id := OLD.cost_code_id;
  else
    affected_cost_code_id := NEW.cost_code_id;
  end if;

  -- If cost_code_id changed on an UPDATE, recompute for the OLD code too
  if TG_OP = 'UPDATE' and OLD.cost_code_id <> NEW.cost_code_id then
    update cost_codes
    set baseline_budget = coalesce(
      (select sum(amount) from baseline_budgets where cost_code_id = OLD.cost_code_id),
      0
    )
    where id = OLD.cost_code_id;
  end if;

  update cost_codes
  set baseline_budget = coalesce(
    (select sum(amount) from baseline_budgets where cost_code_id = affected_cost_code_id),
    0
  )
  where id = affected_cost_code_id;

  return null;
end;
$$;

create trigger trg_refresh_baseline_budget
after insert or update or delete on baseline_budgets
for each row execute function refresh_baseline_budget();

-- Back-fill: recompute for any cost codes where stored sum may have drifted.
update cost_codes cc
set baseline_budget = coalesce(
  (select sum(amount) from baseline_budgets where cost_code_id = cc.id),
  0
);
