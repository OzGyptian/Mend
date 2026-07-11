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
- [ ] 13.A.1 (F3) `POST /api/accept-invite` on the existing Express server using `firebase-admin`:
      verify ID token → look up invitation by token → check pending + email match → add uid to
      enterprise membership + mark invitation accepted in one server-side batch
- [ ] 13.A.2 (F3) Delete `isJoiningViaInvitation()` from firestore.rules; enterprise update becomes
      admin-only. Client `acceptInvitation` calls the API instead of writing Firestore directly
- [ ] 13.A.3 (F2 residue) `userRoles` self-write may not change `platformRole` (or make writes
      system-admin-only and move user prefs elsewhere)
- [ ] 13.A.4 (F7/F6) Firebase Auth custom claim `platformAdmin: true` via admin script; rules check
      `request.auth.token.platformAdmin == true`; delete email lists from firestore.rules,
      `hooks.ts:61`, `CostManagement.tsx:51`, `ProcurementManagementSubPane.tsx:33`
- [ ] 13.A.5 (N2) Decide enterprise-create policy (self-serve vs platform-admin-only) with Tarek
- [ ] 13.A.6 GATE: rules-emulator negative tests — non-invited user cannot self-add to adminUsers;
      user cannot self-grant platform_admin. `grep -r "guindy\|bernard.w.leung" src firestore.rules` = 0.
      Deploy rules. Commit: `fix(security): server-verified invites, custom-claim admin`

## Phase 13.B — Make the numbers trustworthy (~1.5–2 wks) 🔴 CORE
### 13.B1 — Compute-on-read for financial roll-ups (storage-agnostic; do regardless of platform)
- [ ] 13.B1.1 Inventory stored derived fields: CostCode roll-ups (+movements), Change.budget/eac,
      Risk.exposure, pinned betaPertImpactAmount
- [ ] 13.B1.2 Extend `src/domain/eac.ts` / new `src/domain/rollups.ts`: pure roll-up fns from leaves
      (actuals, budgets, etcDetails, changeRecords, riskRecords), unit tests — same pattern as
      `betaPertExposure`
- [ ] 13.B1.3 Selector hooks (`useCostCodeRollups(projectId)` etc.) subscribing to leaves via repos,
      computing at render; every screen calls the same hook
- [ ] 13.B1.4 Freeze switch with `cost-report.characterization.spec.ts` (capture → flip → assert)
- [ ] 13.B1.5 Migrate screen-by-screen: CostCodes → CostReportingPeriod → Risk →
      Subcontracts/Invoices → Procurement. One commit each
- [ ] 13.B1.6 Delete all 9 Recalculate sites; stop writing roll-ups to CostCode docs.
      `periodSnapshots` stays as the only stored derived data, labelled "as of {period}" everywhere
- [ ] 13.B1.7 GATE: edit an actual cost → every screen shows new EAC with no button press; no two
      screens can disagree. E2E green
### 13.B2 — Canonical cost-code FK (⚠️ subject to platform decision — throwaway if Supabase starts now)
- [ ] 13.B2.1 `scripts/normalize-costcode-fk.ts`: resolve code-string `costCodeId`s to doc ids across
      all child collections; report unresolvables. Run on backup/emulator, then live
- [ ] 13.B2.2 Delete all 11 `=== id || === code` fallbacks (8 files); match on id only
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
- [ ] 13.E.1 GitHub Actions on PR/push: type-check → vitest → lint:boundary → build
- [ ] 13.E.2 Fold `lint:boundary` into `npm run lint`
- [ ] 13.E.3 Memory-adapter E2E smoke in CI; live-Vercel E2E stays nightly (blocked on issue #4)
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
