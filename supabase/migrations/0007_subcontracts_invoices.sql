-- Subcontracts, invoices, and vendors.
--
-- Resolves the "vendor-by-email RLS" open question from POSTGRES_MIGRATION_PLAN.md:
-- vendor_users stays as an email array (matching Subcontract.vendorUsers in the
-- current domain type exactly, not redesigned into a real membership table --
-- vendor contacts aren't necessarily platform users with Supabase Auth accounts).
-- RLS grants read-only access via auth.jwt()'s email claim matching that array.
-- This is an unusual RLS pattern worth the explicit comment, but it's the
-- faithful translation of the existing behavior, not a guess.
--
-- subcontracts.total_amount / forecast_changes are genuine mutable leaves here
-- (maintained transactionally by the app on line-item writes, per
-- LineItemsPanel.tsx), not "Formula sum of children" like the cost_codes/
-- risks/changes rollups -- kept as real columns, not excluded.

create table vendors (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references enterprises (id) on delete cascade,
  name text not null,
  code text,
  contact_email text,
  contact_name text,
  created_at timestamptz not null default now()
);

create table subcontracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  enterprise_id uuid not null references enterprises (id) on delete cascade,
  order_id text not null,
  order_name text not null,
  order_scope text,
  status text not null default 'Active' check (status in ('Active', 'Complete', 'On Hold')),
  default_cost_code_id uuid references cost_codes (id) on delete set null,
  default_phasing_source text check (default_phasing_source in ('Manual', 'Auto')),
  default_start_date date,
  default_end_date date,
  default_distribution text check (default_distribution in ('Even', 'Bell Curve', 'Front load', 'Back load', 'S-Curve', 'Profile')),
  payment_type text not null check (payment_type in ('LumpSum', 'Schedule of Rates', 'Re-measurable')),
  award_date date,
  vendor_id uuid not null references vendors (id) on delete restrict,
  vendor_users text[] not null default '{}', -- emails, see comment above
  total_amount numeric(14, 2) not null default 0,
  forecast_changes numeric(14, 2),
  enterprise_subcontract_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (project_id, order_id)
);

create table subcontract_line_items (
  id uuid primary key default gen_random_uuid(),
  subcontract_id uuid not null references subcontracts (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  item_no text not null,
  description text not null,
  activity_id text,
  cost_code_id uuid references cost_codes (id) on delete restrict,
  date date,
  qty numeric(14, 4) not null default 0,
  unit text,
  rate numeric(14, 4) not null default 0,
  total numeric(14, 2) not null default 0,
  type text not null default 'Original' check (type in ('Original', 'ChangeOrder')),
  status text not null default 'Pending' check (status in ('Approved', 'Pending', 'Forecast', 'Rejected')),
  start_date date,
  end_date date,
  phasing_source text check (phasing_source in ('Manual', 'Auto')),
  distribution text check (distribution in ('Even', 'Bell Curve', 'Front load', 'Back load', 'S-Curve', 'Profile')),
  period_values jsonb not null default '{}'::jsonb,
  enterprise_attributes jsonb not null default '{}'::jsonb,
  project_attributes jsonb not null default '{}'::jsonb,
  user_defined jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  subcontract_id uuid not null references subcontracts (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  enterprise_id uuid not null references enterprises (id) on delete cascade,
  invoice_id text not null,
  description text,
  submitted_date date,
  certified_date date,
  payment_date date,
  status text not null default 'Draft' check (status in ('Draft', 'Submitted', 'Certified', 'Rejected', 'Paid')),
  initiator text,
  vendor_id uuid not null references vendors (id) on delete restrict,
  total_amount numeric(14, 2) not null default 0,
  certified_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (subcontract_id, invoice_id)
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  subcontract_line_item_id uuid not null references subcontract_line_items (id) on delete restrict,
  item_no text not null,
  description text,
  qty numeric(14, 4) not null default 0,
  unit text,
  rate numeric(14, 4) not null default 0,
  total numeric(14, 2) not null default 0,
  type text check (type in ('Original', 'ChangeOrder')),
  claim_qty numeric(14, 4) not null default 0,
  claim_percent numeric(6, 4) not null default 0,
  claim_value numeric(14, 2) not null default 0,
  periodic_claim_qty numeric(14, 4),
  periodic_claim_percent numeric(6, 4),
  periodic_claim_value numeric(14, 2),
  certified_qty numeric(14, 4) not null default 0,
  certified_percent numeric(6, 4) not null default 0,
  certified_value numeric(14, 2) not null default 0,
  periodic_certified_qty numeric(14, 4),
  periodic_certified_percent numeric(6, 4),
  periodic_certified_value numeric(14, 2),
  commentary text
);

create index on vendors (enterprise_id);
create index on subcontracts (project_id);
create index on subcontracts (default_cost_code_id);
create index on subcontracts (vendor_id);
create index on subcontract_line_items (subcontract_id);
create index on subcontract_line_items (project_id);
create index on subcontract_line_items (cost_code_id);
create index on invoices (subcontract_id);
create index on invoices (project_id);
create index on invoices (vendor_id);
create index on invoice_items (invoice_id);
create index on invoice_items (subcontract_line_item_id);
-- created_by / enterprise_id indexes for both tables are added later in
-- 0011_final_index_fixes.sql (caught by the performance advisor after the
-- full schema was in place, not written here originally).

alter table vendors enable row level security;
alter table subcontracts enable row level security;
alter table subcontract_line_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;

create policy vendors_enterprise_access on vendors for all using (can_access_enterprise(enterprise_id));

-- One SELECT policy per table combining project-member access OR vendor-by-email
-- read access, plus separate write policies restricted to project members --
-- vendor reps get read-only access, matching firestore.rules today. Avoids the
-- "multiple permissive policies" overlap a separate for-all + for-select pair
-- would cause (see migration 0004's fix for the same issue on the core tables).

create policy subcontracts_select on subcontracts for select using (
  can_access_project(project_id) or (select auth.jwt() ->> 'email') = any (vendor_users)
);
create policy subcontracts_insert on subcontracts for insert with check (can_access_project(project_id));
create policy subcontracts_update on subcontracts for update using (can_access_project(project_id));
create policy subcontracts_delete on subcontracts for delete using (can_access_project(project_id));

create policy subcontract_line_items_select on subcontract_line_items for select using (
  can_access_project(project_id) or exists (
    select 1 from subcontracts s
    where s.id = subcontract_id and (select auth.jwt() ->> 'email') = any (s.vendor_users)
  )
);
create policy subcontract_line_items_insert on subcontract_line_items for insert with check (can_access_project(project_id));
create policy subcontract_line_items_update on subcontract_line_items for update using (can_access_project(project_id));
create policy subcontract_line_items_delete on subcontract_line_items for delete using (can_access_project(project_id));

create policy invoices_select on invoices for select using (
  can_access_project(project_id) or exists (
    select 1 from subcontracts s
    where s.id = subcontract_id and (select auth.jwt() ->> 'email') = any (s.vendor_users)
  )
);
create policy invoices_insert on invoices for insert with check (can_access_project(project_id));
create policy invoices_update on invoices for update using (can_access_project(project_id));
create policy invoices_delete on invoices for delete using (can_access_project(project_id));

-- NOTE: invoices.invoice_id (human-readable text id) and invoice_items.invoice_id
-- (uuid FK) share a name -- bare "invoice_id" inside a subquery over `invoices`
-- resolves to the wrong (text) column via scope shadowing. Every reference to
-- the outer invoice_items row's FK below is qualified as invoice_items.invoice_id
-- to avoid it, rather than renaming the column (matches the domain type's own
-- field name, InvoiceItem.subcontractLineItemId's sibling).
create policy invoice_items_select on invoice_items for select using (
  can_access_project((select project_id from invoices where id = invoice_items.invoice_id)) or exists (
    select 1 from invoices i join subcontracts s on s.id = i.subcontract_id
    where i.id = invoice_items.invoice_id and (select auth.jwt() ->> 'email') = any (s.vendor_users)
  )
);
create policy invoice_items_insert on invoice_items for insert with check (
  can_access_project((select project_id from invoices where id = invoice_items.invoice_id))
);
create policy invoice_items_update on invoice_items for update using (
  can_access_project((select project_id from invoices where id = invoice_items.invoice_id))
);
create policy invoice_items_delete on invoice_items for delete using (
  can_access_project((select project_id from invoices where id = invoice_items.invoice_id))
);
