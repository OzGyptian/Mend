# Mend — Data Structures Reference

> **Purpose:** This is the living foundation document for Mend's database. It explains what every table does, how they connect to each other, how those connections enable the application's business logic, and what structural changes have been made (or are planned).
>
> Keep this up to date when migrations change the schema.

---

## Contents

1. [Database Overview](#1-database-overview)
2. [The Core Hierarchy](#2-the-core-hierarchy)
3. [Domain Groups (table-by-table)](#3-domain-groups)
   - 3.1 Tenancy & Identity
   - 3.2 Cost Structure
   - 3.3 Forecasting
   - 3.4 Risk
   - 3.5 Changes
   - 3.6 Subcontracts & Invoicing
   - 3.7 Progress Measurement
   - 3.8 Procurement
   - 3.9 Infrastructure
   - 3.10 Audit & Personalisation
4. [Foreign Key Relationship Map](#4-foreign-key-relationship-map)
5. [Cross-Cutting Design Patterns](#5-cross-cutting-design-patterns)
6. [Access Control Model](#6-access-control-model)
7. [Schema History — What Has Changed](#7-schema-history--what-has-changed)
8. [Known Gaps & Planned Changes](#8-known-gaps--planned-changes)

---

## 1. Database Overview

Mend is a construction project cost-management tool. The database (Postgres on Supabase) holds 37 tables across two dimensions:

**Tenancy:** Every row ultimately belongs to an `enterprise` (a construction organisation). Within an enterprise, work is organised into `projects`. Row-Level Security (RLS) enforces this boundary — it is the only tenant wall; there is no separate backend API.

**Domain:** Within a project, data fans out across cost, forecast, risk, change, subcontracts, progress, procurement, and schedule domains. All domains share `cost_codes` as a common axis — the cost code is the fundamental unit of budget, actuals, forecast, and reporting.

---

## 2. The Core Hierarchy

```
PLATFORM
└── enterprises                     (tenant root)
    ├── projects                    (projects within the enterprise)
    │   └── cost_codes              (the core axis — everything links here)
    │       ├── actual_costs        → "what has been spent"
    │       ├── baseline_budgets    → "what was originally authorised"
    │       ├── cost_phasing        → "how budget/forecast distributes over time"
    │       ├── etc_details         → "bottom-up estimate to complete"
    │       ├── change_records      → "approved scope changes affecting this code"
    │       ├── risk_records        → "financial exposure via this code"
    │       ├── progress_items      → "physical progress measurement"
    │       └── subcontract_line_items → "contracted scope"
    ├── vendors                     (enterprise supplier registry)
    └── enterprise configuration    (attribute schemas, lookup lists)
```

The cost code is the spine of the entire data model. Every financial figure — actuals, budget, EAC, subcontract values, risk exposure, change impacts — rolls up through cost codes to the project level. If a cost code is deleted, Postgres CASCADE/RESTRICT rules ensure no orphaned financial data can exist.

---

## 3. Domain Groups

### 3.1 Tenancy & Identity

#### `enterprises`
The top-level tenant. One row per construction organisation.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Display name |
| `enterprise_code` | text? | Short code |
| `logo_url`, `theme` | text? | Branding |
| `project_attributes` | jsonb | Schema for custom project fields |
| `cost_code_attributes` | jsonb | Schema for custom cost-code fields |
| `line_item_attributes` | jsonb | Schema for custom ETC line-item fields |
| `subcontract_attributes` | jsonb | Schema for custom subcontract fields |
| `change_attributes` | jsonb | Schema for custom change fields |
| `risk_attributes` | jsonb | Schema for custom risk fields |
| `procurement_attributes` | jsonb | Schema for custom procurement fields |
| `progress_attributes` | jsonb | Schema for custom progress fields |
| `change_types`, `risk_types` | text[] | Lookup lists |
| `categories`, `control_accounts`, `order_numbers` | text[] | Classification lookup lists |
| `resource_rates`, `cost_elements` | jsonb | Rate cards and cost element definitions |

**Why it matters:** The enterprise is not just a tenant boundary — it is a configuration provider. Every `*_attributes` column defines a schema (list of field names and types) that child tables then store values for in their own `enterprise_attributes` jsonb. This is how Mend lets each enterprise have custom metadata without schema migrations.

#### `projects`
A construction project within an enterprise.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `enterprise_id` | uuid FK → enterprises CASCADE | |
| `project_code`, `project_name` | text | |
| `status` | text? | No CHECK constraint — gap D1 |
| `project_budget` | numeric | Total authorised budget |
| `start_date`, `end_date`, `cutoff_date` | date? | |
| `first_cost_reporting_month`, `current_reporting_month`, `last_reporting_month` | text? | Period keys (format: "2024-01") |
| `reporting_periods`, `progress_periods` | jsonb | Ordered period arrays |
| `attributes` | jsonb | Custom field values |
| `categories`, `control_accounts`, `order_numbers` | text[] | Project-level overrides of enterprise lists |
| `cost_elements`, `resource_rates` | jsonb | Project-level overrides |
| `*_attributes` (cost_code, subcontract, etc.) | jsonb | Project-level field schema overrides |
| `created_by`, `modified_by` | uuid? (auth.users) | Audit trail |

**Why it matters:** Projects carry their own period configuration (`current_reporting_month`) that drives all time-series queries. The project-level `*_attributes` columns override enterprise defaults for custom fields, giving per-project configuration flexibility.

#### `enterprise_members`
Relational join: which users belong to which enterprise, and at what role.

| Column | Type | Notes |
|--------|------|-------|
| `enterprise_id` | uuid FK → enterprises CASCADE | |
| `user_id` | uuid FK → auth.users CASCADE | |
| `role` | enterprise_member_role enum | `admin` or `member` |

**This is the RLS-authoritative source for enterprise access.** The RLS helper function `can_access_enterprise(ent_id)` reads this table. If a user is not in this table for an enterprise, they cannot see any of its data.

#### `project_members`
Relational join: which users have access to which projects.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `user_id` | uuid FK → auth.users CASCADE | |
| `role` | project_member_role enum | `admin`, `member`, or `viewer` |

**This is the RLS-authoritative source for project access.** The RLS helper `can_access_project(proj_id)` reads this table. Enterprise admins bypass it via `is_enterprise_admin()`.

> **Known issue:** Both `enterprise_members` and `project_members` are empty in the current seed. Access currently works because all test users are enterprise admins (via `user_profiles.platform_role = 'admin'` and `is_platform_admin()`). This gap (D2) needs fixing before the system can represent normal project members.

#### `user_profiles`
One row per authenticated user, created automatically on signup.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid PK FK → auth.users CASCADE | |
| `display_name` | text? | |
| `email` | text | |
| `platform_role` | platform_role enum | `admin` or `user` |

**`platform_role` here is the RLS-authoritative source for platform admin status.** The `is_platform_admin()` RLS helper reads this column. Only platform admins can see all enterprises.

#### `user_roles`
Legacy residue from the Firestore migration. **This table is dead.**

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → auth.users CASCADE | |
| `platform_role` | text? | Unconstrained — was `'platform_admin'` |
| `memberships` | jsonb | Was a Firestore-style membership blob |

The `user_roles` table was a Firestore-era residue. Wave 1.3 (complete) unified the platform-admin signal: `useAuth()` now reads `user_profiles.platform_role` via `UserRoleAdapter`, and the two hardcoded-email fallbacks in `hooks.ts` and `CostManagement.tsx` / `ProcurementManagementSubPane.tsx` were removed. The `user_roles` table still exists and is still written by the legacy write path (`setEnterpriseRole`, etc.), but is no longer read for the platform-admin signal. Full table removal is Wave 3.

#### `invitations`
Pending email invitations to join an enterprise.

| Column | Type | Notes |
|--------|------|-------|
| `enterprise_id` | uuid FK → enterprises CASCADE | |
| `invited_email` | text | |
| `role` | enterprise_member_role? | Role to grant on acceptance |
| `status` | text | `pending` / `accepted` |
| `token` | text | One-time accept token |
| `invited_by` | uuid? (auth.users) | |
| `accepted_at` | timestamptz? | |

On acceptance, the server endpoint (`POST /api/accept-invite`) creates an `enterprise_members` row and marks this `accepted`. The `token` is the trust anchor — it is not guessable.

---

### 3.2 Cost Structure

#### `cost_codes`
The central axis of the entire data model. Every cost code belongs to exactly one project.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `code`, `name` | text | |
| `eac_method` | text | How EAC is computed (free text — gap D1) |
| `baseline_budget` | numeric | Denormalised from baseline_budgets — gap D9 |
| `approved_budget_previous`, `approved_budget_movement` | numeric? | Period-over-period tracking |
| `estimate_at_completion_previous`, `estimate_at_completion_movement` | numeric? | |
| `cost_variance_previous`, `cost_variance_movement` | numeric? | |
| `enterprise_attributes`, `project_attributes` | jsonb | Custom field values |
| `activity_id` | text? | Link to schedule_items.activity_id |
| `planned_start_date`, `planned_end_date` | date? | |
| `sort_order` | numeric? | Display ordering |

**Why it matters:** Every financial domain table (actual_costs, baseline_budgets, cost_phasing, etc_details, change_records, risk_records, progress_items, subcontract_line_items) has a `cost_code_id` foreign key with ON DELETE RESTRICT. You cannot delete a cost code while any of these tables reference it — the cost code is the foundational record.

**Known issue (D9):** `baseline_budget` is stored directly on `cost_codes` as a derived value that duplicates `baseline_budgets`. This violates the single-source-of-truth rule.

#### `baseline_budgets`
The original authorised budget per cost code. Typically set once and not modified.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `cost_code_id` | uuid FK → cost_codes RESTRICT | |
| `amount` | numeric | |
| `effective_date` | date? | When this budget was authorised |

One row per cost code (in practice). Multiple rows would represent budget revisions over time — but that versioning pattern is not currently used.

#### `actual_costs`
Time-series record of money actually spent, keyed by period.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `cost_code_id` | uuid FK → cost_codes RESTRICT | |
| `period` | text | Period key, format "2024-01" |
| `amount` | numeric | |
| `description` | text? | |

One row per (cost_code, period). Accumulated actuals to date = SUM(amount) for periods ≤ current_reporting_month.

#### `cost_phasing`
How a cost code's budget or forecast is distributed across time periods.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `cost_code_id` | uuid FK → cost_codes CASCADE | |
| `distribution_method` | text | Distribution algorithm name — gap D1 |
| `period_values` | jsonb | `{ "2024-01": 12500.00, "2024-02": 12500.00, … }` |

**Why it matters:** This is the output of the phasing engine (`src/domain/phasing.ts`). When a cost code's budget or date range changes, phasing recalculates the period_values distribution. The time-phased budget drives the S-curve and period cost comparisons.

**Known issue (D1):** `distribution_method` is free text with at least two representations for even distribution: `"Even"` (258 rows) and `"even"` (1 row). If `calculatePhasing()` receives an unrecognised value, it silently defaults to even distribution — masking data drift.

---

### 3.3 Forecasting

#### `sheets`
A named forecast scenario or version for a project. Projects can have multiple sheets (e.g., "Base Case", "Risk Case", "Current Forecast").

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `sheet_name` | text | |
| `forecast_method` | text | How the sheet computes forecast — gap D1 |
| `version` | text | |
| `locked_status` | bool | Locked sheets are read-only |
| `users` | uuid[] | UIDs of users assigned to this sheet — live (written by SheetSettings) |
| `created_by` | uuid? (auth.users) | |

#### `forecast_rows`
Individual line items within a forecast sheet. Each row represents one discrete item of work or cost that contributes to the sheet's EAC.

| Column | Type | Notes |
|--------|------|-------|
| `sheet_id` | uuid FK → sheets CASCADE | |
| `cost_code` | text | Cost code identifier (denormalised text, not FK) |
| `description` | text? | |
| `vendor` | text? | |
| `qty`, `rate` | numeric? | For unit-rate items |
| `budget` | numeric | Authorised budget for this row |
| `committed_cost` | numeric | Subcontract/PO value |
| `actual_cost_to_date` | numeric | Actuals to date |
| `cost_to_go` | numeric | Remaining cost estimate |
| `eac` | numeric | budget + committed + cost_to_go (or method-specific) |
| `start_date`, `end_date` | date? | |
| `time_phasing` | jsonb | Period-by-period distribution of this row |
| `distribution_method` | text | Gap D1 — same enum drift issue as cost_phasing |
| `enterprise_*_attributes`, `project_attributes` | jsonb | Custom field values |

**Note:** `forecast_rows.cost_code` is a text copy, not a FK. This is intentional for snapshot/versioning flexibility but means no referential integrity between sheets and cost_codes.

#### `etc_details`
Bottom-up Estimate To Complete. Each row is a detailed resource or cost item that feeds into a cost code's ETC.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `cost_code_id` | uuid FK → cost_codes CASCADE | |
| `calendar_id` | uuid? FK → calendars SET NULL | For date calculations |
| `category`, `item`, `description`, `order_number` | text? | Classification |
| `udf1`–`udf4` | text? | User-defined fields |
| `qty`, `unit`, `rate` | numeric/text? | Unit-rate calculation |
| `phasing_method` | text? | Gap D1 |
| `phasing_start_date`, `phasing_end_date` | date? | |
| `phasing_unit`, `phasing_qty` | text/numeric? | |
| `period_values` | jsonb | Time-phased ETC distribution |
| `is_enterprise_resource` | bool? | Whether pulled from enterprise rate card |
| `resource_id` | text? | Link to enterprise resource_rates |
| `enterprise_attributes`, `project_attributes` | jsonb | Custom field values |
| `total_etc_previous` | numeric? | Prior period snapshot |

**Why it matters:** ETC Details is the bottom-up build of the cost-to-complete. The sum of all etc_details for a cost code gives the ETC for that code. Combined with actual_costs to date, this drives the EAC calculation.

---

### 3.4 Risk

#### `risks`
Risk register header. One risk = one identifiable threat or opportunity.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `risk_code` | text | |
| `description` | text | |
| `type` | text? | Risk category (from enterprise risk_types list) |
| `status` | text | Active/Closed/etc — no CHECK constraint |
| `strategy` | text? | Mitigation approach |
| `initiator`, `reference`, `mitigation`, `residual_exposure` | text? | |
| `period_id` | text? | The reporting period this risk is assessed in |
| `enterprise_attributes`, `project_attributes` | jsonb | Custom field values |

#### `risk_records`
Financial exposure records for a risk. A risk can have multiple records (e.g., one per impacted cost code, or one per scenario).

| Column | Type | Notes |
|--------|------|-------|
| `risk_id` | uuid FK → risks CASCADE | |
| `project_id` | uuid FK → projects CASCADE | |
| `cost_code_id` | uuid? FK → cost_codes RESTRICT | Optional cost code link |
| `scope` | text? | Description of this exposure |
| `probability` | numeric | 0–1 |
| `risk_model` | text | Which financial model to apply |
| `model_inputs` | jsonb | Model-specific inputs |
| `enterprise_attributes`, `project_attributes` | jsonb | Custom field values |

**Schema change (migration 0037):** The previous schema had hardcoded columns `min_impact_amount`, `most_likely_impact_amount`, `max_impact_amount`, and a generated column `beta_pert_impact_amount = (min + 4×ml + max) / 6`. These were dropped and replaced with `risk_model` (text) + `model_inputs` (jsonb). This allows any quantification model (Beta-PERT, Fixed, Percentage, Three-Point) without future schema changes. The Beta-PERT formula now lives exclusively in `src/domain/risk.ts`.

---

### 3.5 Changes

#### `changes`
A change event (variation, scope change, instruction). The header record.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `change_code` | text? | |
| `description` | text? | |
| `status` | text? | Pending/Approved/Rejected — no CHECK |
| `enterprise_attributes`, `project_attributes` | jsonb | |

#### `change_records`
Financial impact lines within a change. A single change can affect multiple cost codes.

| Column | Type | Notes |
|--------|------|-------|
| `change_id` | uuid FK → changes CASCADE | |
| `project_id` | uuid FK → projects CASCADE | |
| `cost_code_id` | uuid? FK → cost_codes RESTRICT | Optional — change might not map to a code yet |
| `budget_amount` | numeric | Budget impact |
| `eac_amount` | numeric | EAC impact |
| `enterprise_attributes`, `project_attributes` | jsonb | |

**Why they matter:** Approved changes flow into the cost code's `approved_budget_movement` and `estimate_at_completion_movement` columns, updating the live forecast without altering the baseline.

---

### 3.6 Subcontracts & Invoicing

#### `vendors`
Enterprise-level supplier/contractor registry.

| Column | Type | Notes |
|--------|------|-------|
| `enterprise_id` | uuid FK → enterprises CASCADE | |
| `name` | text | |
| `code`, `contact_email`, `contact_name` | text? | |

Vendors are shared across all projects within an enterprise. A vendor cannot be deleted if any subcontract or invoice references them (RESTRICT).

#### `subcontracts`
A contract awarded to a vendor to perform a scope of work.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `enterprise_id` | uuid FK → enterprises CASCADE | |
| `vendor_id` | uuid FK → vendors RESTRICT | |
| `order_code`, `order_name` | text | |
| `order_scope` | text? | |
| `status` | text | No CHECK |
| `payment_type` | text | Lump sum / Unit rate / Cost plus — gap D1 |
| `total_amount` | numeric | |
| `default_cost_code_id` | uuid? FK → cost_codes SET NULL | |
| `default_distribution`, `default_phasing_source` | text? | |
| `default_start_date`, `default_end_date` | date? | |
| `forecast_changes` | numeric? | Forecast-only change allowance |
| `vendor_users` | text[] | Vendor email list — live; used in RLS to grant vendor access to their subcontracts/invoices |
| `enterprise_subcontract_attributes`, `project_attributes` | jsonb | |

#### `subcontract_line_items`
The scheduled items (deliverables) within a subcontract. These define what work has been contracted and at what rate.

| Column | Type | Notes |
|--------|------|-------|
| `subcontract_id` | uuid FK → subcontracts CASCADE | |
| `project_id` | uuid FK → projects CASCADE | |
| `cost_code_id` | uuid? FK → cost_codes RESTRICT | |
| `item_no` | text | |
| `description` | text | |
| `qty`, `unit`, `rate`, `total` | numeric/text | |
| `type` | text | Line item type — gap D1 |
| `status` | text | No CHECK |
| `distribution` | text? | Phasing distribution — gap D1 |
| `period_values` | jsonb | Time-phased committed values |
| `enterprise_attributes`, `project_attributes`, `user_defined` | jsonb | |

#### `invoices`
A payment claim from a vendor against a subcontract.

| Column | Type | Notes |
|--------|------|-------|
| `subcontract_id` | uuid FK → subcontracts CASCADE | |
| `project_id` | uuid FK → projects CASCADE | |
| `enterprise_id` | uuid FK → enterprises CASCADE | |
| `vendor_id` | uuid FK → vendors RESTRICT | |
| `invoice_code` | text | |
| `status` | text | No CHECK |
| `submitted_date`, `certified_date`, `payment_date` | date? | |
| `total_amount`, `certified_amount` | numeric | |

#### `invoice_items`
Individual schedule-of-rates claims within an invoice.

| Column | Type | Notes |
|--------|------|-------|
| `invoice_id` | uuid FK → invoices CASCADE | |
| `subcontract_line_item_id` | uuid FK → subcontract_line_items RESTRICT | |
| `claim_qty`, `claim_percent`, `claim_value` | numeric | What was claimed |
| `certified_qty`, `certified_percent`, `certified_value` | numeric | What was certified |
| `periodic_claim_*`, `periodic_certified_*` | numeric? | This-period values |
| `type` | text? | |

**Why the chain matters:** invoices → invoice_items → subcontract_line_items → subcontracts → vendor. The `RESTRICT` on `subcontract_line_item_id` means you cannot delete a schedule item if invoices have been raised against it.

---

### 3.7 Progress Measurement

Progress tracks physical completion of work, independent of cost. It is measured at the `progress_item` level and reported against `progress_packages`.

#### `progress_packages`
A grouping container for measurable work items. Usually aligns with a contract or discipline.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `package_code`, `description` | text | |
| `rule_of_credit_id` | uuid? FK → rules_of_credit SET NULL | Default rule for items in this package |
| `default_phasing_method`, `default_phasing_curve` | text? | |
| `default_start_date`, `default_end_date` | date? | |
| `attributes` | jsonb | |

#### `progress_items`
A single measurable scope item. The leaf-level progress record.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `package_id` | uuid FK → progress_packages CASCADE | |
| `cost_code_id` | uuid FK → cost_codes RESTRICT | Links progress to cost |
| `rule_of_credit_id` | uuid? FK → rules_of_credit SET NULL | How progress is credited |
| `item_code`, `description` | text | |
| `total_qty` | numeric | Total quantity to be completed |
| `phasing_method`, `phasing_curve` | text | Planned progress curve — gap D1 |
| `period_values` | jsonb | Planned progress per period |
| `current_phasing_method`, `current_phasing_curve` | text? | Revised plan |
| `current_period_values` | jsonb | Revised plan per period |
| `actual_period_values` | jsonb | Actual progress recorded per period |
| `rule_of_credit_progress` | jsonb | Step completion state |
| `planned_start_date`, `planned_end_date` | date? | |
| `current_start_date`, `current_end_date` | date? | |
| `enterprise_attributes`, `project_attributes` | jsonb | |

**Why it matters:** The link `progress_items.cost_code_id → cost_codes` is what enables Earned Value Management. When you know planned progress, actual progress, and budgeted cost, you can compute BCWP (Earned Value), BCWS (Planned Value), and ACWP (Actual Cost) for each cost code.

#### `rules_of_credit`
A progress-crediting rule. Defines the method by which work is credited (e.g., 0/100, milestones, steps).

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `package_id` | uuid? FK → progress_packages SET NULL | Optional link back to package |
| `rule_code`, `description` | text | |
| `user_field1`–`user_field5` | text? | Configurable labels |

#### `rule_of_credit_steps`
Individual steps within a weighted rule of credit.

| Column | Type | Notes |
|--------|------|-------|
| `rule_of_credit_id` | uuid FK → rules_of_credit CASCADE | |
| `order_no`, `weight` | numeric | |
| `description` | text | |

**Note:** There is a circular FK between `rules_of_credit` and `progress_packages` (`rules_of_credit.package_id → progress_packages` and `progress_packages.rule_of_credit_id → rules_of_credit`). Both sides are nullable (SET NULL), which prevents deletion loops.

#### `progress_reporting_periods`
Defines the reporting timeline for progress measurement.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `period_name` | text | |
| `start_date`, `end_date` | date | |
| `status` | text | Open/Closed — no CHECK |

#### `progress_attributes`
Project-level custom attribute definitions for the progress domain.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `title` | text | Attribute name |
| `type` | text | Data type (text, number, etc.) |
| `values` | jsonb | Allowed values / options |

---

### 3.8 Procurement

#### `procurement_items`
Items being procured. Each item tracks its position through a configurable set of procurement steps.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `package_id` | text? | Informal grouping (not a FK — gap D4) |
| `calendar_id` | uuid? FK → calendars SET NULL | For date calculations |
| `description` | text | |
| `category` | text? | |
| `step_data` | jsonb | Per-step dates, durations, status |
| `enterprise_attributes`, `project_attributes` | jsonb | |

#### `procurement_step_definitions`
Defines the steps in a procurement workflow. Can be enterprise-standard or project-specific.

| Column | Type | Notes |
|--------|------|-------|
| `enterprise_id` | uuid? FK → enterprises CASCADE | Set for enterprise-standard steps |
| `project_id` | uuid? FK → projects CASCADE | Set for project-specific steps |
| `enterprise_step_id` | uuid? FK → self SET NULL | Links a project step to its enterprise template |
| `name` | text | Step name (e.g., "Issue ITT", "Receive Tenders") |
| `order` | numeric | Display/execution order |
| `is_enterprise_standard` | bool | Whether this is a template step |
| `default_duration_days` | numeric? | Default working-day duration |

**Why it matters:** `procurement_items.step_data` stores the actual dates and state for each step as a jsonb blob rather than normalised rows. This keeps queries simple but means the step schema isn't enforced by the DB. The step definitions drive the procurement Gantt view.

---

### 3.9 Infrastructure

#### `calendars`
Working day calendars defining non-working days (weekends and public holidays). Used in procurement date calculations and ETC phasing.

| Column | Type | Notes |
|--------|------|-------|
| `enterprise_id` | uuid? FK → enterprises CASCADE | Enterprise-level calendar |
| `project_id` | uuid? FK → projects CASCADE | Project-level override |
| `name` | text | |
| `weekends` | int4[] | Day-of-week numbers for weekend days |
| `holidays` | date[] | Specific non-working dates |

Either `enterprise_id` or `project_id` is set (not both) — but this is not enforced by a CHECK constraint (gap D9).

#### `schedule_items`
Schedule/programme activities with baseline, planned, and current date ranges and percent complete.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `activity_id` | text | Links to cost_codes.activity_id |
| `description` | text | |
| `activity_percent_complete` | numeric | |
| `baseline_start_date`, `baseline_end_date` | date? | |
| `planned_start_date`, `planned_end_date` | date? | |
| `current_start_date`, `current_end_date` | date? | |

**Link to cost codes:** `schedule_items.activity_id` and `cost_codes.activity_id` share the same value. This is a logical link enforced by application code, not a FK. The schedule drives date inputs into the phasing engine.

#### `period_snapshots`
Immutable historical snapshots of all cost code values at the end of a reporting period.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | uuid FK → projects CASCADE | |
| `period_id` | text | Period key "2024-01" |
| `period_name` | text | Display name |
| `cost_codes` | jsonb | Full snapshot of all cost code financial values at close |

**These are historical records only.** They must never be used to drive live UI. They power the "movement" columns (e.g., `approved_budget_movement = current − snapshot`) and historical trend views. Any UI that shows period_snapshot data must label it with the period date.

---

### 3.10 Audit & Personalisation

#### `audit_logs`
Append-only action log. Writes via `src/lib/audit.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `enterprise_id` | uuid FK → enterprises CASCADE | |
| `project_id` | uuid? FK → projects CASCADE | |
| `actor_user_id` | uuid? (auth.users) | |
| `actor_email` | text? | |
| `action` | text | e.g., "cost_code.updated" |
| `details` | jsonb | Before/after values |

**Known limitation:** `actor_user_id` and `actor_email` are client-asserted (sent from the browser). A malicious client could impersonate another user in the audit log. Wave 3 will harden this by computing the actor server-side via Supabase Edge Functions.

#### `cost_code_assigned_users`
Maps users to cost codes for responsibility tracking (who owns what cost code).

| Column | Type | Notes |
|--------|------|-------|
| `cost_code_id` | uuid FK → cost_codes CASCADE | |
| `user_id` | uuid (auth.users) CASCADE | |

#### `saved_views`
Persists a user's AG Grid column visibility and filter state per table.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → auth.users CASCADE | |
| `table_id` | text | Which grid/table this view applies to |
| `name` | text | User-given name |
| `columns` | text[] | Visible columns |
| `grid_state` | jsonb | Full AG Grid column state |

---

## 4. Foreign Key Relationship Map

All FK relationships, showing delete behaviour:

```
enterprises
  ├─[CASCADE]──> projects
  │              ├─[CASCADE]──> cost_codes
  │              │              ├─[RESTRICT]──> actual_costs
  │              │              ├─[RESTRICT]──> baseline_budgets
  │              │              ├─[CASCADE]───> cost_phasing
  │              │              ├─[CASCADE]───> etc_details
  │              │              ├─[RESTRICT]──> change_records
  │              │              ├─[RESTRICT]──> risk_records
  │              │              ├─[RESTRICT]──> progress_items
  │              │              ├─[RESTRICT]──> subcontract_line_items
  │              │              ├─[SET NULL]──> subcontracts.default_cost_code_id
  │              │              └─[CASCADE]───> cost_code_assigned_users
  │              ├─[CASCADE]──> changes
  │              │              └─[CASCADE]───> change_records
  │              ├─[CASCADE]──> risks
  │              │              └─[CASCADE]───> risk_records
  │              ├─[CASCADE]──> progress_packages
  │              │              └─[CASCADE]───> progress_items
  │              ├─[CASCADE]──> rules_of_credit
  │              │              ├─[CASCADE]───> rule_of_credit_steps
  │              │              ├─[SET NULL]──> progress_packages.rule_of_credit_id
  │              │              └─[SET NULL]──> progress_items.rule_of_credit_id
  │              ├─[CASCADE]──> sheets
  │              │              └─[CASCADE]───> forecast_rows
  │              ├─[CASCADE]──> schedule_items
  │              ├─[CASCADE]──> period_snapshots
  │              ├─[CASCADE]──> progress_reporting_periods
  │              ├─[CASCADE]──> progress_attributes
  │              ├─[CASCADE]──> procurement_items
  │              ├─[CASCADE]──> procurement_step_definitions
  │              └─[CASCADE]──> calendars (project_id nullable)
  │
  ├─[CASCADE]──> enterprise_members
  ├─[CASCADE]──> invitations
  ├─[CASCADE]──> audit_logs
  ├─[CASCADE]──> procurement_step_definitions (enterprise_id nullable)
  ├─[CASCADE]──> calendars (enterprise_id nullable)
  ├─[CASCADE]──> subcontracts (enterprise_id)
  └─[CASCADE]──> vendors
                 ├─[RESTRICT]──> subcontracts.vendor_id
                 └─[RESTRICT]──> invoices.vendor_id

subcontracts
  ├─[CASCADE]──> subcontract_line_items
  │              └─[RESTRICT]──> invoice_items.subcontract_line_item_id
  └─[CASCADE]──> invoices
                 └─[CASCADE]───> invoice_items

calendars
  ├─[SET NULL]──> etc_details.calendar_id
  └─[SET NULL]──> procurement_items.calendar_id

rules_of_credit ←─[SET NULL]─> progress_packages  (bidirectional nullable)

auth.users (Supabase managed)
  ├─[CASCADE]──> user_profiles
  ├─[CASCADE]──> user_roles
  ├─[CASCADE]──> enterprise_members
  ├─[CASCADE]──> project_members
  ├─[CASCADE]──> cost_code_assigned_users
  └─[CASCADE]──> saved_views
```

**Delete behaviour summary:**
- Deleting an **enterprise** cascades to everything below it
- Deleting a **project** cascades to all project-level data
- Deleting a **cost code** is BLOCKED if any financial record references it — you must re-assign or delete those records first
- Deleting a **vendor** is BLOCKED if any subcontract or invoice references them
- Deleting a **subcontract line item** is BLOCKED if invoices have been raised against it

---

## 5. Cross-Cutting Design Patterns

### 5.1 The Enterprise Attributes Pattern

Rather than hard-coding custom fields in the schema, Mend uses a two-layer configuration pattern:

1. **Schema layer** (`enterprises.*_attributes`): The enterprise defines what custom fields exist. Example:
   ```json
   { "cost_code_attributes": [
     { "name": "control_account", "type": "text" },
     { "name": "discipline",      "type": "select", "options": ["Civil", "Mechanical"] }
   ] }
   ```

2. **Value layer** (each row's `enterprise_attributes`, `project_attributes`): The row stores the actual values:
   ```json
   { "enterprise_attributes": { "control_account": "CA-001", "discipline": "Civil" } }
   ```

Projects can further override the schema (via `projects.*_attributes`), and rows store project-specific values in their `project_attributes` column.

This pattern enables enterprise customisation without schema migrations. The downside is that the DB cannot enforce attribute values — validation is application-side only.

### 5.2 The Period Values Pattern

Time-series data throughout Mend is stored as jsonb maps keyed by period strings:

```json
{ "2024-01": 12500.00, "2024-02": 18750.00, "2024-03": 21000.00 }
```

Tables using this pattern: `cost_phasing.period_values`, `etc_details.period_values`, `forecast_rows.time_phasing`, `subcontract_line_items.period_values`, `progress_items.period_values` / `current_period_values` / `actual_period_values`.

This avoids a normalised time-series table (which would require a row per code per period — hundreds of thousands of rows) while still allowing period-level querying via jsonb operators.

### 5.3 The Phasing Engine

`cost_phasing` and several other tables store `distribution_method` which drives how costs are distributed over time. The canonical computation lives in `src/domain/phasing.ts`. Supported methods:

- **Even** — equal distribution across all periods
- **Bell** — normal distribution (more in middle)
- **Front-loaded** / **Back-loaded** — weighted early/late
- **S-Curve** — slow start, fast middle, slow end
- **Profile** — manually specified weights

**Known gap (D1):** `distribution_method` is an unconstrained text column. Live data contains both `"Even"` and `"even"`. If `calculatePhasing()` doesn't recognise the value, it silently falls back to even distribution without raising an error.

### 5.4 The EAC Calculation

Estimate At Completion (EAC) for a cost code = Actuals To Date + ETC.

The `eac_method` on `cost_codes` controls how ETC is derived:
- **Bottom-up**: sum of `etc_details` rows for this code
- **Forecast**: driven by the active forecast sheet
- **Manual**: directly entered

This is enforced by application logic, not DB constraints. The `eac_method` column is free text (gap D1).

---

## 6. Access Control Model

The RLS system uses a set of SECURITY DEFINER helper functions that run with elevated privileges:

| Function | What it checks |
|----------|---------------|
| `is_platform_admin()` | `user_profiles.platform_role = 'admin'` |
| `is_enterprise_admin(ent_id)` | `enterprise_members.role = 'admin'` for this enterprise |
| `is_project_admin(proj_id)` | `project_members.role = 'admin'` for this project |
| `can_access_enterprise(ent_id)` | member of enterprise OR enterprise admin OR platform admin |
| `can_access_project(proj_id)` | member of project OR enterprise admin OR platform admin |

**Access hierarchy:**

```
Platform Admin  → sees everything (all enterprises, all projects)
Enterprise Admin → sees their enterprise + all its projects
Project Admin   → sees their project only
Project Member  → sees their project only (read/write)
Project Viewer  → sees their project only (read only, where policies differ)
```

**Current state of membership tables:**
- `enterprise_members`: populated (test users are enterprise admins)
- `project_members`: **empty** — all project access currently goes through enterprise admin bypass
- `user_roles`: populated but dead — `memberships` jsonb is a Firestore residue

### The Platform Admin Inconsistency (Gap D3 / F3)

There are two separate signals for platform admin status:

| Signal | Where stored | Used by |
|--------|-------------|---------|
| `user_profiles.platform_role = 'admin'` | Postgres enum | RLS helper `is_platform_admin()` — DB-enforced |
| ~~`user_roles.platform_role = 'platform_admin'`~~ | ~~Unconstrained text~~ | ~~`useAuth()` → `isPlatformAdmin` — frontend only~~ |

**Wave 1.3 complete.** `useAuth()` now reads `user_profiles.platform_role` only; `user_roles` is no longer queried for the platform-admin signal. Hardcoded email fallbacks removed.

---

## 7. Schema History — What Has Changed

### Migration 0001–0030: Firestore → Postgres Migration

The original Mend app used Firebase/Firestore. The migration extracted all data into Postgres and established the relational schema. Key decisions made during migration:

- **Flat Firestore collections → FK-linked tables**: e.g., Firestore had `invoices` as a top-level collection with embedded `vendor` info; Postgres has `vendors` as a separate table with `invoices.vendor_id → vendors.id`
- **jsonb for flexible fields**: `enterprise_attributes`, `project_attributes`, `period_values` and similar columns preserve the flexible-schema nature of Firestore documents while living in a relational DB
- **Dead columns retained**: `user_roles.memberships` (Firestore membership blob), `sheets.users` (Firestore user array), `subcontracts.vendor_users` (Firestore string array) — these exist in the DB but are no longer read or written

### Migration 0031–0036: Platform Seam Refactor

Introduction of the ports-and-adapters architecture. No schema changes — these were application-layer changes (removing Firebase imports, introducing adapter interfaces, adding `enterprise_members` / `project_members` / `user_profiles` / `user_roles`).

### Migration 0037: Risk Model Flexibility

**Problem:** The previous risk schema had three hardcoded Beta-PERT columns (`min_impact_amount`, `most_likely_impact_amount`, `max_impact_amount`) plus a generated column (`beta_pert_impact_amount = (min + 4×ml + max) / 6`). This prevented using any other quantification model.

**Change:** Dropped the four hardcoded columns and added:
- `risk_records.risk_model text NOT NULL` — which model to apply (e.g., `'beta_pert'`, `'fixed'`, `'percentage'`)
- `risk_records.model_inputs jsonb NOT NULL` — model-specific inputs (e.g., `{ min, ml, max }` for Beta-PERT, `{ amount }` for fixed)

**Impact:** The Beta-PERT formula now lives exclusively in `src/domain/risk.ts`. The DB no longer computes it. Any code reading the old columns broke (this caused the P3-0 live production incident — fixed in PR #10).

---

## 8. Known Gaps & Planned Changes

These are the structural weaknesses identified during the system audit (see `docs/audit/phase-5-report.md`).

### Wave 1 — Safe, Non-Breaking

| Gap | Tables Affected | Status |
|-----|----------------|--------|
| **D1: Free-text enums** | `cost_phasing.distribution_method`, `cost_codes.eac_method`, `subcontracts.payment_type`, `subcontract_line_items.type`, `invoice_items.type`, `projects.status`, `risks.status`, `changes.status` | ✅ **Done** — migration 0038: case drift normalised, CHECK constraints added. Progress/ETC phasing CHECKs already existed from migrations 0008 and 0017. |
| **D3/F3: Dual admin signal** | `user_roles`, `user_profiles` | ✅ **Done** — `UserRoleAdapter` reads `user_profiles.platform_role`; hardcoded email fallbacks removed from `hooks.ts`, `CostManagement.tsx`, `ProcurementManagementSubPane.tsx`. `user_roles` still written (Wave 3 cleanup). |
| **A1: Real ESLint** | App-wide | ✅ **Done** — `eslint-plugin-react-hooks` enabled; Rules of Hooks violations in `SubcontractsCellRenderers.tsx` fixed. |
| **Process: Migration safety** | All migrations | 🔲 See rule below |

### Wave 2 — Requires Hierarchy Decision

| Gap | Tables Affected | Change |
|-----|----------------|--------|
| **F1: Cross-tenant FK references** | `risk_records`, `change_records`, `progress_items`, `subcontract_line_items` | Add composite FK (`project_id`, `cost_code_id`) to enforce that a cost code must belong to the same project as the referencing record. **Blocked on cost code ownership decision (enterprise vs project scope)** |
| **D10: Null-means-inherit** | `projects` (14 settings columns) | ✅ **Done** — migrations 0039/0040: 7 enum columns nullable (null=inherit from enterprise), 7 attribute columns nullable (null=no project-specific attrs, additive model). `resolveProjectSettings()` in `src/domain/settings.ts` applies COALESCE for enum fields only. `ProjectAdapter` fetches enterprise settings and applies resolution on every read. |

### Wave 3 — Hygiene

| Gap | Tables Affected | Change |
|-----|----------------|--------|
| **D2: Dead representations** | `user_roles.memberships` | ✅ **Done** — migration 0041 drops column; Supabase UserRoleAdapter now writes to `enterprise_members`/`project_members` directly. |
| **D9: Stored derived value** | `cost_codes.baseline_budget` | ✅ **Done** — migration 0042 adds AFTER INSERT/UPDATE/DELETE trigger on `baseline_budgets`; back-fill applied. |
| **A3: EAC formula duplication** | `ForecastGrid.tsx`, `ProjectDashboard.tsx` | ✅ **Done** — `computeForecastRowEac()` extracted to `src/domain/eac.ts`; both components call canonical function. |
| **Calendars XOR CHECK** | `calendars` | ✅ **Done** — migration 0043 adds CHECK constraint enforcing exactly one of enterprise_id/project_id is set. |
| **Audit log hardening** | `audit_logs` | ✅ **Done** — migration 0045 adds BEFORE INSERT trigger that overwrites actor_user_id/actor_email from auth.uid(); service-role inserts pass through. |
| **D4: procurement_items.package_id** | `procurement_items` | ✅ **Done** — migration 0044 drops the dead text column (no code read it; progress_items.package_id is a separate concept with a real FK). |

---

*Last updated: 2026-07-17. Wave 1–3 complete except F1 (blocked on cost code ownership decision). All hygiene items done: D2, D4, D9, D10, A3, calendars XOR CHECK, audit log hardening. See `docs/audit/phase-5-report.md` for the full findings register and remediation roadmap.*
