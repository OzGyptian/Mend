-- Full cross-check against the real Enterprise domain type after finding
-- the theme gap -- found many more missing columns. The *Attributes fields
-- are enterprise-level custom-field *definitions* (id/title/values[] each,
-- small and config-like, same pattern as progress_attributes.values) --
-- stored as JSONB rather than fully normalized into their own tables,
-- consistent with how period_values/stepData etc. were handled elsewhere.
-- enterpriseId (human-facing) renamed enterprise_code up front, following
-- migration 0012's naming-collision fix convention, rather than adding
-- another *_id landmine.
alter table enterprises add column enterprise_code text;
alter table enterprises add column logo_url text;
alter table enterprises add column project_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column line_item_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column cost_code_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column subcontract_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column change_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column risk_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column procurement_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column progress_attributes jsonb not null default '[]'::jsonb;
alter table enterprises add column change_types text[] not null default '{}';
alter table enterprises add column risk_types text[] not null default '{}';
alter table enterprises add column resource_rates jsonb not null default '[]'::jsonb;
alter table enterprises add column cost_elements jsonb not null default '[]'::jsonb;
alter table enterprises add column categories text[] not null default '{}';
alter table enterprises add column control_accounts text[] not null default '{}';
alter table enterprises add column order_numbers text[] not null default '{}';
