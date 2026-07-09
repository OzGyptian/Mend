# Mend — Development Journal

---

## Session 5 — 2026-07-09 — Phase 11.0 complete + 11.1 security + 11.2 EAC domain

### What we set out to do

Complete Phase 11.0 (all E2E green on memory adapter), fix Phase 11.1 security rules, and
land Phase 11.2 (canonical EAC/cost domain).

### What was built / changed this session

**Phase 11.0 — complete (v1.0.66)**
- `MemoryScheduleAdapter`: renamed `subscribeCalendars` → `subscribeProjectCalendars`; added
  `subscribeEnterpriseCalendars`, `listEnterpriseCalendars`, `getCalendar`,
  `createManyScheduleItems`, `updateManyScheduleItems`
- `MemoryRiskAdapter`: added full `Risk` store + `subscribeRisks`, `listRisks`, `createRisk`,
  `updateRisk`, `deleteRisk`, bulk methods; added `listRiskRecords`, bulk record methods
- `MemoryProcurementAdapter`: replaced stub with full implementation (`subscribeProcurementItems`,
  create/update/delete/createMany/updateMany; step-definition CRUD)
- `cost-report.characterization.spec.ts`: fixed route (`/cost` not `/cost-codes`); un-fixme 4th test
- `tests/e2e/probe-modules.spec.ts`: smoke-tests 7 project module routes on memory — all pass
- **Result: 11/11 E2E passing (4 characterization + 7 probe)**

**Phase 11.1 — security rules (v1.0.67)**
- F11: `invitations` read restricted to enterprise admin or the invitee by email
- F3: `procurementStepDefinitions` read/write scoped to enterprise admin or project member
- F12: `userRoles` write restricted to `isSystemAdmin() || request.auth.uid == userId`
  (was open to any authenticated user)

**Phase 11.2 — EAC domain (v1.0.68)**
- `src/domain/eac.ts`: `computeApprovedBudget`, `computeCostVariance`, `computeEacEtc`,
  `computeMovement`, `computePeriodEndFields` — canonical formulas, no inline duplicates
- `src/domain/eac.test.ts`: 12 unit tests, all green
- `CostCodes.tsx` `onCellValueChanged`: replaced 20-line inline computation with single
  `computePeriodEndFields()` call

### State at end of session

- Branch: `refactor/platform-seam`
- Version: v1.0.68
- Type-check: green | Unit: 31/31 | E2E: 11/11

### Next session

1. Phase 11.3 — Change/risk roll-up slice: extract change/risk domain calcs + compute on read
2. Phase 11.4 — Subcontract slice
3. Phase 11.5 — Progress/procurement slice

---

## Session 4 — 2026-07-09 — System review + Phase 11.0 safety net (started)

### What we set out to do

Bernard asked for a first-principles technical + functional review of the whole system
(fragility felt during onboarding / add-delete project / seeding), then to plan and begin a
foundation-uplift refactor with a test safety net so we can increment without regressions.

### Decisions made this session

- **Full review written to `SYSTEM_REVIEW.md`** — data model, seam, security, value chains, and a
  separation-of-concerns analysis (91% of code lives in `src/components/`; 18 files >800 lines;
  CostCodes.tsx = 5,876). Verdict: seam is good; data model, stored-derived money, and 4 competing
  role models are the real fragility.
- **Approach signed off:** vertical slices (one domain at a time) + **E2E-first characterization**;
  pragmatic strictness (extract logic + tests now, defer 800-line/`any` cleanup). Recorded in
  `PLAN.md` Phase 11 and in agent memory (`foundation-uplift-approach`).
- **E2E must run against a LOCAL memory-adapter build** (deterministic), not the live Vercel URL.

### What was built / changed this session

- `playwright.config.ts` — repointed at local `http://localhost:5178`, added `webServer`
  (`npm run dev:memory`), moved live-creds specs to `tests/e2e/live/` (ignored unless
  `PLAYWRIGHT_INCLUDE_LIVE=1`).
- `package.json` — added `dev:memory` (`VITE_ADAPTER=memory vite --port 5178`).
- `src/platform/memory/MemoryAdapters.ts` — added `seedMemory()` deterministic fixtures
  (`demo-project` under `demo-enterprise`: 2 cost codes with stored derived values AND matching
  leaves so tests survive the 11.2 compute-on-read refactor). **Completed `MemoryCostAdapter`**
  (sheets, forecast rows, cost-code get/list, actuals/baseline batch ops, listCostPhasing) — the
  memory adapter was missing these, so the acid test was never actually runnable.
- `src/platform/firestore/context.tsx` — calls `seedMemory()` when `VITE_ADAPTER=memory`.
- `tests/e2e/memory.fixtures.ts` + `cost-report.characterization.spec.ts` — 3 passing tests
  (boots on memory, no login; Demo Enterprise present; Demo Tower project opens). 4th test
  (`test.fixme`) pending correct cost-codes module route.
- `.claude/settings.json` — added Bash allowlist (takes effect next session) to stop permission
  prompts during the refactor.

### KNOWN GAP found (important)

The memory adapters are **incomplete across most domains** (method diff showed many missing on
Change/Risk/Subcontract/Progress/Procurement/etc.). `MemoryCostAdapter` is now complete; the rest
must be filled in before their value chains can run on memory. This is Phase 11.0 work.

### Next session (friction-free once allowlist is active)

1. Confirm the cost-codes module route; un-`fixme` the 4th test; add money-value assertions
   (Substructure approvedBudget 550,000 / EAC 500,000 / variance 50,000).
2. Complete the remaining memory adapters (drive it by running the app on memory and fixing each
   missing-method crash the error boundary surfaces).
3. Then Phase 11.1 (security rules) → Phase 11.2 (Cost/EAC slice).

State: type-check green; `npx playwright test` = 3 passed, 1 fixme. Committed.

---

## Session 3 — 2026-07-05 — Chunk 8: UI Seam (Roles, Auth Port, DataGrid wrapper)

### What we set out to do

Complete Chunk 8 of the platform-seam refactor: wrap the UI layer with a typed role/auth system and create the DataGrid wrapper component.

### Decisions made this session

**Role hierarchy:** Chose a path-of-scopes design rather than hardcoded levels. `UserRoles` holds a `memberships: EnterpriseMembership[]` array so users can belong to multiple enterprises (consultants, cross-tenant access). Adding a Division or Business Unit level later is additive — no schema migration needed, just extend `EnterpriseMembership`.

**UUID for enterpriseId** (not slugs): stable forever; the display name changes, the identity doesn't.

**Roles use typed enums:** `PlatformRole`, `EnterpriseRole` (`enterprise_admin | enterprise_member`), `ProjectRole` (`project_admin | project_writer | project_reader | project_guest`). Platform admins implicitly have `enterprise_admin` in any enterprise — enforced in the hook, not stored redundantly.

**Claims minimal:** only `platformAdmin: bool` and `enterpriseId` in Firebase Auth custom claims. All complex role data in Firestore `userRoles/{uid}` — avoids the 1KB claim limit and keeps claims stable as role structure evolves.

**DataGrid wrapper:** created as a pattern for new components only; existing 37 AG Grid components NOT migrated. The lock-in argument is weak for AG Grid Enterprise specifically — the grids are the product. Wrapper value is consistent defaults and canonical import path.

**Multi-tenancy design discussion (Chunk 8b — not built yet):** Agreed on SaaS-class isolation model: structurally enforced at DB layer (Firestore security rules now, Postgres RLS later), not navigation hiding. Salesforce/O365-class thinking: Platform Admin → Enterprise Admin → Enterprise Member → Project Admin/Writer/Reader/Guest. SSO (SAML/OIDC) per enterprise tenant via Firebase Identity Platform. CMEK per tenant as upgrade path when paying enterprise customers require it.

**Agentic Autonomy Policy:** Read and noted. Policy is located at `/Users/bernardleung/Documents/Claude/Projects/Agentic_Autonomy_Deployment_Policy.md`. Dev branch = Level 3–4 autonomy (correct for this session). Merge gate = Level 1–2 (human sign-off required).

### What was built (v1.0.44)

- `src/domain/roles.ts` — role type hierarchy; `getProjectRole()` maps legacy `project.users` strings to typed `ProjectRole` without touching Firestore data
- `src/platform/ports/userRole.port.ts` — `UserRoleRepository` interface
- `src/platform/firestore/adapters/UserRoleAdapter.ts` — Firestore implementation; reads/writes `userRoles/{uid}`
- `src/platform/memory/MemoryAdapters.ts` — `MemoryUserRoleAdapter` added
- `src/platform/firestore/context.tsx` — `userRole` wired into `Platform` interface (both Firestore and memory paths)
- `src/platform/firestore/hooks.ts` — `useUserRoleRepo()`; `useAuth()` stateful hook with nested auth→roles subscription chain
- `src/components/ProgressReportingPeriod.tsx` — hardcoded email removed; replaced with `useAuth()` + `getProjectRole()`
- `src/components/ProgressTracking.tsx` — same
- `src/product/components/ui/DataGrid.tsx` — thin AG Grid wrapper with enforced defaults

Also: cleaned up 8 `" 2"` macOS duplicate files that were causing type-check failures.

### State at end of session

- Branch: `refactor/platform-seam`
- Version: v1.0.44
- Pushed to: `github.com/OzGyptian/Mend` (`5dac359..aa5cf30`)
- Type-check: passing, Tests: 19/19, Build: not re-run (no structural changes to app wiring)
- Working tree: clean

### What to do next

**Before testing in Vercel:**
- Seed `userRoles/{uid}` in Firestore console: `{ platformRole: "platform_admin", memberships: [{ enterpriseId: "<uuid>", role: "enterprise_admin", projectRoles: {} }] }` for your UID and Tarek's UID. Get UIDs from Firebase console → Authentication.

**Chunk 8b (separate session — needs Tarek alignment):**
- Firebase Auth custom claim: Cloud Function sets `{ platformAdmin, enterpriseId }` on login
- Firestore security rules enforcing `enterpriseId` isolation structurally (moves from app-layer to DB-layer)
- This is the thing that turns the multi-tenancy from "app filtering" to "structurally enforced"

**Merge gate (Section 6 of runbook):**
- Tarek reviews the full branch diff
- Behaviour-parity check: app runs identically in Firestore mode and memory mode
- Merge to main → Vercel deploy

---

## Session 2 — 2026-06-29 — Phases 1–4: Recon, Scaffold, Calc Engine, Ports (Continued)

### Phases completed this session

**Phase 1 — Chunk 0: Recon**
- Confirmed 26 Firestore collections from component grep
- Identified 4 types not in types.ts (ActualCostRecord, BaselineBudgetRecord, CostPhasingRecord, PeriodSnapshot) — all had inline interfaces in components
- Confirmed Gemini AI is zero-usage in src/ — AI Studio capability only
- ESLint is currently plain tsc; flat config (eslint.config.mjs) needed for boundary enforcement

**Phase 2 — Chunk 1: Scaffold (v1.0.1)**
- src/platform/firestore/firebase.ts — canonical Firebase init
- src/firebase.ts, src/types.ts, src/lib/procurementUtils.ts — re-export stubs
- src/domain/types.ts, src/domain/procurement.ts — canonical domain homes
- Build and type-check passing throughout; 37 components untouched

**Phase 3 — Chunk 2: Calc Engine (v1.0.2)**
- src/domain/phasing.ts — calculatePhasing (Even, Front, Back, Bell, S-Curve, Profile), dateToISO
- src/domain/risk.ts — betaPertImpact (min + 4×ML + max) / 6
- src/lib/utils.ts rewritten — imports from domain and re-exports; no duplicate implementations
- 19 tests passing; Firestore Timestamp branch in formatDate flagged as tech debt (comment)

**Phase 4 — Chunk 3: Port Interfaces (v1.0.3)**
- 11 port interface files: enterprise, project, cost, change, risk, subcontract, progress, procurement, schedule, utility, auth
- CostRepository covers 7 collections (costCodes, sheets, etcDetails, actualCosts, baselineBudgets, costPhasing + forecastRows)
- 4 previously-inline types promoted to src/domain/types.ts
- All interfaces: no firebase/* types, dates are ISO strings, subscribe() returns () => void

### Decisions made this session

- **costPhasing interface**: The type is `any[]` in CostCodes.tsx with only `costCodeId` visible in component code. Defined `CostPhasingRecord` with `periodValues: Record<string, number>` as the best inference; marked for finalisation in Phase 6 when CostCodes.tsx is migrated
- **PeriodSnapshot**: Write-only collection in CostReportingPeriod.tsx. Defined shape from observable writes (projectId, periodId, periodName, costCodes array). Only `batchCreatePeriodSnapshots` needed.
- **ProcurementRepository scope**: `subscribeStepDefinitions` takes `{projectId?, enterpriseId?}` scope to support both project-level and enterprise-level step definitions observed in components
- **Auth port**: Includes Google OAuth, email/password, email verification, and state change subscription — matching all auth patterns in App.tsx

### State at end of session

- Branch: `refactor/platform-seam`
- Version: v1.0.3
- Clean working tree, all committed
- Type-check: passing, Tests: 19/19, Build: passing
- **Waiting on Tarek to review port interfaces before Phase 5 begins**

### Next steps (Phase 5 — Firestore Adapters)

1. Implement each port interface with a Firestore adapter class
2. Start with EnterpriseRepository (simplest) to validate the pattern
3. Use the adapter pattern: class implements the port interface, internal methods call Firestore
4. Wire to React via hooks in src/platform/firestore/hooks/
5. DO NOT touch any component until all adapters are ready

---

## Session 1 — 2026-06-29 — Phase 0: Pre-flight & Operating Setup

### What we set out to do

Set up the operating model for the Mend refactor. Clone the repo, verify the baseline, and create all operating files before touching any product code.

### What was built

**Operating files (no product code changes):**
- `CLAUDE.md` — project overview, architecture, refactor goal, coding conventions, dev commands, session checklist, PR workflow
- `PLAN.md` — full phased backlog (Phases 0–10 + post-merge)
- `JOURNAL.md` — this file
- `.claude/settings.json` — PostToolUse hooks (type-check on every Write/Edit)

**Recon findings (Chunk 0 partial — read-only):**

Codebase is a construction project cost management tool. Key findings:

1. **Firebase scope:** 41 files import from `firebase/*` — 37 `src/components/*.tsx` + `App.tsx` + `firebase.ts` + `lib/audit.ts` + `lib/errorHandlers.ts`. All are client-side. `server.ts` is Firebase-free.

2. **No ESLint configured.** `npm run lint` = `tsc --noEmit` (TypeScript only). ESLint will be added in Phase 7 (Chunk 6).

3. **No test framework.** No Vitest/Jest configured. Need to add Vitest before Chunk 2 (Chunk 2 requires TDD).

4. **Two grid libraries in use:** AG Grid 35 Enterprise (primary) and Univerjs (spreadsheet-style in 2 components). Both are present; Chunk 8 wraps AG Grid.

5. **Server is thin:** Express + Vite middleware. One API route (`POST /api/invite`) for email invitations via Resend. No Firestore server-side.

6. **Gemini AI in use:** `@google/genai` is a runtime dependency. Location of AI calls not yet mapped — add to Chunk 0 recon.

7. **Calculation logic found:**
   - `src/lib/utils.ts` — phasing/distribution calculations (Even, Bell, Front/Back load, S-Curve, Profile). **Also contains `formatDate()` which calls `.toDate()` — leaking Firestore Timestamp type** into a utility function. This needs to be split in Phase 2.
   - `src/lib/procurementUtils.ts` — working-day/calendar date arithmetic (nearly pure). Moves to `src/domain/procurement.ts`.
   - `betaPertImpactAmount` on `RiskRecord` type is a stored derived value — formula is `(Min + 4×ML + Max) / 6`. Canonical function needed in `src/domain/risk.ts`.

8. **Baseline build:** `npm install` + `npm run build` — **PASSES** on clean clone. Green baseline confirmed.

9. **`src/types.ts` is mixed domain + storage:** Type comments reference "Firestore Doc ID" throughout. The types themselves are usable as domain types once comments are cleaned; they stay in `src/domain/types.ts` post-move.

### Decisions made

- Clone location: `/Users/bernardleung/Documents/Claude/Projects/MendApp/` ✓
- All 9 phases (including Chunk 8 UI seam) are in scope ✓
- Operating model: identical to WWTXSales (session checklist, requirements-first, incremental commits with version bumps, PLAN.md In Progress sections, journal every session)

### State at end of session

- Branch: `main` · v1.0.0 (no version bump — no product code changes)
- Operating files committed (P0.4–P0.6 in PLAN.md)
- Baseline build: passing
- Type-check: passing

---

## Session 6 — Phase 11.3–11.8 (Foundation Uplift slices)

### What was done

Phase 11.3 — Risk domain: added `betaPertExposure(min, ml, max, prob)` to `src/domain/risk.ts`. Replaced 6 inline `((min + 4 * ml + max) / 6) * prob` copies in RiskManagement.tsx and BulkRiskRecords.tsx. Fixed `listRiskRecords` to accept optional `riskId` filter in MemoryRiskAdapter. 34/34 unit tests, 11/11 E2E. v1.0.69.

Phase 11.4 — SSOT for betaPertImpactAmount: `updateParentTotals` in RiskManagement.tsx and BulkRiskRecords.tsx now re-derives from leaf fields (`min`, `mostLikely`, `max`, `probability`) using `betaPertExposure()` instead of reading the stored `betaPertImpactAmount`. Pinned totals row also computes live. v1.0.70.

Phase 11.5 — Progress domain: new `src/domain/progress.ts` with `rocPercentComplete`, `earnedQty`, `overallPercentComplete`. 11 unit tests. Replaced all 9 inline Rule-of-Credit weighted-sum reduces in ProgressTracking.tsx and 1 in ProgressReportingPeriod.tsx. 45/45 unit, 11/11 E2E. v1.0.71.

Phase 11.6 — Phasing domain wiring: `CostCodes.tsx` and `GlobalTimephasing.tsx` each defined a ~65-line `useCallback` copy of `calculatePhasing`. Both deleted; now import from `domain/phasing`. BulkEtcDetails retains its working-days-aware variant (legitimately different). v1.0.72.

Phase 11.7 — Procurement domain: replaced 8-line inline `isWorkingDay` closures in CostCodes.tsx and BulkEtcDetails.tsx with 1-liner wrapping `domain/procurement.isWorkingDay`. ProcurementProgress.tsx now imports directly from domain (not via stub). v1.0.73.

Phase 11.8 — Identity unification: `hooks.ts isPlatformAdmin` is now the single source of truth (roles.platformRole OR system-owner emails). App.tsx and 5 sub-pane components (Change, Progress, Subcontract, Risk, Sidebar) replaced 6 inline email comparisons with `useAuth().isPlatformAdmin`. v1.0.74.

### Deferred (pragmatic)
- Phase 11.9: file >800-line splits, remaining `: any` cleanup, referential integrity cascade, god-document splits
- BulkEtcDetails working-days phasing is legitimately different from domain/phasing — not unified

### State at end of session
- Branch: `refactor/platform-seam` · v1.0.74
- 45/45 unit tests, 11/11 E2E passing
- All planned Phase 11.x foundation-uplift slices complete

### What to do next
1. Phase 11.9 deferred items (optional — can ship without)
2. Full acid test: `VITE_ADAPTER=memory npm run dev` full manual smoke
3. Draft PR: `refactor/platform-seam` → `main`, Tarek review

### What to do next (start of Session 2)

1. **P0.7 — Add Vitest** (needed before Phase 3 can run TDD). Install `vitest` + `@vitest/ui`, add `test` script to `package.json`, add `vitest.config.ts`.
2. **P0.8 — Commit operating files** to `main` (this session's work, including Vitest setup).
3. **Create branch `refactor/platform-seam`**.
4. **Phase 1 — Complete Chunk 0 recon:** Map Gemini AI usage, confirm all Firestore collection names, confirm auth patterns, finalise folder structure proposal for Bernard's approval.
5. Then **Phase 2 — Chunk 1: Scaffold & Move**.
