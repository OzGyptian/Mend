-- Firestore stores this as a subcollection (sheets/{sheetId}/rows) --
-- Postgres just needs a real FK, no nesting required. costCode here is a
-- free-text string typed within the spreadsheet-style Sheet feature, not a
-- FK to cost_codes (confirmed against the domain type -- no "Id" suffix,
-- no evidence it's resolved against the formal Cost Codes collection).
create table forecast_rows (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references sheets (id) on delete cascade,
  cost_code text,
  description text,
  vendor text,
  qty numeric(14, 4),
  rate numeric(14, 4),
  budget numeric(14, 2) not null default 0,
  committed_cost numeric(14, 2) not null default 0,
  actual_cost_to_date numeric(14, 2) not null default 0,
  cost_to_go numeric(14, 2) not null default 0,
  eac numeric(14, 2) not null default 0,
  start_date date,
  end_date date,
  time_phasing jsonb not null default '{}'::jsonb,
  distribution_method text not null default 'Even',
  enterprise_cost_code_attributes jsonb not null default '{}'::jsonb,
  enterprise_line_item_attributes jsonb not null default '{}'::jsonb,
  enterprise_subcontract_attributes jsonb not null default '{}'::jsonb,
  enterprise_change_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb
);

create index on forecast_rows (sheet_id);

alter table forecast_rows enable row level security;

create policy forecast_rows_access on forecast_rows for all using (
  can_access_project((select project_id from sheets where id = forecast_rows.sheet_id))
);
