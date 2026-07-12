-- Risk and Change domains.
--
-- risks.exposure / minImpactTotal / mostLikelyImpactTotal / maxImpactTotal are
-- "Formula sum of children" per the domain types comments -- aggregates across
-- risk_records, made compute-on-read by Phase 13.B1 (F1). Excluded from the
-- table for the same single-source-of-truth reason as cost_codes.
--
-- risk_records.beta_pert_impact_amount goes further than the current app:
-- CLAUDE.md flags this exact field as a stored derived value that "must
-- recompute from leaf fields; never trust the stored value as authoritative"
-- -- existing tech debt, not yet enforced. Since the formula
-- ((min + 4*ml + max) / 6) * probability (confirmed against the real
-- betaPertExposure() implementation in domain/risk.ts, not just the type
-- comment, which omits the probability factor) only references columns on
-- the same row, Postgres can enforce it for real via a GENERATED column --
-- the value can never drift from its inputs, full stop.
--
-- changes.budget / eac are likewise "Formula sum of children" (compute-on-read
-- per the Phase 13.B1 change.ts fix) and excluded the same way.
--
-- Risk.mitigation / residualExposure are marked "Legacy, kept for
-- compatibility" in the type comments, but are still read/written by
-- RiskManagement.tsx and RiskFormDialog.tsx today -- kept as real columns,
-- not dropped, since "legacy" here means "old feature," not "unused."

create table risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  risk_id text not null,
  description text not null,
  type text,
  status text not null default 'Open' check (status in ('Open', 'Mitigated', 'Closed', 'Realized')),
  strategy text check (strategy in ('Avoid', 'Mitigate', 'Transfer', 'Accept')),
  initiator text,
  reference text,
  mitigation numeric(14, 2),
  residual_exposure numeric(14, 2),
  period_id text,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, risk_id)
);

create table risk_records (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references risks (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  cost_code_id uuid references cost_codes (id) on delete restrict,
  scope text,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  probability numeric(5, 4) not null check (probability >= 0 and probability <= 1),
  min_impact_amount numeric(14, 2) not null,
  most_likely_impact_amount numeric(14, 2) not null,
  max_impact_amount numeric(14, 2) not null,
  beta_pert_impact_amount numeric(14, 2) generated always as (
    round((((min_impact_amount + 4 * most_likely_impact_amount + max_impact_amount) / 6.0) * probability)::numeric, 2)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  change_id text not null,
  description text,
  status text,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, change_id)
);

create table change_records (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null references changes (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  cost_code_id uuid references cost_codes (id) on delete restrict,
  budget_amount numeric(14, 2) not null default 0,
  eac_amount numeric(14, 2) not null default 0,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on risks (project_id);
create index on risk_records (risk_id);
create index on risk_records (project_id);
create index on risk_records (cost_code_id);
create index on changes (project_id);
create index on change_records (change_id);
create index on change_records (project_id);
create index on change_records (cost_code_id);

alter table risks enable row level security;
alter table risk_records enable row level security;
alter table changes enable row level security;
alter table change_records enable row level security;

create policy risks_project_access on risks for all using (can_access_project(project_id));
create policy risk_records_project_access on risk_records for all using (can_access_project(project_id));
create policy changes_project_access on changes for all using (can_access_project(project_id));
create policy change_records_project_access on change_records for all using (can_access_project(project_id));
