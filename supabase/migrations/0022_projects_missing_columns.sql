-- Same pattern of gaps as enterprises -- migration 0001's projects table
-- only had project_code/name. Cross-checked against the full real Project
-- type before writing ProjectAdapter, rather than after hitting a tsc
-- error like the previous two times.
alter table projects rename column name to project_name;
alter table projects add column status text;
alter table projects add column project_budget numeric(14, 2) not null default 0;
alter table projects add column start_date date;
alter table projects add column end_date date;
alter table projects add column cutoff_date date;
alter table projects add column attributes jsonb not null default '{}'::jsonb;
alter table projects add column photo_url text;
alter table projects add column scope_description text;
alter table projects add column client_name text;
alter table projects add column project_manager_name text;
alter table projects add column created_by uuid references auth.users (id);
alter table projects add column created_by_email text;
alter table projects add column modified_by uuid references auth.users (id);
alter table projects add column modified_by_email text;
alter table projects add column categories text[] not null default '{}';
alter table projects add column control_accounts text[] not null default '{}';
alter table projects add column order_numbers text[] not null default '{}';
alter table projects add column cost_elements jsonb not null default '[]'::jsonb;
alter table projects add column cost_code_attributes jsonb not null default '[]'::jsonb;
alter table projects add column subcontract_attributes jsonb not null default '[]'::jsonb;
alter table projects add column change_attributes jsonb not null default '[]'::jsonb;
alter table projects add column risk_attributes jsonb not null default '[]'::jsonb;
alter table projects add column procurement_attributes jsonb not null default '[]'::jsonb;
alter table projects add column progress_attributes jsonb not null default '[]'::jsonb;
alter table projects add column procurement_defaults jsonb not null default '{}'::jsonb;
alter table projects add column change_types text[] not null default '{}';
alter table projects add column risk_types text[] not null default '{}';
alter table projects add column line_item_attributes jsonb not null default '[]'::jsonb;
alter table projects add column resource_rates jsonb not null default '[]'::jsonb;
alter table projects add column reporting_periods jsonb not null default '{}'::jsonb;
alter table projects add column progress_periods jsonb not null default '{}'::jsonb;
alter table projects add column first_cost_reporting_month text;
alter table projects add column current_reporting_month text;
alter table projects add column last_reporting_month text;
