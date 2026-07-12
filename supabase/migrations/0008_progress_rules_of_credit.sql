-- Progress tracking + Rules of Credit.
--
-- ProgressItem.periodValues / currentPeriodValues / actualPeriodValues /
-- ruleOfCreditProgress are all Record<periodId|stepId, number> maps in the
-- domain type -- kept as JSONB, same pattern as cost_phasing/etc_details.
--
-- RuleOfCredit.steps (embedded array) becomes its own child table,
-- rule_of_credit_steps, same normalization as subcontracts.lineItems ->
-- subcontract_line_items.
--
-- ProgressAttribute is a project-level custom-field *definition* (title,
-- type, dropdown values), not a data record -- modeled as its own table
-- rather than folded into project_attributes JSONB, since it has real
-- structure (a typed field with an options list) worth keeping queryable.

create table progress_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  package_id text not null,
  description text not null,
  rule_of_credit_id uuid,  -- FK added after rules_of_credit exists, see below
  unit text,
  attributes jsonb not null default '{}'::jsonb,
  default_start_date date,
  default_end_date date,
  default_phasing_method text check (default_phasing_method in ('Auto', 'Manual')),
  default_phasing_curve text check (default_phasing_curve in ('Scurve', 'Bell', 'front load', 'back load', 'even')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, package_id)
);

create table rules_of_credit (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  rule_id text not null,
  description text not null,
  package_id uuid references progress_packages (id) on delete set null,
  user_field_1 text,
  user_field_2 text,
  user_field_3 text,
  user_field_4 text,
  user_field_5 text,
  created_at timestamptz not null default now(),
  unique (project_id, rule_id)
);

alter table progress_packages add constraint progress_packages_rule_of_credit_id_fkey
  foreign key (rule_of_credit_id) references rules_of_credit (id) on delete set null;

create table rule_of_credit_steps (
  id uuid primary key default gen_random_uuid(),
  rule_of_credit_id uuid not null references rules_of_credit (id) on delete cascade,
  order_no numeric(6, 2) not null,
  description text not null,
  weight numeric(6, 2) not null
);

create table progress_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  package_id uuid not null references progress_packages (id) on delete cascade,
  item_id text not null,
  activity_id text,
  description text not null,
  cost_code_id uuid not null references cost_codes (id) on delete restrict,
  total_qty numeric(14, 4) not null default 0,
  total_qty_previous numeric(14, 4),
  earned_qty_previous numeric(14, 4),
  planned_start_date date,
  planned_end_date date,
  phasing_method text not null default 'Auto' check (phasing_method in ('Auto', 'Manual')),
  phasing_curve text not null default 'even' check (phasing_curve in ('Scurve', 'Bell', 'front load', 'back load', 'even')),
  project_attributes jsonb not null default '{}'::jsonb,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  rule_of_credit_id uuid references rules_of_credit (id) on delete set null,
  rule_of_credit_progress jsonb not null default '{}'::jsonb,
  period_values jsonb not null default '{}'::jsonb,
  current_start_date date,
  current_end_date date,
  current_phasing_method text check (current_phasing_method in ('Auto', 'Manual')),
  current_phasing_curve text check (current_phasing_curve in ('Scurve', 'Bell', 'front load', 'back load', 'even')),
  current_period_values jsonb not null default '{}'::jsonb,
  actual_period_values jsonb not null default '{}'::jsonb,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, item_id)
);

create table progress_reporting_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'Open' check (status in ('Open', 'Closed')),
  created_at timestamptz not null default now()
);

create table progress_attributes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  type text not null check (type in ('text', 'dropdown', 'date', 'number')),
  values jsonb not null default '[]'::jsonb  -- [{ id, description }] when type = 'dropdown'
);

create index on progress_packages (project_id);
create index on progress_packages (rule_of_credit_id);
create index on rules_of_credit (project_id);
create index on rules_of_credit (package_id);
create index on rule_of_credit_steps (rule_of_credit_id);
create index on progress_items (project_id);
create index on progress_items (package_id);
create index on progress_items (cost_code_id);
create index on progress_items (rule_of_credit_id);
create index on progress_reporting_periods (project_id);
create index on progress_attributes (project_id);

alter table progress_packages enable row level security;
alter table rules_of_credit enable row level security;
alter table rule_of_credit_steps enable row level security;
alter table progress_items enable row level security;
alter table progress_reporting_periods enable row level security;
alter table progress_attributes enable row level security;

create policy progress_packages_project_access on progress_packages for all using (can_access_project(project_id));
create policy rules_of_credit_project_access on rules_of_credit for all using (can_access_project(project_id));
create policy rule_of_credit_steps_project_access on rule_of_credit_steps for all using (
  can_access_project((select project_id from rules_of_credit where id = rule_of_credit_steps.rule_of_credit_id))
);
create policy progress_items_project_access on progress_items for all using (can_access_project(project_id));
create policy progress_reporting_periods_project_access on progress_reporting_periods for all using (can_access_project(project_id));
create policy progress_attributes_project_access on progress_attributes for all using (can_access_project(project_id));
