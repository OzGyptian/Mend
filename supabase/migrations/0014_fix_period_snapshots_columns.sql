-- Caught while writing UtilityAdapter against the real PeriodSnapshot type:
-- the domain type has period_id + period_name + a costCodes array
-- (costCodeId, costCode, name, approvedBudget, actualCostToDate,
-- estimateToComplete, estimateAtCompletion, costVariance per entry) --
-- migration 0002 guessed a shape (period, snapshot_taken_at,
-- cost_code_summaries) that doesn't match.
alter table period_snapshots drop constraint period_snapshots_project_id_period_key;
alter table period_snapshots rename column period to period_id;
alter table period_snapshots add column period_name text not null default '';
alter table period_snapshots alter column period_name drop default;
alter table period_snapshots rename column cost_code_summaries to cost_codes;
alter table period_snapshots drop column snapshot_taken_at;
alter table period_snapshots add constraint period_snapshots_project_id_period_id_key unique (project_id, period_id);
