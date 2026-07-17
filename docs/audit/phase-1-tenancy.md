# Phase 1 — Tenant Isolation Audit

Method: adversarial. Two fully separate tenants (Enterprise A, Enterprise B), real
non-admin users belonging to exactly one tenant, driven through the app's own anon-key
client so RLS is exercised exactly as the browser hits it. **No platform admins** — that
role bypasses everything and is the reason this was never caught before (both membership
tables were empty at audit time; the app has only ever run as platform admin).

Suite: `tests/postgres/tenant-isolation.test.ts` (13 tests). Run with `npm run test:postgres`.

## Result summary

**The core read/write tenant boundary HOLDS.** 12 of 13 attacks were correctly blocked or
proved inert. **One confirmed vulnerability**: cross-tenant foreign-key references (F1).
Two behaviors documented as lower-severity integrity findings (F2, F3).

| # | Attack | Outcome |
|---|--------|---------|
| Cross-tenant read (project, cost_code, enterprise) | A cannot see any B row | ✅ blocked |
| Unfiltered select returns only own-tenant rows | only A rows returned | ✅ blocked |
| Cross-tenant INSERT (cost_code into B's project) | rejected by WITH CHECK | ✅ blocked |
| Cross-tenant UPDATE / DELETE of B's cost_code | 0 rows affected, unchanged | ✅ blocked |
| Enterprise member (no project role) reads project data | empty — membership ≠ project access | ✅ blocked |
| Enterprise member reads own enterprise row | allowed | ✅ correct |
| **FK reference attack** (attach B's cost_code to A's record) | **SUCCEEDED** | ❌ **F1** |
| Denormalized scope (subcontract claiming foreign enterprise_id) | see F2 | ⚠️ F2 |
| Self-granted `user_roles.platform_role = 'platform_admin'` | DB-inert (grants no RLS power) | ✅ blocked at DB / ⚠️ F3 |
| Audit-log actor impersonation | succeeds (actor fields client-asserted) | ⚠️ documented |

---

## F1 — CRITICAL: Cross-tenant foreign-key references

**A user in one tenant can create records that reference another tenant's rows.**

Confirmed live: a Project User in Enterprise A inserted a `risk_record` into their own
project A, but with `cost_code_id` pointing at a cost code owned by Enterprise B. The
insert succeeded. Every RLS `WITH CHECK` on the project-scoped tables validates only the
row's own `project_id` via `can_access_project()` — it never validates that FK-referenced
rows (cost_code_id, risk_id, change_id, etc.) belong to the same project/tenant. FK
constraint checks run as table owner and bypass RLS, so the reference to B's invisible row
is allowed.

**Two concrete impacts, both verified:**

1. **Durable cross-tenant linkage.** A record in tenant A now references a row in tenant
   B. The read boundary still holds in the current app (A still cannot SELECT B's
   cost_code row), so this is not *yet* a data-read breach — but it is latent: any
   SECURITY DEFINER function, rollup, materialized view, admin report, or the ETL that
   resolves that FK with elevated privilege would surface B's data to A.

2. **Cross-tenant denial-of-delete (verified).** `cost_codes` deletes are
   `ON DELETE RESTRICT`. Because A's risk_record now references B's cost_code, **B can no
   longer delete their own cost code** — the delete fails with a FK violation
   (`23503`) against a row B cannot see or diagnose. One tenant can permanently pin
   another tenant's data in place. This is a tenant-isolation breach by the audit's own
   definition (one enterprise durably affects another's data/state).

**Systemic scope.** This is not specific to risk_records/cost_codes. It applies to every
FK from a project-scoped table to another parent that RLS gates only by the child's own
project_id. Affected FK columns (from Phase 0 §7): `cost_code_id` on risk_records,
change_records, actual_costs, baseline_budgets, subcontract_line_items, progress_items,
etc_details, cost_phasing; `risk_id`, `change_id`, `package_id`, `rule_of_credit_id`,
`subcontract_id`, `vendor_id`, `calendar_id`, `invoice_id`, `subcontract_line_item_id`.
Any of these can be pointed cross-tenant.

**Remediation options (decision deferred to Phase 5):**
- **(a) Composite foreign keys** — the structural, DB-native fix. Add a unique key
  `cost_codes(project_id, id)` and change referencing FKs to
  `FOREIGN KEY (project_id, cost_code_id) REFERENCES cost_codes(project_id, id)`. The DB
  then guarantees same-project linkage; no runtime cost, unbypassable, no RLS change.
  Larger migration (touches every referencing table + needs project_id present on each).
- **(b) RLS `WITH CHECK` extension** — add `can_access_project((select project_id from
  cost_codes where id = cost_code_id))` to each table's check. Closes the cross-*tenant*
  hole (A can't reference B's cost_code because A can't access B's project) but still
  permits cross-*project-within-tenant* linkage, and adds a subquery per write.
- **(c) BEFORE INSERT/UPDATE triggers** asserting referenced-row project == row project.
  Flexible but adds a trigger per table and runtime cost.

Recommendation leans (a) — it's the relational-correct fix and the audit is explicitly
about fixing structure, not papering over it. Sizing belongs in Phase 5, and it interacts
with the department hierarchy work (composite keys would want to include the tenancy
column that hierarchy settles on).

Regression test: `tests/postgres/tenant-isolation.test.ts`, marked `it.fails` (green now,
flips red when F1 is fixed → promote to plain `it`).

---

## F2 — MEDIUM: Denormalized scope columns are attacker-influenced but currently inert

subcontracts/invoices/subcontract_line_items carry BOTH a `project_id` (which RLS checks)
and a denormalized `enterprise_id` (which RLS does not). In principle a user could insert
a row whose project_id is theirs but enterprise_id names another tenant. In the tested
path the insert was blocked for an unrelated reason (vendor_id FK to a nonexistent vendor),
so no poisoned row landed — but the *policy* still doesn't validate enterprise_id against
project_id's true owner. This is the same class as F1 (unvalidated denormalized/foreign
reference) and the composite-FK or trigger fix for F1 should cover it. Severity MEDIUM: no
verified breach, but a latent inconsistency where the denormalized column can disagree with
the authoritative project→enterprise chain. See also Phase 2 (why these columns exist at
all).

## F3 — MEDIUM (drift, not breach): self-granted user_roles.platform_role is DB-inert but frontend-trusted

Verified: a plain user CAN insert their own `user_roles` row with
`platform_role = 'platform_admin'` (RLS allows self-insert; the `protect_platform_role`
trigger only guards `user_profiles`). At the **database** layer this grants nothing —
`is_platform_admin()` reads `user_profiles`, so the escalated user still cannot see
Enterprise B and cannot delete an enterprise (both verified). **But the frontend's
`isPlatformAdmin` reads `user_roles`** (Phase 0 finding #20). So a user can self-grant
client-side platform-admin UI: the System Admin page, the `subscribeAll` enterprise list,
and any component gated on `useAuth().isPlatformAdmin` would render for them — exposing the
*existence and names* of all enterprises (a real, if limited, information disclosure), even
though every underlying data query still returns empty by RLS.

This is the platform_role-in-two-tables split biting again. The fix is Phase 2's
(collapse to one source of truth: `user_profiles.platform_role`, enforced by trigger;
delete or lock down `user_roles.platform_role`). Until then it's a UI-only disclosure of
enterprise names, not a data breach. Confirms the split is not merely untidy — it is
exploitable at the UI tier.

## Documented (not a finding): audit-log actor fields are client-asserted

A member can insert an `audit_logs` row with any `actor_user_id`/`actor_email`. The INSERT
policy checks only enterprise access, not actor identity. Still tenant-scoped (can't forge
into another enterprise), so not an isolation breach — but the audit trail's "who" is
client-honest, not enforced. Worth hardening if audit logs ever become
compliance-relevant: set actor from `auth.uid()`/`auth.jwt()` in a trigger or server path
rather than trusting the client payload. Tracked HIGH-for-integrity, LOW-for-now.

---

## What this means for later phases

- **F1's fix choice constrains Phase 2 and the hierarchy work.** If we go composite-FK,
  the composite key should include whatever tenancy/hierarchy column Phase 2 lands on, so
  we don't migrate the same FKs twice. Do not fix F1 before the Phase 2 hierarchy decision.
- **F3 is a symptom of the Phase 2 membership/role-source-of-truth problem**, not an
  independent bug. Fix it as part of collapsing role storage, not in isolation.
- The **read/write boundary itself is solid** — the RLS helper functions and the
  `can_access_project`/`can_access_enterprise` chain are correct and enforced. The holes
  are all about *unvalidated references between* correctly-gated rows, plus the
  duplicate-role-storage split. That's a good result: the foundation holds; the joints leak.
