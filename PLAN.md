# Mend — Refactor Plan

## Status: Phase 4 complete — Phase 5 (Firestore adapters) is the Tarek review gate

Current branch: `refactor/platform-seam`
Version: 1.0.3

---

## Phase 0 — Pre-flight ✅

- [x] P0.1 Confirm Tarek WIP pushed (confirmed)
- [x] P0.2 Clone repo to `/Claude/Projects/MendApp/`
- [x] P0.3 Verify baseline: `npm install` + `npm run build` passes
- [x] P0.4 Add CLAUDE.md
- [x] P0.5 Add PLAN.md and JOURNAL.md
- [x] P0.6 Add `.claude/settings.json` (PostToolUse hooks)
- [x] P0.7 Add Vitest + initial test config
- [x] P0.8 Commit operating files to `main` before branching

---

## Phase 1 — Chunk 0: Recon ✅ DONE
Findings captured in JOURNAL.md Session 1 and CLAUDE.md.

---

## Phase 2 — Chunk 1: Scaffold & Move ✅ DONE (v1.0.1)
- src/firebase.ts → src/platform/firestore/firebase.ts (canonical)
- src/firebase.ts, src/types.ts, src/lib/procurementUtils.ts → re-export stubs
- src/domain/types.ts → canonical domain model

---

## Phase 3 — Chunk 2: Extract Calculation Engine ✅ DONE (v1.0.2)
- 19 unit tests passing
- src/domain/phasing.ts: calculatePhasing, dateToISO, Period (6 distribution methods)
- src/domain/risk.ts: betaPertImpact (Beta Pert formula)
- src/lib/utils.ts: re-exports from domain; Firestore Timestamp branch flagged as tech debt

---

## Phase 4 — Chunk 3: Port Interfaces ✅ DONE (v1.0.3)
- 11 port interfaces: enterprise, project, cost, change, risk, subcontract, progress, procurement, schedule, utility, auth
- 0 firebase/* types in any port file; all dates ISO strings
- 4 inline component types promoted to src/domain/types.ts (ActualCostRecord, BaselineBudgetRecord, CostPhasingRecord, PeriodSnapshot)
- **⚠️ GATE: Tarek must review port interfaces before Phase 5 starts**

---

## Phase 5 — Chunk 4: Firestore Adapters

**Goal:** Implement the ports in `src/platform/firestore/`. Wire composition root.

- [ ] 5.1 Implement each port in `src/platform/firestore/` (one file per repository)
- [ ] 5.2 Add composition root in `src/platform/config/` — wires concrete adapters to interfaces
- [ ] 5.3 Add React context provider and `useXRepo()` hooks in `src/platform/`
- [ ] 5.4 Verify: `npm run build` passes; `npm run lint` passes
- [ ] 5.5 Version bump + commit: `feat: firestore adapters + composition root`

---

## Phase 6 — Chunk 5: Migrate Product Modules

**Goal:** Replace all direct `firebase/firestore` calls in `src/product/` with repo hooks. One module at a time.

- [ ] 6.1 Cost Codes (`CostCodes.tsx`) — replace direct Firestore calls with `useCostCodeRepo()`
- [ ] 6.2 Verify build + smoke-test cost codes in browser; version bump + commit
- [ ] 6.3 Forecast (`ForecastGrid.tsx`, `CostForecasting.tsx`)
- [ ] 6.4 Verify + commit
- [ ] 6.5 ETC Details (`BulkEtcDetails.tsx`)
- [ ] 6.6 Verify + commit
- [ ] 6.7 Changes (`ChangeManagement.tsx`, `BulkChangeRecords.tsx`)
- [ ] 6.8 Verify + commit
- [ ] 6.9 Risk (`RiskManagement.tsx`, `BulkRiskRecords.tsx`)
- [ ] 6.10 Verify + commit
- [ ] 6.11 Subcontracts (`Subcontracts.tsx`, `BulkSubcontractItems.tsx`, etc.)
- [ ] 6.12 Verify + commit
- [ ] 6.13 Invoicing (`Invoicing.tsx`, `BulkSubcontractInvoices.tsx`, etc.)
- [ ] 6.14 Verify + commit
- [ ] 6.15 Progress (`ProgressTracking.tsx`, `BulkRulesOfCredit.tsx`, etc.)
- [ ] 6.16 Verify + commit
- [ ] 6.17 Procurement (`ProcurementProgress.tsx`, `ProcurementStepConfig.tsx`, etc.)
- [ ] 6.18 Verify + commit
- [ ] 6.19 Admin modules (`ProjectAdmin.tsx`, `EnterpriseAdmin.tsx`, `SystemAdmin.tsx`)
- [ ] 6.20 Verify + commit
- [ ] 6.21 Supporting components (`Header.tsx`, `Sidebar.tsx`, `UserProfile.tsx`, `CalendarManager.tsx`, `TimeSchedule.tsx`)
- [ ] 6.22 Verify + commit
- [ ] 6.23 `src/lib/audit.ts` → extract to port + adapter
- [ ] 6.24 `src/product/App.tsx` — final migration (auth + remaining Firestore)
- [ ] 6.25 Verify: zero `firebase/*` imports in `src/domain/` or `src/product/`

---

## Phase 7 — Chunk 6: Enforce Boundary

**Goal:** ESLint rule blocks firebase imports in domain/product. Zero violations.

- [ ] 7.1 Add ESLint + `eslint-plugin-import` (or `@typescript-eslint/eslint-plugin`)
- [ ] 7.2 Add `eslint.config.mjs` with `no-restricted-imports` rule for `firebase/*` in `src/domain/**` and `src/product/**`
- [ ] 7.3 Update `package.json`: rename `lint` → `type-check`; add `lint` = eslint script
- [ ] 7.4 Run `npm run lint` — zero violations expected
- [ ] 7.5 Run `npm run type-check` — zero errors
- [ ] 7.6 Version bump + commit: `chore: firebase import boundary lint rule`

---

## Phase 8 — Chunk 7: In-Memory Fake + CI

**Goal:** In-memory adapters prove the seam works. CI gates every push.

- [ ] 8.1 Implement in-memory adapters in `src/platform/memory/` (one per port)
- [ ] 8.2 Add `VITE_ADAPTER` env flag to composition root for adapter selection
- [ ] 8.3 **Acid test:** `VITE_ADAPTER=memory npm run dev` — app runs fully with zero Firebase calls
- [ ] 8.4 Add GitHub Actions CI: `npm run lint`, `npm run type-check`, `npm run test` on push
- [ ] 8.5 Version bump + commit: `test: in-memory adapters + GitHub Actions CI`

---

## Phase 9 — Chunk 8: UI Seam

**Goal:** Wrap grid + auth roles behind stable interfaces.

- [ ] 9.1 Create `src/product/components/ui/DataGrid.tsx` wrapping AG Grid — consistent API
- [ ] 9.2 Audit all AG Grid usages; migrate to `<DataGrid>` component
- [ ] 9.3 Replace hardcoded email-based role checks with `useAuth()` hook returning typed roles
- [ ] 9.4 Verify: `npm run build` passes; roles still work correctly
- [ ] 9.5 Version bump + commit: `refactor: DataGrid wrapper + auth role abstraction`

---

## Phase 10 — Merge Gate

**Goal:** Verify everything, get Tarek's sign-off, merge.

- [ ] 10.1 Run full acid test checklist (all items from the runbook Section 6)
- [ ] 10.2 `npm run lint` + `npm run type-check` + `npm run test` + `npm run build` — all green
- [ ] 10.3 Open PR: `refactor/platform-seam` → `main`
- [ ] 10.4 Tarek reviews port interfaces, calc engine outputs, overall structure
- [ ] 10.5 Address any Tarek review comments
- [ ] 10.6 Tarek merges
- [ ] 10.7 Tag: `seam-complete`
- [ ] 10.8 Delete `refactor/platform-seam` branch

---

## Post-Merge

- [ ] PM.1 Graduate Tarek to Claude Code (Bernard onboards first session)
- [ ] PM.2 Tarek confirms working on `main` via Claude Code
- [ ] PM.3 Plan Stage 2: PostgreSQL adapter (Supabase)

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| Phase 6 is the longest — 25+ components need migration | Commit per module; build must pass after each |
| Chunk 3 → Chunk 4 blocked on Tarek's review availability | Flag early; share draft interfaces with Tarek before formally opening the gate |
| `betaPertImpactAmount` is stored as derived value | Canonical formula goes to `src/domain/risk.ts`; Tarek verifies outputs match |
| No existing tests — calc logic could silently be wrong | Write tests against current behaviour first (Chunk 2), then refactor into domain |
| Univerjs and AG Grid both in use — DataGrid wrapper scope unclear | Start with AG Grid only in Chunk 8; Univerjs is a separate decision |


---

# Phase 11 — Foundation Uplift (post-seam)

**Basis:** SYSTEM_REVIEW.md (2026-07-09). Approach signed off: vertical slices + E2E-first;
pragmatic strictness (extract logic + tests now; defer 800-line/`any` cosmetic cleanup).

**Golden rule:** every slice ends committed, green, and shippable. E2E must stay green throughout
(behaviour is pinned, not changed). Unit tests are written when a pure function is extracted.

## Phase 11.0 — Safety net & harness (do first) — IN PROGRESS
- [x] 11.0.1 Added `npm run dev:memory` + Playwright `webServer`; baseURL → `http://localhost:5178`;
      live-creds specs moved to `tests/e2e/live/` (ignored unless `PLAYWRIGHT_INCLUDE_LIVE=1`)
- [x] 11.0.2 `seedMemory()` deterministic fixtures (demo-project, 2 cost codes with stored derived
      values AND matching leaves) wired via context.tsx under `VITE_ADAPTER=memory`
- [~] 11.0.3 Characterization E2E: boots on memory (no login) / Demo Enterprise / Demo Tower = PASS.
      Cost-codes module test = `test.fixme` (needs correct module route + money-value assertions)
- [ ] 11.0.4 Characterization E2E for: create/delete project, add actual cost, add change
- [ ] 11.0.5 Widen vitest coverage `include` beyond `src/domain/**`
- [x] 11.0.a **Completed `MemoryCostAdapter`** (sheets/forecast rows/get-list/batch ops) — memory
      adapter was missing these; acid test wasn't runnable before
- [ ] 11.0.b **Complete remaining memory adapters** (Change/Risk/Subcontract/Progress/Procurement/
      Schedule/Utility/UserRole have missing methods) — drive by running app on memory
- [ ] 11.0.6 GATE: `npm run test` + `npm run test:e2e` green on current code

## Phase 11.1 — Security rules (small, high value)
- [ ] 11.1.1 F2: `userRoles` write → `isSystemAdmin() || request.auth.uid == userId`; forbid self-set of `platformRole`
- [ ] 11.1.2 F3: enterprise-join rule must `get()` a matching pending `invitations` doc (email == token email), not trust diff shape
- [ ] 11.1.3 F11: scope `procurementStepDefinitions` to enterprise/project; F12: restrict `invitations` read to invited email + enterprise admins
- [ ] 11.1.4 Negative tests: non-invited user cannot add self to adminUsers; user cannot write another user's roles
- [ ] 11.1.5 GATE: legit E2E green, escalation blocked. Deploy rules. Commit: `fix(security): close authz holes`

## Phase 11.2 — Slice: Cost / EAC  (worst file + money-trust)
- [ ] 11.2.1 Create `src/domain/eac.ts`: canonical EAC / ETC / cost-variance from leaf inputs, with unit tests (100%)
- [ ] 11.2.2 Replace inline calc in CostCodes/ActualCost/BaselineBudget/dashboards with `eac.ts` calls; compute-on-read
- [ ] 11.2.3 Retire the stored derived fields as authoritative + remove "Recalculate All" (or make it a no-op/dev tool)
- [ ] 11.2.4 Fix F5: choose cost-code `id` as canonical FK; migration for children; delete "id OR code" matching
- [ ] 11.2.5 Extract grid config to `<DataGrid>` where CostCodes is concerned (adopt existing wrapper)
- [ ] 11.2.6 GATE: E2E cost report green (same numbers); unit tests green. Commit + JOURNAL.

## Phase 11.3 — Slice: Change management
- [ ] 11.3.1 Extract change roll-up (Change.budget/eac = sum of approved records) → domain, unit tests
- [ ] 11.3.2 Compute-on-read; remove stored-drift; align FK to cost-code id
- [ ] 11.3.3 GATE: E2E + units green. Commit + JOURNAL.

## Phase 11.4 — Slice: Risk
- [ ] 11.4.1 Wire `domain/risk.ts` betaPert at both write and read; extract exposure roll-up, unit tests
- [ ] 11.4.2 Compute-on-read for Risk.exposure / RiskRecord.betaPertImpactAmount
- [ ] 11.4.3 GATE. Commit + JOURNAL.

## Phase 11.5 — Slice: Subcontract / Invoice
- [ ] 11.5.1 Extract subcontract totals + invoice certification math → domain, unit tests
- [ ] 11.5.2 GATE. Commit + JOURNAL.

## Phase 11.6 — Slice: Progress
- [ ] 11.6.1 Wire `domain/phasing.ts` (kill the 4 inline duplicate copies); extract earned-value math, unit tests
- [ ] 11.6.2 GATE. Commit + JOURNAL.

## Phase 11.7 — Slice: Procurement
- [ ] 11.7.1 Confirm `domain/procurement.ts` is the only date engine; extract remaining inline logic, unit tests
- [ ] 11.7.2 GATE. Commit + JOURNAL.

## Phase 11.8 — Identity unification (cross-cutting)
- [ ] 11.8.1 Adopt `userRoles`/`roles.ts` as the single model; wire App.tsx to `useAuth()`
- [ ] 11.8.2 Rules read roles (custom claims or get()); remove hardcoded emails from client + rules
- [ ] 11.8.3 Reconcile role vocabularies (roles.ts vs Project.users type)
- [ ] 11.8.4 GATE: E2E for admin/non-admin flows green. Commit + JOURNAL.

## Deferred (pragmatic strictness — later pass)
- [ ] 11.9.1 Split any file still >800 lines into render-only shells
- [ ] 11.9.2 Eliminate remaining `: any` in touched components
- [ ] 11.9.3 Referential integrity: cascade/soft-delete for project & cost-code (fold in audit/fix scripts as a test)
- [ ] 11.9.4 Split god-documents (Enterprise/Project config arrays; ProgressItem snapshot vs working fields)

---

# STATUS CORRECTION (2026-07-11)

The Phase 11 checkboxes above are stale. Per git history and re-inspection (SYSTEM_REVIEW.md v2):
**done** — 11.3–11.8 domain slices (betaPert, progress, phasing, procurement, isPlatformAdmin
centralisation), 11.9.2 partial (`: any` in touched files), 11.9.3 partial (sheets/rows +
cost-code cascade only), F11/F12 rule fixes, F2 partial fix, eac.ts + tests (11.2.1), Phase 12
file splits, boundary ESLint, 177 unit tests, E2E suites.
**Still open** — F1 compute-on-read (9 Recalculate sites), F3 invitation hole, F5 id-OR-code
(11 sites), full cascade, hardcoded emails (4 sites), prompt()/alert() onboarding, CI.
Phase 13 below supersedes the remainder of Phase 11.

---

# Phase 13 — Stabilization Uplift (SYSTEM_REVIEW v2, 2026-07-11)

**Basis:** SYSTEM_REVIEW.md v2 Part 4. Goal: PoC/MVP → stable, robust, non-fragile system.
**Golden rule (unchanged):** every slice ends committed, green, shippable; E2E pins behaviour.

**Guiding principle:** target storage is Postgres (Supabase). Do now what is storage-agnostic or
protects users today (security, compute-on-read, onboarding, CI). Do minimally what Postgres
replaces (cascade, schema validation). Defer to the Postgres schema design what should be built
once (god-document splits, migration framework).

**⚠️ OPEN DECISION — platform timing (see §13.X):** whether Phases 13.B2/13.C are done on
Firestore at all, or folded into a Supabase migration that starts after 13.A/13.B1. Discuss with
Tarek before starting 13.B2.

## Phase 13.A — Close the security holes (~2 days) 🔴 FIRST
- [x] 13.A.1 (F3) `POST /api/accept-invite` on the existing Express server using `firebase-admin`:
      verify ID token → look up invitation by token → check pending + email match → add uid to
      enterprise membership + mark invitation accepted in one server-side batch (v1.0.87)
- [x] 13.A.2 (F3) Delete `isJoiningViaInvitation()` from firestore.rules; enterprise update becomes
      admin-only. Client `acceptInvitation` calls the API instead of writing Firestore directly (v1.0.87)
- [x] 13.A.3 (F2 residue) `userRoles` self-write may not change `platformRole` (split create/update;
      self-writes locked to `platformRole: null`, only isSystemAdmin() can grant) (v1.0.87)
- [ ] 13.A.4 (F7/F6) Firebase Auth custom claim `platformAdmin: true` via admin script; rules check
      `request.auth.token.platformAdmin == true`; delete email lists from firestore.rules,
      `hooks.ts:61`, `CostManagement.tsx:51`, `ProcurementManagementSubPane.tsx:33`
      — DEFERRED: needs a live admin-script run with real service-account creds + a rules deploy;
      not something to do unattended. Next slice, needs Bernard to execute.
- [ ] 13.A.5 (N2) Decide enterprise-create policy (self-serve vs platform-admin-only) with Tarek
      — DEFERRED: explicitly a decide-with-Tarek item, left unchanged pending that conversation.
- [x] 13.A.6 GATE: rules-emulator negative tests — non-invited user cannot self-add to adminUsers;
      user cannot self-grant platform_admin. `tests/security/firestore.rules.test.ts`, 7/7 passing
      via `npm run test:rules` (Firestore emulator; required installing Java via `brew install
      openjdk`). Commit: `fix(security): server-verified invite acceptance, lock platformRole
      self-grant (v1.0.87)`.
      **DEPLOYED 2026-07-11** — `firebase deploy --only firestore:rules --project
      gen-lang-client-0160759254` succeeded (Bernard's go-ahead). F3 and the F2 residue are now
      live. Still needs `FIREBASE_SERVICE_ACCOUNT_KEY` set in Vercel env vars or
      `/api/accept-invite` 500s in prod — invite acceptance is broken in prod until that's set.

## Phase 13.B — Make the numbers trustworthy (~1.5–2 wks) 🔴 CORE
### 13.B1 — Compute-on-read for financial roll-ups (storage-agnostic; do regardless of platform)
- [x] 13.B1.1 Inventory stored derived fields (v1.0.88 commit message). **Scope correction**: of the
      original "9 Recalculate sites," only 3 are genuine SSOT violations — CostCode roll-ups, Risk.exposure,
      Change.budget/eac. The other 6 (GlobalTimephasing/LineItemsPanel phasing regeneration,
      BulkSubcontractInvoiceItems % fill, ProcurementProgress calendar-driven date recalc,
      CostReportingPeriod's period-close snapshot) are legitimate explicit bulk transforms, not passively-stale
      derived reads — left alone, not touched by 13.B1.6.
      Also found: CostCodes.tsx has a *dead* `handleRecalculateAll` (line 170, never wired to any button,
      writes a stale field name) alongside the real live handler `calculateCosts` (line 1851, wired to the
      actual button at line 2476) — don't confuse the two when migrating.
- [x] 13.B1.2 `src/domain/rollups.ts` (new): `computeChangeRollup`, `computeCostCodeRollup` (delegates to
      existing `computePeriodEndFields` in eac.ts rather than reimplementing it — only adds
      `resolveEacSourceValue`, the per-eacMethod dispatch). `src/domain/risk.ts`: added `computeRiskRollup`.
      23 new unit tests, values cross-checked against the exact live inline arithmetic. (v1.0.88)
- [x] 13.B1.3 `src/domain/rollups.ts`: `aggregateCostCodeRollups(costCodes, leaves, period)` — pure leaf
      aggregation (id-or-code fallback preserved, tracks F5). `src/lib/costCodeRollups.ts` (new):
      `useCostCodeRollups(project, costCodes)` — thin React hook, subscribes to the 6 leaf collections,
      calls the domain function in a useMemo. 18 more unit tests on the pure aggregation function (no React
      testing library in this repo yet, so kept the hook itself free of logic worth testing in isolation).
      198/198 total unit tests, tsc clean. Not yet wired into any component. (v1.0.89)
- [x] 13.B1.4 Freeze switch with `cost-report.characterization.spec.ts`. **Unblocked**: exposed the AG Grid
      API on `window.__costCodesGridApi` in CostCodes.tsx onGridReady, gated to `VITE_ADAPTER === 'memory'`
      (never present in a real build) — reads exact cell values via `api.getCellValue()` instead of fighting
      virtualized DOM/scroll. Captured real seeded values by querying the live grid: Substructure
      500k/550k/200k/500k, Superstructure 400k/400k/100k/350k (baseline/approved/actual/EAC). (v1.0.90)
- [x] 13.B1.5 All three roll-up families migrated:
      - **CostCodes.tsx** (v1.0.91) — `useCostCodeRollups(project, costCodes)` merged onto row data
        (`costCodesWithRollups`); every column definition left unchanged, only the rowData source changed.
        Safe because baselineBudget/actualCostToDate/budgetChanges/approvedBudget(+mvmt)/
        estimateToComplete/costVariance(+mvmt) were already `editable: false`; only `estimateAtCompletion`
        is genuinely editable, gated to `eacMethod === 'Manual'` (a real leaf in that mode) — unaffected.
      - **RiskManagement.tsx** (v1.0.92) — `useRiskRollups(project.id, risks)` merged onto risks
        (`risksWithRollups`), also feeding the pinned-totals row and the visible "Total Exposure" header.
      - **ChangeManagement.tsx** (v1.0.93) — `useChangeRollups(project.id, changes)` merged onto changes
        (`changesWithRollups`), also feeding the period chart, pinned-totals row, and CSV export.
      CostReportingPeriod/Subcontracts/Invoices/Procurement intentionally untouched (see 13.B1.1 scope
      correction — those "Recalculate" sites were already legitimate bulk actions, not SSOT violations).
- [x] 13.B1.6 All 3 genuine roll-up write sites deleted:
      - CostCodes.tsx: `calculateCosts` (~130 lines, live handler) + dead `handleRecalculateAll` (never
        wired to any button, stale field name). Simplified `onCellValueChanged` — was force-rewriting all
        7 derived fields on every cell edit regardless of which field changed; now writes only the edited
        field.
      - RiskManagement.tsx + BulkRiskRecords.tsx: `updateParentTotals` (6 + 5 call sites respectively,
        including RiskRecordsPanel's manual "Recalculate" button — removed, meaningless now).
      - ChangeManagement.tsx + ChangeRecordsPanel + BulkChangeRecords.tsx: `updateParentTotals` (3 + 3 + 5
        call sites). Column-def factories (risk-management/columns.tsx, change-management/columns.tsx) no
        longer take an `updateParentTotals` dep for their delete-row actions.
      `periodSnapshots` untouched, still the only stored derived data (legitimate frozen snapshot).
- [x] 13.B1.7 GATE MET for all three: `cost-report.characterization.spec.ts` money values identical
      pre/post migration; full 47-test E2E suite green after each of the 3 migrations (incl.
      betaPert-formula-visible-in-grid and seeded-change-budget-visible tests); 203/203 unit tests; tsc/build
      clean throughout; boundary lint unchanged (7 pre-existing errors, none introduced). No manual/visual
      browser check was done beyond Playwright-driven — flagged explicitly since CostCodes is the app's
      primary financial screen. **F1 (SYSTEM_REVIEW.md) is now closed.**
### 13.B2 — Canonical cost-code FK (⚠️ subject to platform decision — throwaway if Supabase starts now)
- [x] 13.B2.1 (partial) `scripts/normalize-costcode-fk.ts` written and type-checked, NOT yet run against
      real data (session Bernard was away from his computer for — built the safe/local/reversible part
      only, per "check before affecting shared systems" when unsupervised). Re-scoped during
      investigation: re-grepping `costCodeId ===` found the true ambiguous-FK sites are narrower than the
      original "11 sites, 8 files" count — several matches were UI-selection-state comparisons
      (`selectedXCode === code.code`) or a `'_'` sentinel check, not FK ambiguity. The **real** ambiguity is
      exactly 4 collections: `actualCosts`, `baselineBudgets`, `changeRecords` (all `.costCodeId`), and
      `subcontracts[].lineItems[].costCodeId` (embedded array). `costPhasing` and `etcDetails` key by `code`
      consistently — a different convention, not a bug — left out of scope.
      Script defaults to **report-only** (dry run); requires an explicit `--apply` flag to write anything,
      and even then never auto-fixes orphaned records (costCodeId matching neither an id nor a code) —
      those are reported for manual review only. Batches writes in chunks of 400 (fixed a real bug caught
      before ever running: the first draft didn't actually split batches past Firestore's 500-write limit).
      **Next step (needs Bernard at his computer):** run report-only first —
      `npx tsx scripts/normalize-costcode-fk.ts --all-projects` — review the ambiguous/orphaned counts,
      then decide whether to `--apply`. If the report comes back near-zero, 13.B2.2 may barely matter and
      the Supabase-timing conversation (§13.X) becomes even less urgent to have first.
- [ ] 13.B2.2 Delete the id-or-code fallbacks (4 real sites: ActualCost.tsx, CostReportingPeriod.tsx x2,
      BaselineBudget.tsx, GlobalTimephasing.tsx, plus `sumByIdOrCode` in src/domain/rollups.ts) — match on
      id only. **Blocked on 13.B2.1's live data audit/fix actually running first** — removing the fallback
      before the data is normalized would silently break cost tracking for any still-ambiguous record
      (worse than the current state, not better).
- [ ] 13.B2.3 Rule + schema validation for `costCodeId`
- [ ] 13.B2.4 GATE: `grep -rn "costCodeId === .*||" src` = 0; audit script reports 0 ambiguous rows

## Phase 13.C — Data lifecycle integrity (~4 days) 🟠 (⚠️ subject to platform decision)
- [ ] 13.C.1 (F4) `PROJECT_CHILD_COLLECTIONS` registry in platform; `deleteProjectCascade` /
      `deleteCostCodeCascade` chunked batched deletes; audit scripts consume the same registry.
      GATE: delete seeded project → audit finds 0 orphans
- [ ] 13.C.2 (F14 minimal) Zod schema per collection in `src/domain/schemas/`; adapters parse on
      read (log+quarantine) and write (throw); seed script builds from schemas. No migration
      framework on Firestore — schemas become the Postgres DDL spec

## Phase 13.D — Onboarding & error surfaces (~3 days) 🟠 (storage-agnostic)
- [ ] 13.D.1 (F10) Real create/join-enterprise screen replacing `prompt()` (App.tsx:500); replace
      ~31 alert()/prompt() sites with shadcn toast/dialog; strip invite token from URL after
      consumption; surface bootstrapIfEmpty failures in UI
- [ ] 13.D.2 Top-level React error boundary

## Phase 13.E — Enforcement / CI (~1 day) 🟠 (do early — can precede B)
- [x] 13.E.1/13.E.3 `.github/workflows/ci.yml` (v1.0.96) — 3 parallel jobs on every push + PRs to main:
      `verify` (lint+test+build), `rules` (Firestore emulator, needs Java), `e2e` (47 Playwright tests
      against memory adapter, uploads HTML report artifact). Every command verified green locally first.
      **NOT YET PUSHED to the remote** — first-ever CI run should be watched by Bernard, not fired
      unsupervised. Live-Vercel E2E nightly still blocked on GitHub issue #4 (unchanged).
- [x] 13.E.2 `npm run lint` now runs `tsc --noEmit && eslint src` (was just an alias for type-check).
      Running it surfaced 5 pre-existing errors — stale `eslint-disable-line react-hooks/exhaustive-deps`
      comments referencing a rule that was never installed/registered in this project's eslint.config.js
      (so they were already no-ops, just triggering a "rule not found" error). Removed all 5, plus one
      similarly-stale `@typescript-eslint/no-explicit-any` disable in Header.tsx that ESLint itself flagged
      as unused. `npm run lint` now exits 0 with zero errors, zero warnings. (v1.0.95)
- [ ] 13.E.4 (N4) Repo hygiene: delete `* 2.*` Finder duplicates, organise loose scripts/docx, gitignore

## Phase 13.F — Continuous ratchets (ongoing, timeboxed)
- [ ] 13.F.1 File-size ratchet: split >800-line files only when already touching them (Phase-12 pattern)
- [ ] 13.F.2 `: any` ratchet: no-explicit-any as warn; record 764; CI fails if count rises
- [ ] 13.F.3 F8/F13 god-documents: DEFERRED to Postgres schema design

## §13.X — Platform decision (Firebase → Supabase/Postgres) — PENDING DISCUSSION
- Supabase **is** hosted Postgres — one migration, not two. Self-hosting later is trivial (pg_dump).
- The seam (12 ports, memory fakes) was built precisely to make this swap adapter-work.
- If migration starts after 13.A + 13.B1: skip 13.B2/13.C on Firestore (the SQL schema does FK
  normalisation, cascades, and validation natively) — saves ~1.5 wks of throwaway work.
- Needs Tarek's buy-in. Sequencing options and analysis: see discussion notes / SYSTEM_REVIEW v2 Part 4.
