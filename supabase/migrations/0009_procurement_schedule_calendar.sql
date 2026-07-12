-- Procurement, schedule, and calendars.
--
-- ProcurementItem.stepData is Record<stepDefinitionId, ProcurementStepData>
-- (plannedDate/actualDate/forecastDate/planDuration/forecastDuration per
-- step) -- kept as JSONB, same pattern as the other dynamic per-key maps
-- in this schema, rather than a fully normalized procurement_item_steps
-- child table. Revisit if step-level querying/reporting becomes a real
-- need -- flagged here rather than silently decided.
--
-- ProcurementStepDefinition can be enterprise-level (isEnterpriseStandard,
-- no projectId) or project-level -- modeled as nullable project_id with a
-- separate enterprise_id, matching the domain type exactly rather than
-- forcing every step definition under a project.

create table procurement_step_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  enterprise_id uuid references enterprises (id) on delete cascade,
  name text not null,
  "order" integer not null,
  is_enterprise_standard boolean not null default false,
  default_duration_days integer,
  enterprise_step_id uuid references procurement_step_definitions (id) on delete set null,
  check (project_id is not null or enterprise_id is not null)
);

create table procurement_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  package_id text not null,
  description text not null,
  calendar_id uuid,  -- FK added after calendars exists, see below
  category text,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  step_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  activity_id text not null,
  description text not null,
  activity_percent_complete numeric(5, 2) not null default 0,
  baseline_start_date date,
  baseline_end_date date,
  planned_start_date date,
  planned_end_date date,
  current_start_date date,
  current_end_date date,
  updated_at timestamptz not null default now()
);

create table calendars (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  enterprise_id uuid references enterprises (id) on delete cascade,
  name text not null,
  weekends integer[] not null default '{}',
  holidays date[] not null default '{}',
  created_at timestamptz not null default now(),
  check (project_id is not null or enterprise_id is not null)
);

alter table procurement_items add constraint procurement_items_calendar_id_fkey
  foreign key (calendar_id) references calendars (id) on delete set null;

create table saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  table_id text not null,
  name text not null,
  columns text[] not null default '{}',
  grid_state jsonb,
  created_at timestamptz not null default now()
);

create index on procurement_step_definitions (project_id);
create index on procurement_step_definitions (enterprise_id);
create index on procurement_step_definitions (enterprise_step_id);
create index on procurement_items (project_id);
create index on procurement_items (calendar_id);
create index on schedule_items (project_id);
create index on calendars (project_id);
create index on calendars (enterprise_id);
create index on saved_views (user_id);

alter table procurement_step_definitions enable row level security;
alter table procurement_items enable row level security;
alter table schedule_items enable row level security;
alter table calendars enable row level security;
alter table saved_views enable row level security;

create policy procurement_step_definitions_access on procurement_step_definitions for all using (
  (project_id is not null and can_access_project(project_id))
  or (enterprise_id is not null and can_access_enterprise(enterprise_id))
);
create policy procurement_items_project_access on procurement_items for all using (can_access_project(project_id));
create policy schedule_items_project_access on schedule_items for all using (can_access_project(project_id));
create policy calendars_access on calendars for all using (
  (project_id is not null and can_access_project(project_id))
  or (enterprise_id is not null and can_access_enterprise(enterprise_id))
);
create policy saved_views_owner_access on saved_views for all using (user_id = (select auth.uid()));
