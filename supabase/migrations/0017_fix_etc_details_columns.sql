-- Caught while writing CostAdapter: migration 0002's etc_details table only
-- had cost_code_id + period_values -- missing most of the real EtcDetail
-- domain type, including project_id, which the Firestore adapter queries
-- directly (a top-level collection filter, not derived via a cost_code
-- join). Adding every real field now rather than patching around the gap.
alter table etc_details add column project_id uuid references projects (id) on delete cascade;
alter table etc_details add column cost_code text;
alter table etc_details add column calendar_id uuid references calendars (id) on delete set null;
alter table etc_details add column category text;
alter table etc_details add column item text;
alter table etc_details add column description text;
alter table etc_details add column order_number text;
alter table etc_details add column udf1 text;
alter table etc_details add column udf2 text;
alter table etc_details add column udf3 text;
alter table etc_details add column udf4 text;
alter table etc_details add column qty numeric(14, 4);
alter table etc_details add column unit text;
alter table etc_details add column rate numeric(14, 4);
alter table etc_details add column phasing_method text check (phasing_method in ('Manual', 'Auto-Phase'));
alter table etc_details add column phasing_start_date date;
alter table etc_details add column phasing_end_date date;
alter table etc_details add column activity_id text;
alter table etc_details add column phasing_unit text check (phasing_unit in ('Daily', 'Weekly', 'Monthly', 'Total', 'Profile'));
alter table etc_details add column phasing_qty numeric(14, 4);
alter table etc_details add column enterprise_attributes jsonb not null default '{}'::jsonb;
alter table etc_details add column project_attributes jsonb not null default '{}'::jsonb;
alter table etc_details add column sort_order integer;
alter table etc_details add column is_enterprise_resource boolean;
alter table etc_details add column resource_id text;
alter table etc_details add column total_etc_previous numeric(14, 2);

-- project_id needs a value before it can be not-null; leave it nullable
-- for now since this is still a schema-design pass, not a real data load --
-- flagged here rather than silently forcing a default that would be wrong.
create index on etc_details (project_id);
