# Mend — System Review v2 (Technical & Functional)

_Author: architecture review · Date: 2026-07-11 · Branch: `refactor/phase-12-file-splits` · v1.0.86_
_Supersedes the 2026-07-09 review (v1). Every finding from v1 has been re-verified against the current code._

**The headline:** since v1, real progress has been made on **code organisation** (the worst
component shrank from 5,876 to 2,669 lines, domain calculations were extracted with 177 passing
unit tests, and two of the four security holes in the rules were closed). But the **two problems
that make the product feel fragile are still open**: (1) financial roll-ups are still stored in
the database and refreshed only when a human clicks "Recalculate" — nine screens still have that
button — and (2) any authenticated user can still make themselves an admin of any enterprise
through the invitation rule. The plan in Part 4 is sequenced to close those first.

---

## Part 1 — How the system works (updated)

### 1.1 The storage substrate

Firestore, a schemaless document store: **26+ top-level collections** (plus
`sheets/{id}/rows` sub-collections). The "schema" still lives in two disconnected places:

- `src/domain/types.ts` (654 lines) — TypeScript shapes, compile-time only.
- `firestore.rules` (579 lines) — per-collection `isValidX()` validators, runtime but partial.

There is still no migration system and no runtime schema validation at the adapter boundary.
A field's meaning is whatever the code that last wrote it decided.

### 1.2 The object graph

Unchanged from v1: `Enterprise → Project → CostCode` is the spine; every child collection
denormalises `projectId`/`enterpriseId` as strings; there are no Firestore references, no
foreign-key constraints, and joins are client-side `.filter()` calls.

**Cascade delete — partially added.** `ProjectAdapter.deleteProjectWithSheets` now batch-deletes
sheets and their rows with the project, and `CostAdapter` has a `deleteCostCode` counterpart.
But **~18 other child collections** (costCodes on project delete, actuals, budgets, changes,
risks, subcontracts, invoices, progress\*, procurement\*, scheduleItems, etcDetails, costPhasing)
are still orphaned on delete. The one-off `scripts/audit-*.ts` / `fix-*.ts` scripts remain the
de-facto referential-integrity layer.

**The ambiguous foreign key is still there.** The "match on `id` OR `code`" reconciliation
pattern survives in **11 places across 8 files** (`CostCodes.tsx`, `ActualCost.tsx`,
`BaselineBudget.tsx`, `CostReportingPeriod.tsx`, `RiskManagement.tsx`, `GlobalTimephasing.tsx`,
`BulkRiskRecords.tsx`, `cost-codes/panels/TimephasingPanel.tsx`). This remains the single defect
most likely to silently attribute money to the wrong cost code.

### 1.3 How data becomes functionality

Still a pure client-side SPA behind the platform seam, and the seam has strengthened:

```
Component ──> use{X}Repo() hook ──> Port interface ──> FirestoreAdapter ──> Firestore
                                          └─(VITE_ADAPTER=memory)─> MemoryAdapter (tests)
```

- Zero `firebase/*` imports outside `src/platform/` — and this is now **machine-enforced** by an
  ESLint `no-restricted-imports` boundary rule (`npm run lint:boundary`). Caveat: it is not part
  of `npm run lint` and there is **no CI**, so enforcement still depends on someone running it.
- `src/domain/` has grown substantially: `eac.ts`, `phasing.ts`, `procurement.ts`, `progress.ts`,
  `risk.ts`, `roles.ts`, `types.ts` — each with a test file; **177 unit tests pass in ~350 ms**.
- Phases 11.3–11.8 eliminated the inline formula duplicates v1 complained about: 6 inline
  Beta-PERT copies, 10+ `rocPercentComplete` copies, and 2 inline `calculatePhasing` copies now
  route through the canonical domain functions.

What the seam still does **not** contain: the **roll-up** logic. `eac.ts` exists but is imported
by exactly one component (`CostCodes.tsx`), and the roll-up totals it should own are still
computed inline inside `handleRecalculateAll` and its siblings, then **written back to the
database** (see §2.4).

### 1.4 Code shape (updated numbers)

- `src/` is now **55,741 LOC** (up from ~51k — splits added files, plus tests and column factories).
- 119 component files. Largest: `CostCodes.tsx` **2,669** (was 5,876), `EnterpriseAdmin.tsx` 1,531,
  extracted `columns.tsx` factories at 1,462/1,433/1,264.
- **18 files still exceed the 800-line hard max** from CLAUDE.md.
- **764 `: any` occurrences** remain in `src/components/`.

---

## Part 2 — Key value chains (updated)

### 2.1 Onboarding a user / enterprise

**Improved:** `App.tsx` no longer hardcodes the owner email; it consumes `isPlatformAdmin` from
the centralised `usePlatform()`/`hooks.ts` path (Phase 11.8). The `userRoles` subscription feeds it.

**Still broken:**
- The hardcoded email list survives in **four places**: `src/platform/firestore/hooks.ts:61`
  (`SYSTEM_OWNER_EMAILS`), `CostManagement.tsx:51`, `ProcurementManagementSubPane.tsx:33` (both
  bypass the centralised hook with their own inline email comparison), and `firestore.rules:18-23`
  (`isSystemAdmin()`, now three emails including bernard's — added in v1.0.85).
- A brand-new user with no enterprise still hits the **`prompt()`** dead-end (`App.tsx:500`), and
  ~31 `alert()`/`prompt()` call sites remain across the app.
- The invitation token is still consumed from `window.location.search` without cleanup.
- **Security hole (still open, critical):** `isJoiningViaInvitation()` in `firestore.rules:34-42`
  still only checks that the write adds the caller's own uid to `adminUsers` — it **never checks
  that a matching invitation exists**. Any authenticated user can make themselves admin of any
  enterprise whose id they can obtain. The token check lives only in client code, which a direct
  SDK call bypasses.
- **Security hole (downgraded, now medium):** `userRoles/{userId}` write was fixed from
  "any authenticated user" to `isSystemAdmin() || request.auth.uid == userId` — but self-write
  means a user can still set `platformRole: 'platform_admin'` **on their own doc**, and the
  client's `isPlatformAdmin` trusts that field. Firestore rules use the email allow-list, so data
  access does not escalate server-side, but the client will render the platform-admin UI and
  every client-side authz branch keyed on `isPlatformAdmin` is spoofable.
- `enterprises` `allow create: if isAuthenticated()` — any logged-in user can create enterprises.
  Possibly intentional for self-serve onboarding; flagged so it becomes a decision, not an accident.

### 2.2 Creating / deleting a project

Delete now cascades to **sheets and rows only**. Cost codes, actuals, budgets, changes, risks,
subcontracts, invoices, progress, procurement and schedule documents are still orphaned. No
transaction, no soft-delete.

### 2.3 Seeding data

Unchanged: the seed script hand-encodes every collection because there is no schema layer.

### 2.4 Entering costs and reading a cost report (the core money flow)

**This is still the critical defect (F1), essentially unchanged.**

- `CostCode.approvedBudget / actualCostToDate / estimateAtCompletion / costVariance` (and the
  movement fields) are **stored on the document** and refreshed only by `handleRecalculateAll`
  (`CostCodes.tsx:170`, batch-writing all roll-ups at `:1968`).
- **Nine files** still carry a manual Recalculate action: `CostCodes.tsx`,
  `CostReportingPeriod.tsx`, `RiskManagement.tsx`, `GlobalTimephasing.tsx`, `BulkRiskRecords.tsx`,
  `BulkSubcontractInvoiceItems.tsx`, `ProcurementProgress.tsx`,
  `subcontracts/panels/LineItemsPanel.tsx`, `risk-management/panels/RiskRecordsPanel.tsx`.
- Between a leaf write and the next button-click, stored EAC/variance is stale; two screens can
  show different numbers for the same cost code. This remains a direct violation of the
  Single-Source-of-Truth rule in CLAUDE.md, and it is the fragility that erodes trust in a cost tool.

**Partial progress:** Beta-PERT is better — writes now go through the canonical
`betaPertExposure(min, ml, max, prob)` domain function, and grid cells recompute from leaves
(only pinned total rows read the stored `betaPertImpactAmount`). The *pattern* to copy exists;
it just hasn't been applied to the cost roll-ups, which matter most.

---

## Part 3 — Assessment

### 3.1 What is genuinely good ✅ (grown since v1)

1. **The ports-and-adapters seam** — still the strongest part, now backed by an ESLint boundary rule.
2. **Timestamp isolation** — converters keep Firebase types out of domain types.
3. **The domain layer is real now**: eac, phasing, procurement, progress, risk, roles — all
   extracted, all unit-tested (177 tests, 13 files, passing). Inline formula duplicates eliminated.
4. **Test infrastructure**: Vitest suite green; Playwright E2E suites exist (functional CRUD +
   characterization + a live suite of 4 specs runnable against Vercel); memory adapters make the
   acid test (`dev:memory`) possible.
5. **Two rule holes closed**: `procurementStepDefinitions` is now tenancy-scoped (was open to all
   authenticated users), and `invitations` reads are restricted to the enterprise admin or invitee
   (was leaking emails cross-tenant).
6. **God-component splitting has momentum**: column-def factories and panel extractions took the
   worst file from 5,876 → 2,669 lines.
7. **Version/commit discipline** — small commits, version bumps, JOURNAL entries.

### 3.2 Findings register — status after re-inspection

| # | Issue (v1) | Status 2026-07-11 | Severity now |
|---|-----------|-------------------|--------------|
| F1 | Stored derived financials, manual Recalculate | **OPEN.** 9 recalc sites; roll-ups still written to CostCode docs. `eac.ts` exists but imported once. | **CRITICAL** |
| F2 | `userRoles` writable by anyone | **PARTIAL.** Now self-or-admin only, but self-write still permits self-granting `platformRole` → client-side admin UI spoof (rules don't trust it, so no data escalation). | MEDIUM |
| F3 | `isJoiningViaInvitation` — no invitation check | **OPEN.** Rule unchanged in substance; any authed user can self-add to any enterprise's `adminUsers`. | **CRITICAL (security)** |
| F4 | No cascade delete | **PARTIAL.** Sheets+rows (and cost-code path) cascade; ~18 child collections still orphan. | HIGH |
| F5 | Ambiguous cost-code FK (`id` OR `code`) | **OPEN.** 11 occurrences in 8 files. | HIGH |
| F6 | Four competing admin models | **PARTIAL.** Client centralised on `isPlatformAdmin` (hooks.ts) — but 2 components bypass it with inline email checks, and rules/adminUsers/project.users/userRoles all still coexist. | HIGH |
| F7 | Hardcoded owner emails | **PARTIAL.** Reduced to 4 sites (hooks.ts, 2 components, firestore.rules — now 3 emails). Still requires a deploy to change platform admins. | MEDIUM-HIGH |
| F8 | God-documents (Enterprise/Project config arrays) | **OPEN.** Unchanged. | MEDIUM |
| F9 | God-components with inline business logic | **PARTIAL.** Max file halved; formula duplicates gone; 18 files still >800 lines; roll-up logic still inline. | MEDIUM |
| F10 | `prompt()`/`alert()` onboarding, dirty token URL | **OPEN.** `App.tsx:500` prompt; ~31 alert/prompt sites. | MEDIUM |
| F11 | `procurementStepDefinitions` rule open to all | **FIXED** (tenancy-scoped, firestore.rules:504). | — |
| F12 | `invitations` readable by any user | **FIXED** (admin or invitee only, firestore.rules:375). | — |
| F13 | Duplicate planned/current/actual field sets on ProgressItem | **OPEN.** | LOW |
| F14 | No schema/migration system | **OPEN.** | (structural) |

**New observations (v2):**

| # | Issue | Severity |
|---|-------|----------|
| N1 | ESLint boundary rule exists but is not in `npm run lint` and there is **no CI pipeline** — nothing runs type-check/tests/boundary on push or PR. | HIGH (process) |
| N2 | `enterprises` create is open to any authenticated user — decide if that's the intended self-serve flow. | MEDIUM |
| N3 | 764 `: any` in components — the domain layer is typed but the UI layer erases it. | MEDIUM |
| N4 | Repo hygiene: dozens of Finder-duplicate `* 2.ts` files and loose docx/scripts sit untracked at repo root; they will eventually get committed by accident. | LOW |

### 3.3 Is this good, robust architecture yet?

The **code-organisation architecture** is genuinely on track: seam enforced, domain layer real
and tested, components shrinking. What is *not* yet robust is the **data architecture** — the
same three deep problems v1 named: no referential integrity with an ambiguous FK, stored derived
financials with human-triggered refresh, and a fractured identity/authz model. Those three are
what make the app *feel* fragile in daily use, and none of them is closed. The good news: the
domain layer and test harness built since v1 are exactly the tools needed to close them.

---

## Part 4 — The uplift plan: PoC/MVP → stable, robust system

### Guiding principle: don't fight Firestore where Postgres will win

The stated target is PostgreSQL (Supabase). That changes what's worth building **now**:

- **Do now, carries over or protects users today:** security-rule fixes, compute-on-read domain
  roll-ups, canonical FK normalisation, real onboarding UX, CI. These are storage-agnostic (the
  domain functions and selectors move to Postgres unchanged) or urgent regardless.
- **Do minimally:** cascade delete (a simple registry-driven batch — don't build infrastructure;
  Postgres gives `ON DELETE CASCADE` for free), schema validation (zod at the adapter boundary —
  which doubles as the future Postgres schema spec).
- **Defer to the Postgres migration:** god-document restructuring (F8/F13), a real migration
  framework (F14), event-driven anything. Redesign the schema once, in SQL, not twice.

### Phase A — Close the security holes (≈2 days) 🔴 do first

**A1 (F3) — Server-verified invitation acceptance.**
The Express server already exists; give it a second route. `POST /api/accept-invite` using
`firebase-admin`: verify the ID token, look up the invitation by token, check status/email match,
add the uid to the enterprise membership and mark the invitation accepted **in one server-side
batch**. Then **delete `isJoiningViaInvitation()` from firestore.rules entirely** — enterprise
updates become admin-only. This closes the self-add-as-admin hole at the root.
_Acceptance: a rules-emulator test proving a non-invited authed user cannot write themselves into `adminUsers`._

**A2 (F2 residue) — Lock `platformRole`.**
`userRoles` self-write may not change `platformRole`:
`request.resource.data.platformRole == resource.data.platformRole || isSystemAdmin()` (handle the
missing-field case). Or simpler: make `userRoles` writes system-admin-only and route user-pref
fields elsewhere.
_Acceptance: emulator test — self-granting `platform_admin` is rejected._

**A3 (F7/F6) — One admin definition via custom claims.**
Set `platformAdmin: true` as a **Firebase Auth custom claim** (one small admin script using
firebase-admin). Rules check `request.auth.token.platformAdmin == true`; the client reads it from
the ID token. Delete the email lists from `firestore.rules`, `hooks.ts`, `CostManagement.tsx`,
`ProcurementManagementSubPane.tsx`. Adding a platform admin becomes a script run, not a deploy.
_Acceptance: `grep -r "guindy\|bernard.w.leung" src firestore.rules` returns nothing._

**A4 (N2) — Decide enterprise creation policy.** If self-serve is intended, keep it and build the
real onboarding form (Phase D); if not, restrict create to platform admins.

### Phase B — Make the numbers trustworthy (≈1.5–2 weeks) 🔴 the core of "not fragile"

**B1 (F1) — Compute-on-read for all financial roll-ups.**
This is the single highest-value change in the plan. The recipe, per roll-up family:

1. **Inventory** the stored derived fields: CostCode roll-ups (budget/actual/ETC/EAC/variance +
   movements), `Change.budget/eac`, `Risk.exposure`, pinned-row `betaPertImpactAmount`.
2. **Extend `src/domain/eac.ts`** (and a new `src/domain/rollups.ts`) with pure functions that
   take leaves (actuals, budgets, etcDetails, changeRecords, riskRecords) and return the totals —
   exactly the pattern already proven with `betaPertExposure`.
3. **Add selector hooks** (`useCostCodeRollups(projectId)`) in `src/product`/`lib` that subscribe
   to leaves via the existing repos and compute at render. Every screen calls the same hook.
4. **Freeze the switch with the existing characterization test**
   (`tests/e2e/cost-report.characterization.spec.ts`): capture current numbers, flip a screen to
   computed values, assert equality (after deliberately reconciling any stale stored data).
5. **Delete the 9 Recalculate buttons** and stop writing roll-ups to CostCode docs. Keep
   `periodSnapshots` as the *only* stored derived data — it is a legitimate frozen snapshot, and
   every surface that shows it must label it "as of {period}".
6. Migrate one screen at a time: CostCodes → CostReportingPeriod → Risk → Subcontracts/Invoices →
   Procurement. Each step is commit-sized and testable.

_Acceptance: edit an actual cost, navigate anywhere — every screen shows the new EAC with no
button pressed; no two screens can disagree._
_Perf note: current data volumes are PoC-scale; client-side reduce over a few thousand leaves is
milliseconds. If a screen measurably lags, memoise the selector — do not go back to storing._

**B2 (F5) — One canonical cost-code foreign key.**
1. Write `scripts/normalize-costcode-fk.ts`: for every child collection, resolve
   `costCodeId` values that hold a user `code` string to the document id; report unresolvable rows.
2. Run against a backup/emulator first, then live.
3. Delete all 11 `=== id || === code` fallbacks; children match on `costCodeId === id` only.
4. Add a validator to `isValidX()` rules: `costCodeId is string && costCodeId.size() > 0`, and to
   the zod schemas in C2.

_Acceptance: `grep -rn "costCodeId === .*||" src` returns 0; audit script reports 0 ambiguous rows._

### Phase C — Data lifecycle integrity (≈4 days) 🟠

**C1 (F4) — Registry-driven cascade delete.**
One constant in the platform layer, e.g. `PROJECT_CHILD_COLLECTIONS: string[]` (all ~20 names),
consumed by `deleteProjectCascade(projectId)` — chunked batched deletes (500/batch), sheets/rows
included. Same registry drives a `deleteCostCodeCascade` and the audit scripts, so there is
exactly one list to maintain. Client-side is acceptable for MVP (rules already gate delete to
enterprise admins); move it behind the Express server later if delete volume grows.
_Acceptance: delete a seeded project → audit script finds 0 orphans._

**C2 (F14, minimal) — Zod schemas at the adapter boundary.**
One zod schema per collection in `src/domain/schemas/`, inferred types replacing hand-written
ones progressively. Firestore adapters `parse()` on read (log + quarantine on failure) and
`parse()` on write (throw). The seed script builds documents *from the schemas*. This kills the
"seed fights back" problem, gives runtime validation Firestore rules can't, and becomes the
specification for the Postgres DDL later. **Do not** build a Firestore migration framework.

### Phase D — Onboarding & error surfaces (≈3 days) 🟠

**D1 (F10):** replace the `prompt()` dead-end with a real create/join-enterprise screen; replace
all ~31 `alert()`/`prompt()` sites with the toast/dialog pattern (shadcn/ui is already in the
stack); strip the invitation token from the URL after consumption (`history.replaceState`);
surface `bootstrapIfEmpty` failures in UI, not `console.error`.
**D2:** add a top-level React error boundary so a component crash degrades to a screen-level
error instead of a white page.

### Phase E — Enforcement: make the standards self-executing (≈1 day) 🟠

- **CI (GitHub Actions):** on PR/push — `type-check` → `vitest run` → `lint:boundary` → `build`.
  This is the highest leverage/effort ratio in the whole plan: every guarantee built so far
  currently depends on someone remembering to run it.
- Fold `lint:boundary` into `npm run lint`.
- Add the memory-adapter E2E smoke (`dev:memory` + a functional spec) to CI; keep live-Vercel E2E
  as the nightly job (blocked on GitHub issue #4 / test-project setup — existing backlog item).
- **Repo hygiene:** delete the `* 2.ts` Finder duplicates, move loose scripts under `scripts/`,
  move or gitignore the docx files at repo root.

### Phase F — Continuous code health (ongoing, timeboxed per session) 🟡

- **File-size ratchet:** never let a touched file grow; split any of the 18 >800-line files *when
  you're already in them* (the Phase-12 pattern — column factories + panels — works; don't big-bang it).
- **`: any` ratchet:** enable `@typescript-eslint/no-explicit-any` as `warn`, record the count
  (764), fail CI if it rises. Burn it down opportunistically.
- **F8/F13 (god documents, ProgressItem field triplication): deliberately deferred** to the
  Postgres schema design, where normalisation happens once. Only intervene sooner if write
  contention on Project period arrays actually bites.

### Sequencing and effort (solo, focused)

| Phase | What | Effort | Risk if skipped |
|-------|------|--------|-----------------|
| A | Security holes, one admin model | ~2 days | Tenant takeover; can't safely demo to outsiders |
| B | Compute-on-read + canonical FK | ~1.5–2 wks | Numbers stay untrustworthy — the product's core promise |
| C | Cascade + zod boundary | ~4 days | Orphans and seed fragility keep recurring |
| D | Onboarding + error surfaces | ~3 days | First-run experience remains a debugging affordance |
| E | CI + hygiene | ~1 day | All other guarantees decay silently |
| F | Ratchets | ongoing | Slow regression to god-files |

**Total: roughly 3.5–4.5 weeks** of solo effort to a defensible "stable MVP" bar. A and E are
tiny and unblock everything else psychologically: after them, every subsequent change is guarded
by CI and no longer exposed to the two critical holes.

---

## Part 5 — Metrics snapshot (2026-07-11 vs 2026-07-09)

| Metric | v1 (07-09) | v2 (07-11) |
|--------|-----------|-----------|
| `src/` LOC | ~51k | 55,741 (splits, tests, factories) |
| Largest component | 5,876 (CostCodes) | 2,669 (CostCodes) |
| Files >800 lines | ~12–15 | 18 (splits created mid-size files; several columns.tsx >1,200) |
| Domain modules | 4 (no eac) | 7 incl. `eac.ts`, all tested |
| Unit tests | ~166 | **177 passing** (13 files, ~350 ms) |
| E2E | none live | functional + characterization + 4 live specs (Vercel) |
| Firebase imports outside platform | 0 (manual grep) | 0 (**ESLint-enforced**, not in CI) |
| `: any` in components | (not counted) | 764 |
| Recalculate button sites | ~6 | 9 files (splits duplicated some panels) |
| `id OR code` fallbacks | 12 | 11 (8 files) |
| Hardcoded admin emails | client + rules | 4 sites (hooks.ts, 2 components, rules — 3 emails) |
| Critical security holes | 2 (F2, F3) | **1 (F3)** + 1 medium residue (F2 platformRole self-grant) |
| CI | none | none |

## Part 6 — Verdict

The refactor is working: the seam is enforced, the domain layer is real and tested, and the code
is getting smaller and safer to change. **v1's synopsis still stands** — the fragility lives in
the data model, not the code layout — but the distance to "stable, robust MVP" is now short and
well-defined: **one security rule (A1), one architectural pattern applied nine times (B1), one
data migration (B2), one deletion registry (C1), and a CI file (E)**. Everything else is polish
and ratchets. Do Phase A this week; do not add new features until Phase B is done, because every
feature built on stored roll-ups deepens the hole you must climb out of.

---

_Verification evidence for this review: `firestore.rules:18-23, 34-42, 305-312, 375-386, 504-522,
573-577`; `src/platform/firestore/hooks.ts:61`; `CostManagement.tsx:51`;
`ProcurementManagementSubPane.tsx:33`; `CostCodes.tsx:170, 1968`; `App.tsx:500`;
`ProjectAdapter.ts:71-81`; grep counts for `costCodeId === ... ||` (11), `: any` (764),
Recalculate (9 files); `vitest run` → 177/177 pass; `tsc --noEmit` clean; no `.github/workflows`._
