-- Cost management domain: cost_codes, sheets, etc_details, actual_costs,
-- baseline_budgets, cost_phasing, period_snapshots.
--
-- This is the domain that motivated the whole migration: costCodeId
-- ambiguity (575 records, 2026-07-11/12 audit). Every FK below is a real
-- Postgres foreign key -- this class of bug becomes structurally
-- impossible instead of requiring an app-level audit script.
--
-- IMPORTANT: cost_codes deliberately does NOT store approvedBudget,
-- actualCostThisPeriod, actualCostToDate, estimateToComplete,
-- estimateAtCompletion, costVariance, or budgetChanges as columns.
-- Those were made compute-on-read from actual_costs/baseline_budgets/
-- change_records/risk_records by the Phase 13.B1 (F1) fix -- this schema
-- enforces that same single-source-of-truth rule at the DB layer by
-- simply not giving these fields a column to drift in. The domain layer
-- (src/domain/rollups.ts) computes them from the leaf tables below,
-- exactly as it already does against Firestore today.
--
-- The *Previous / *Movement fields ARE kept as columns: they're a
-- legitimate frozen-snapshot cache (this period's opening position,
-- refreshed only by the period-close action), matching current Firestore
-- behavior exactly -- not a data-layer migration's place to redesign that
-- feature.

create table cost_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  code text not null,
  name text not null,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  eac_method text not null default 'Auto',
  sort_order integer,
  activity_id text,
  planned_start_date date,
  planned_end_date date,
  baseline_budget numeric(14, 2) not null default 0,
  approved_budget_previous numeric(14, 2),
  approved_budget_movement numeric(14, 2),
  estimate_at_completion_previous numeric(14, 2),
  estimate_at_completion_movement numeric(14, 2),
  cost_variance_previous numeric(14, 2),
  cost_variance_movement numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

-- Cost codes can be restricted to specific users within a project (finer-grained
-- than plain project membership) -- mirrors CostCode.assignedUsers in Firestore.
create table cost_code_assigned_users (
  cost_code_id uuid not null references cost_codes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (cost_code_id, user_id)
);

create table sheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deliberately keyed by cost_code_id (real FK) even though the Firestore
-- source keys EtcDetail by the raw code string -- resolved during the ETL
-- transform pass, same as every other FK in this migration.
create table etc_details (
  id uuid primary key default gen_random_uuid(),
  cost_code_id uuid not null references cost_codes (id) on delete cascade,
  period_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table actual_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  cost_code_id uuid not null references cost_codes (id) on delete restrict,
  period text not null,
  amount numeric(14, 2) not null,
  description text,
  created_at timestamptz not null default now()
);

create table baseline_budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  cost_code_id uuid not null references cost_codes (id) on delete restrict,
  amount numeric(14, 2) not null,
  effective_date date,
  created_at timestamptz not null default now()
);

create table cost_phasing (
  id uuid primary key default gen_random_uuid(),
  cost_code_id uuid not null references cost_codes (id) on delete cascade,
  period_values jsonb not null default '{}'::jsonb,
  distribution_method text not null default 'Even',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Frozen historical snapshot -- legitimately stored, never recomputed, always
-- labelled with the period it was taken at. Never used to drive live UI outside
-- a history/audit view (see coding-style.md "Frozen snapshots" rule).
create table period_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  period text not null,
  snapshot_taken_at timestamptz not null default now(),
  cost_code_summaries jsonb not null,
  unique (project_id, period)
);

alter table cost_codes enable row level security;
alter table cost_code_assigned_users enable row level security;
alter table sheets enable row level security;
alter table etc_details enable row level security;
alter table actual_costs enable row level security;
alter table baseline_budgets enable row level security;
alter table cost_phasing enable row level security;
alter table period_snapshots enable row level security;

create policy cost_codes_project_access on cost_codes
  for all using (can_access_project(project_id));
create policy cost_code_assigned_users_project_access on cost_code_assigned_users
  for all using (can_access_project((select project_id from cost_codes where id = cost_code_id)));
create policy sheets_project_access on sheets
  for all using (can_access_project(project_id));
create policy etc_details_project_access on etc_details
  for all using (can_access_project((select project_id from cost_codes where id = cost_code_id)));
create policy actual_costs_project_access on actual_costs
  for all using (can_access_project(project_id));
create policy baseline_budgets_project_access on baseline_budgets
  for all using (can_access_project(project_id));
create policy cost_phasing_project_access on cost_phasing
  for all using (can_access_project((select project_id from cost_codes where id = cost_code_id)));
create policy period_snapshots_project_access on period_snapshots
  for all using (can_access_project(project_id));
