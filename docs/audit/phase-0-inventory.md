# Phase 0 — Ground Truth Inventory

Captured 2026-07-17 directly from the live scratch database (`hryshufihwwcdurlqysy`) via
catalog queries (`pg_class`, `pg_policy`, `pg_proc`, `pg_trigger`, `information_schema`)
and the Supabase security/performance advisors. This file records **what exists**, not
judgments — observations are queued to their proper phase at the bottom.

## 1. Tables (37 total, public schema)

**RLS is enabled on all 37 tables. Every table has at least one policy. No unprotected
tables exist.** (The `etl` schema also exists, holding `id_mappings` — not exposed via
PostgREST, service-role only.)

Approx row counts at capture time (note the two zeros — they matter):

| Table | Rows | Table | Rows |
|---|---|---|---|
| actual_costs | 4,736 | changes | 32 |
| baseline_budgets | 703 | change_records | 23 |
| cost_phasing | 260 | progress_reporting_periods | 24 |
| cost_codes | 142 | vendors | 20 |
| etc_details | 49 | subcontract_line_items | 18 |
| schedule_items | 15 | procurement_step_definitions | 17 |
| period_snapshots | 15 | calendars | 12 |
| projects | 10 | forecast_rows | 9 |
| procurement_items | 9 | progress_items | 6 |
| invoice_items | 6 | progress_packages | 5 |
| subcontracts | 5 | enterprises | 4 |
| user_profiles | 4 | user_roles | 4 |
| sheets | 2 | risks | 1 |
| **enterprise_members** | **0** | **project_members** | **0** |

**Both membership tables are empty.** The ETL never populated them (Firebase UIDs
couldn't map to Supabase auth users). Every user who currently "works" in the app works
only because they hold platform_admin, which bypasses membership checks entirely. This
single fact explains the "0 Admins" display and means **no non-admin user journey has
ever actually been exercised against this database**.

## 2. RLS helper functions (all SECURITY DEFINER, all with pinned search_path)

| Function | Logic |
|---|---|
| `is_platform_admin()` | `user_profiles.platform_role = 'admin'` for `auth.uid()` |
| `is_enterprise_admin(ent_id)` | platform admin OR `enterprise_members.role = 'admin'` |
| `is_project_admin(proj_id)` | enterprise admin (via project's enterprise) OR `project_members.role = 'Project Admin'` |
| `can_access_enterprise(ent_id)` | platform admin OR enterprise admin OR enterprise_members row |
| `can_access_project(proj_id)` | platform admin OR enterprise admin (via project) OR project_members row |
| `create_enterprise_with_admins(...)` | RPC: creates enterprise + admin memberships atomically; self-serve callers may only add themselves as admin |
| `protect_platform_role()` | trigger fn: blocks platform_role changes unless caller is platform admin |

Access chain is strictly hierarchical: platform admin ⊃ enterprise admin ⊃ enterprise
member; enterprise admin ⊃ project admin ⊃ project member. **Note: enterprise *member*
(non-admin) does NOT grant project access** — project access requires a project_members
row or enterprise-admin status. Membership in an enterprise alone only grants: reading
the enterprise row, its members, vendors, enterprise-scoped calendars/step-definitions,
and writing audit_logs.

## 3. Policy catalog (65 policies, by pattern)

**Pattern A — single `FOR ALL` policy `can_access_project(project_id)`** (19 tables):
actual_costs, baseline_budgets, changes, change_records, cost_codes, period_snapshots,
procurement_items, progress_attributes, progress_items, progress_packages,
progress_reporting_periods, risks, risk_records, rules_of_credit, schedule_items, sheets,
(cost_phasing, etc_details, cost_code_assigned_users, rule_of_credit_steps, forecast_rows
— same pattern but resolve project_id via parent-row subquery instead of own column).
Note: Postgres applies `USING` as the implicit `WITH CHECK` for FOR ALL policies, so
INSERTs are also gated — you can only insert rows pointing at projects you can access.

**Pattern B — per-command policies** (projects, enterprises, enterprise_members,
project_members, subcontracts, invoices, invoice_items, subcontract_line_items):
reads for members, writes for the relevant admin level. Notable specifics:
- `enterprises` INSERT: any authenticated user (`auth.uid() IS NOT NULL`) — self-serve
  enterprise creation is intentional
- `subcontracts`/`invoices`/`invoice_items`/`subcontract_line_items` SELECT additionally
  allow **vendor access via `auth.jwt()->>'email' = ANY(subcontracts.vendor_users)`** —
  email-string-based authorization for external vendor users
- `audit_logs`: INSERT by any enterprise-accessor, SELECT by enterprise admin only,
  **no UPDATE/DELETE policies at all → immutable to all client roles** (good)
- `user_profiles`: SELECT/UPDATE self-or-platform-admin; **no INSERT policy** (inserts
  are service-role only)
- `user_roles`: SELECT/UPDATE/**INSERT** self-or-platform-admin — a user can insert and
  update their own row
- `saved_views`: purely user-scoped (`user_id = auth.uid()`)
- `invitations`: enterprise admin only (accept flow is server-side via service role)

## 4. Tenancy map (every table's chain to an enterprise)

- **Self**: enterprises
- **Direct enterprise_id FK**: enterprise_members, invitations, vendors, audit_logs
- **Either-scope (enterprise_id OR project_id, both nullable)**: calendars,
  procurement_step_definitions — policy: `(project_id NOT NULL AND can_access_project)
  OR (enterprise_id NOT NULL AND can_access_enterprise)`. ⚠️ A row with BOTH null is
  invisible to everyone but service role (no CHECK constraint prevents this).
- **Via projects.enterprise_id (own project_id FK)**: projects, project_members,
  cost_codes, changes, change_records, risks, risk_records, sheets, actual_costs,
  baseline_budgets, schedule_items, procurement_items, progress_attributes,
  progress_items, progress_packages, progress_reporting_periods, rules_of_credit,
  period_snapshots, subcontracts*, invoices*, subcontract_line_items*
  (*also carry a denormalized enterprise_id — two scoping columns that can disagree)
- **Via parent-row subquery (no own scoping column enforced in policy)**:
  cost_code_assigned_users (→cost_codes), cost_phasing (→cost_codes; has nullable
  project_id column the policy ignores), etc_details (→cost_codes; same),
  forecast_rows (→sheets), invoice_items (→invoices), rule_of_credit_steps
  (→rules_of_credit)
- **User-scoped, no tenancy**: user_profiles, user_roles, saved_views

## 5. Enums (3) and role conventions

| Enum | Values | Used by |
|---|---|---|
| `platform_role` | admin, user | user_profiles.platform_role |
| `enterprise_member_role` | admin, member | enterprise_members.role, invitations.role |
| `project_member_role` | "Project Admin", "Project User" | project_members.role |

`user_roles.platform_role` is **unconstrained text** (not the enum), expected by the
frontend to equal the literal `'platform_admin'` — a third convention.

## 6. Triggers

**Exactly one trigger exists in the entire database**:
`user_profiles_protect_platform_role` (BEFORE UPDATE on user_profiles).
No triggers on user_roles. No updated_at maintenance triggers anywhere (timestamps are
app-managed). No coherence triggers for the denormalized enterprise_id/project_id pairs.

## 7. FK integrity notes

- All parent-child FKs exist with sensible delete rules (CASCADE down ownership chains,
  RESTRICT on cost_code references from financial records, SET NULL on optional refs).
- **No `user_id` column anywhere has an FK to `auth.users`**: enterprise_members,
  project_members, user_profiles, user_roles, saved_views, cost_code_assigned_users,
  created_by/modified_by columns — all unconstrained UUIDs.
- FK validation **bypasses RLS by design** (constraint checks run as table owner), so a
  FK can point at a row the inserting user cannot see. Nothing structurally prevents
  e.g. a change_record whose project_id is yours but whose cost_code_id belongs to a
  different project or enterprise. Composite coherence is enforced nowhere.
- `actual_costs.period`, `risks.period_id`, `period_snapshots.period_id` are **text**,
  not FKs to progress_reporting_periods.

## 8. Supabase advisors summary

Security (9 warnings):
- `create_enterprise_with_admins` executable by **anon** role (function fails safe on
  null auth.uid(), but the EXECUTE grant is unnecessary surface)
- All 7 SECURITY DEFINER functions callable via `/rest/v1/rpc/` by authenticated users
  (mostly harmless boolean oracles; unnecessary surface)
- Leaked-password protection (HaveIBeenPwned check) disabled in Auth config

Performance:
- 5 RLS policies re-evaluate `auth.jwt()`/`auth.uid()` per row (initplan warnings):
  subcontracts_select, subcontract_line_items_select, invoices_select,
  invoice_items_select, enterprises_insert
- 4 unindexed FKs (etc_details.calendar_id, projects.created_by/modified_by,
  sheets.created_by); several unused indexes (meaningless at current data volume)

## 9. Observations queued to later phases

### → Phase 1 (tenant isolation — to be adversarially verified)
1. **user_roles self-INSERT/UPDATE with unprotected platform_role text column.** The
   only protection trigger is on user_profiles. A user setting their own
   `user_roles.platform_role = 'platform_admin'` gains nothing at the DB layer
   (RLS reads user_profiles) but the **frontend** reads user_roles for `isPlatformAdmin`
   → likely UI-level privilege escalation (System Admin page, subscribeAll paths). Verify.
2. **FK reference attack**: can a member of project A create a risk_record/change_record
   with cost_code_id from project B (or enterprise B)? Structurally nothing prevents it.
3. **Denormalized scope pairs**: can a user insert an invoice with project_id from
   enterprise A (theirs) but enterprise_id of enterprise B? RLS only checks project_id.
4. **Vendor email authorization**: vendor_users text arrays + jwt email claim — verify
   email comparison is against a *verified* email; check case-sensitivity handling.
5. **Coarse write granularity**: any project member (not just admins) gets full
   INSERT/UPDATE/DELETE on all 19 Pattern-A tables — including deleting the entire
   cost history of a project. Confirm this is intended for now; flag for role design.
6. **audit_logs.actor_email / actor_user_id are client-supplied** — any member can
   insert an audit row impersonating anyone (INSERT policy only checks enterprise
   access). Audit trail integrity depends on client honesty.
7. Either-scope tables (calendars, procurement_step_definitions) allow rows with both
   scopes null → orphaned/invisible rows possible; no CHECK constraint.
8. RPC surface: revoke anon EXECUTE on create_enterprise_with_admins; consider
   revoking authenticated EXECUTE on internal helpers.

### → Phase 2 (data model)
9. **Membership is represented four different ways**: enterprise_members (relational,
   EMPTY), project_members (relational, EMPTY), user_roles.memberships (jsonb),
   sheets.users (uuid array). The two relational tables are the ones RLS trusts, and
   they have never been populated.
10. platform_role in two tables with two type systems and two value conventions
    (enum 'admin' vs text 'platform_admin') — confirmed from schema, already bit us.
11. Role value conventions inconsistent: 'admin'/'member' vs 'Project Admin'/'Project
    User' (title case with spaces, in an enum).
12. Status columns are free text everywhere (projects, changes, invoices, risks,
    subcontracts, invitations, progress_reporting_periods, subcontract_line_items).
13. Reporting periods referenced by text ids with no FK (actual_costs.period,
    risks.period_id, period_snapshots.period_id).
14. Stored derived values: cost_codes.*_previous/*_movement sextet,
    forecast_rows.eac/cost_to_go, period_snapshots.cost_codes jsonb blob,
    etc_details.total_etc_previous. Check each against the leaves-only rule
    (snapshots may be legitimate frozen history — must be labelled as such).
15. projects table (40+ columns) duplicates enterprise-level defaults per project
    (categories, control_accounts, order_numbers, cost_elements, all the *_attributes
    buckets, change_types, risk_types, resource_rates) — copy-on-create drift surface.
16. No auth.users FKs on any user_id column (see §7).
17. No updated_at triggers — app code is trusted to maintain timestamps.
18. calendars/procurement_step_definitions dual-scope design (see #7 above).
19. cost_phasing and etc_details carry nullable project_id columns that RLS ignores
    (routes via cost_code) — misleading, can disagree with the cost_code's project.

### → Phase 4 (app logic)
20. Frontend isPlatformAdmin reads user_roles (see #1) while RLS reads user_profiles —
    the two-sources-of-truth split is live in code today.
21. invitations.token is a plaintext bearer token column (RLS-protected to enterprise
    admins; accept flow is server-side) — check server-side handling in server.ts.

## 10. Hierarchy readiness (Salesforce-style departments) — first read

Current model is strictly two-level: enterprise → project. Every project-scoped table
FKs `projects` directly and derives enterprise through it — which is actually the
*right* shape for inserting intermediate levels: a `departments` table +
`projects.department_id` (nullable during migration) would slot in without touching the
19 Pattern-A tables or their policies, since they all route through
`can_access_project()`. The blast radius of adding hierarchy concentrates in:
projects table, the access-helper functions, enterprise_members (would need
department-level roles), and the copy-on-create defaults problem (#15) which would get
worse with more levels unless fixed first. Full assessment in Phase 2.
