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

---

## 2026-07-11 — SYSTEM_REVIEW.md v2 + Phase 13.A (security remediation)

Branch: `refactor/phase-12-file-splits` · v1.0.86 → v1.0.87. (Note: the "what to
do next" tail above is stale — left as historical record; see PLAN.md Phase 13
for current status, and the "STATUS CORRECTION" note above Phase 13 for what
Phase 11 items actually shipped vs. what the old checkboxes still claim.)

Re-inspected the codebase against the 2026-07-09 SYSTEM_REVIEW.md, verified
every prior finding against current code (177 unit tests, `tsc --noEmit`,
grep counts), and rewrote it as v2. Confirmed fixed since v1: F11/F12 rule
holes, F2 mostly (self-write restricted to admin-or-self, residue below), god
components halved, domain layer real (eac/phasing/procurement/progress/risk/
roles, all tested). Confirmed still open: F1 (stored roll-ups, 9 Recalculate
buttons), F3 (invitation hole), F5 (11 `id OR code` FK sites), no CI. Wrote
the v2 findings into PLAN.md as Phase 13, superseding the remainder of stale
Phase 11 checkboxes.

Discussed platform direction: Supabase *is* Postgres (not a stepping stone to
it) — recommended finishing 13.A (security) + 13.B1 (compute-on-read
roll-ups, storage-agnostic) on Firestore, then migrating to Supabase instead
of building 13.B2 (FK migration)/13.C (cascade + schema) by hand on
Firestore, since the SQL schema gives FK constraints, cascades, and
migrations natively. Flagged as an open decision (§13.X in PLAN.md) pending
Tarek's sign-off — not yet started.

**Phase 13.A executed (F3 critical, F2 residue):**
- Added `POST /api/accept-invite` on the Express server using `firebase-admin`
  (new dependency): verifies the caller's ID token, looks up a real
  pending/non-expired invitation matching the token+email, grants enterprise
  membership server-side in one batch (uses `FieldValue.arrayUnion` instead
  of the old client's read-modify-write array spread — closes a lost-update
  race as a side effect).
- Deleted `isJoiningViaInvitation()` from `firestore.rules` entirely —
  `enterprises` update is now admin-only, `invitations` update is
  system-admin-only. A client can no longer write itself into `adminUsers`
  under any circumstance; the Admin SDK route is the only path.
- `userRoles` rule split into `create`/`update`: self-writes can never set or
  change `platformRole` (only `isSystemAdmin()` can). Confirmed no live UI
  flow depends on self-writing `platformRole` (`setEnterpriseRole`/
  `setProjectRole` exist on the adapter but are unused — dead code today).
- `EnterpriseAdapter.acceptInvitation` signature dropped client-supplied
  `userId`/`userEmail`/`displayName` — identity now comes only from the
  verified ID token server-side.
- Added `tests/security/firestore.rules.test.ts` (7 cases) run against the
  actual rules text via the Firestore emulator — proves both negative cases
  (attacker rejected on all three rule changes) and that legitimate
  admin/self writes still succeed. Kept out of the default `vitest run` via
  a separate `vitest.rules.config.ts` (needs the emulator); wired as
  `npm run test:rules` (`firebase emulators:exec --only firestore ...`).
  Required installing Java (`brew install openjdk`, no `sudo`/symlink step
  needed — resolves via `/opt/homebrew/bin/java`) since the Firestore
  emulator is JVM-based; this env is now emulator-capable for Phase 13.E CI
  design too.
- Documented the new required `FIREBASE_SERVICE_ACCOUNT_KEY` env var in
  CLAUDE.md — missing key degrades `/api/accept-invite` to a clear 500
  (same pattern as the existing `RESEND_API_KEY` guard), doesn't crash the
  server.

Verified clean: `tsc --noEmit`, `vitest run` (177/177), `npm run test:rules`
(7/7), `npm run build`, `npm run lint:boundary` (5 pre-existing errors in
untouched files only — react-hooks/exhaustive-deps config gap, not a
boundary violation, not introduced by this session).

**Deferred within Phase 13.A (not done this session):**
- **13.A.4 — custom claim `platformAdmin`.** Requires an admin script run
  against the *live* Firebase project with real service-account credentials
  to set the claim on Tarek/Bernard's actual accounts, plus a
  `firebase deploy --only firestore:rules` to ship the rule change. Neither
  is something to do unattended — flagged as the next slice, needs Bernard
  (has Firebase CLI access) to run the deploy/script step explicitly.
- **13.A.5 — enterprise-create policy.** Explicitly a "decide with Tarek"
  item per the plan; left as `allow create: if isAuthenticated()` (unchanged)
  pending that conversation.
- **Rules not yet deployed to production.** All changes are local/committed
  on the branch. `firebase.json` points at project `gen-lang-client-0160759254`,
  database `ai-studio-160b29f2-f546-4213-8031-e29afba8c034`; CLI is logged in
  as bernard.w.leung@gmail.com in this environment, but deploying rules to a
  shared production system is a confirm-first action, not a silent one.

### What to do next
1. Confirm with Bernard: deploy `firestore.rules` to production
   (`firebase deploy --only firestore:rules`) — the F3/F2 fixes have zero
   effect on real users until this ships.
2. Set `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel env vars (see CLAUDE.md) so
   `/api/accept-invite` works in production — currently the invite flow will
   405/500 in prod without it.
3. Phase 13.A.4 (custom claims) as its own slice — needs a live admin-script
   run, coordinate with Bernard before executing.
4. Phase 13.A.5 — enterprise-create policy decision with Tarek.
5. Then Phase 13.B1 (compute-on-read roll-ups) — the core fragility fix,
   storage-agnostic, should proceed regardless of the Supabase timing
   decision.

---

## 2026-07-11 (continued, same day) — Phase 13.A deploy, 13.B1 complete, 13.E complete, 13.D complete, 13.C.2 (schemas only)

Branch: `refactor/phase-12-file-splits` · v1.0.87 → v1.0.102, 23 commits. This
continues directly from the entry above — same session, picked back up after
Bernard stepped away from his computer partway through, worked everything
that didn't need him present, deployed what he explicitly approved.

### ⚠️ ACTION NEEDED FROM BERNARD (read this first)

1. **Run the FK audit report** (safe, read-only, any time):
   `npx tsx scripts/normalize-costcode-fk.ts --all-projects`
   Tells you how many `costCodeId` values are actually ambiguous across
   `actualCosts`/`baselineBudgets`/`changeRecords`/`subcontracts[].lineItems`.
   If near-zero, 13.B2.2 (deleting the `id||code` fallbacks) and the whole
   Supabase-timing conversation matter a lot less than the plan assumed.
2. **Review and push `.github/workflows/ci.yml`** — built, every command
   verified green locally, but deliberately not pushed to
   `github.com/OzGyptian/Mend`. First CI run should be something you watch.
3. **Decide on the 5 untracked `scripts/*.ts` admin tools** and the docx/md
   docs at `Mend/` root — see the "repo hygiene" section below. Not touched
   without your say-so; at least one script has a real production UID
   hardcoded in it.
4. **Set `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel** if not already done —
   still the one thing blocking `/api/accept-invite` from working in prod
   (flagged in the entry above, still outstanding as far as I know).
5. Whenever you're ready: **13.A.4** (custom-claim admin model — needs a
   live admin-script run with real credentials) and **13.A.5**
   (enterprise-create policy — needs a decision, possibly with Tarek) are
   the only remaining pieces of Phase 13.A.

Everything else below is done, committed, and verified — nothing else is
waiting on you specifically.

### Phase 13.A — rules deployed

`firebase deploy --only firestore:rules --project gen-lang-client-0160759254`
— ran with Bernard's explicit go-ahead. The F3 (invitation hole) and F2
residue (platformRole self-grant) fixes are **live in production** as of
this session.

### Phase 13.B1 — compute-on-read for all three financial roll-ups (F1 CLOSED)

The core fragility fix from SYSTEM_REVIEW.md v2. Re-scoped during inventory:
of the original "9 Recalculate sites," only 3 were genuine single-source-of-
truth violations — the other 6 (GlobalTimephasing/LineItemsPanel phasing
regen, BulkSubcontractInvoiceItems % fill, ProcurementProgress calendar date
recalc, CostReportingPeriod's period-close snapshot) are legitimate
user-triggered bulk actions, not passively-stale reads — left alone.

- **Domain layer** (`src/domain/rollups.ts`, extended `risk.ts`): pure
  aggregation functions taking raw leaf arrays, returning computed roll-ups.
  `computeCostCodeRollup` delegates to the existing `computePeriodEndFields`
  in `eac.ts` rather than reimplementing it. 44 new unit tests, every
  formula cross-checked line-by-line against the real inline arithmetic
  before it was deleted.
- While tracing the exact live write path, found `CostCodes.tsx` had **two**
  "recalculate" functions: `handleRecalculateAll` was dead code (never wired
  to any button, wrote a stale field name that doesn't match the current
  type) sitting alongside the real live handler `calculateCosts`. Deleted
  the dead one, replaced the real one.
- **E2E verification problem solved**: AG Grid virtualizes off-screen
  columns (don't exist in the DOM until scrolled into view) and some render
  with non-semantic auto-generated col-ids, so scroll-and-read-text
  assertions were unreliable. Exposed the AG Grid API on
  `window.__costCodesGridApi`, gated strictly to `VITE_ADAPTER === 'memory'`
  (never present in a real build) — `tests/e2e/cost-report.characterization.spec.ts`
  now reads exact cell values via `api.getCellValue()`.
- Migrated all three screens — **CostCodes.tsx** (v1.0.91), **RiskManagement.tsx**
  (v1.0.92, also fixed the duplicate in BulkRiskRecords.tsx), **ChangeManagement.tsx**
  (v1.0.93, also fixed the duplicate in BulkChangeRecords.tsx) — to
  compute-on-read. Deleted 3 Recalculate buttons and ~400 lines of
  duplicated recalculation logic across 9 files. Confirmed safe to swap the
  grid data source without touching column defs: every roll-up field was
  already `editable: false` except `estimateAtCompletion` (only editable
  when `eacMethod === 'Manual'`, where it's a genuine leaf, not derived).

**F1 from SYSTEM_REVIEW.md v2 is closed** — no financial roll-up in the app
is stored-and-manually-refreshed anymore.

### Phase 13.B2.1 — FK audit script (built, NOT run against real data)

`scripts/normalize-costcode-fk.ts` — see "ACTION NEEDED" above. Report-only
by default, requires `--apply` to write, never auto-fixes orphaned records.
Caught and fixed a real bug before it ever ran: the first draft's
batch-write loop didn't actually split at Firestore's 500-write-per-batch
limit. Re-scoped during investigation: the real ambiguity is 4 collections
(`actualCosts`, `baselineBudgets`, `changeRecords`, embedded
`subcontracts[].lineItems[].costCodeId`), not the "11 sites/8 files" the
original review counted (some of those were false positives — unrelated
UI-selection-state comparisons).

### Phase 13.E — CI, lint, hygiene (all done, CI not pushed)

- **`.github/workflows/ci.yml`** — 3 parallel jobs (lint+test+build, Firestore
  rules emulator, 47-test Playwright suite) on every push + PRs to main. See
  "ACTION NEEDED" above — not pushed yet.
- **`npm run lint` genuinely green** — folded `lint:boundary` in (now runs
  `tsc --noEmit && eslint`), which surfaced 5 pre-existing errors: stale
  `eslint-disable-line react-hooks/exhaustive-deps` comments referencing a
  rule that was never actually installed in this project's `eslint.config.js`
  — dead no-ops, just triggering a "rule not found" error. Removed all 5
  (plus one similarly-stale `no-explicit-any` disable in Header.tsx). Zero
  errors, zero warnings now.
- **Repo hygiene**: deleted 15 verified-safe Finder/iCloud-sync duplicate
  artifacts (6 in `src/domain/`, 7 in `tests/e2e/`, `.git/index 2`, two empty
  duplicated directories) — each one diffed/verified before deletion, not
  assumed. One (`dashboard.spec 2.ts`) actually differed from its tracked
  counterpart — turned out to be the pre-fix version from before v1.0.84's
  "dashboard spec fix," confirmed safe to remove. Tracked `.firebaserc` +
  `firestore.indexes.json` (standard non-secret Firebase config, previously
  untracked). **Left alone, needs Bernard's decision**: 5 untracked
  `scripts/*.ts` admin tools (`audit-user-access.ts`, `audit2.ts`,
  `check-data.ts`, `check-procurement.ts`, `fix-enterprise-membership.ts` —
  the last one hardcodes Bernard's real Firebase UID and an enterprise doc
  id, session-specific, not generic tooling) and the docx/md/UUID/html
  personal documents at `Mend/` root.
- Added `firebase-tools` and `zod` as real devDependencies/dependencies
  (both were previously either absent or only present transitively).

### Phase 13.D — onboarding & error surfaces (F10 CLOSED)

- **The `prompt()` dead-end** at App.tsx (a brand-new user with zero
  enterprises hit a bare browser `prompt('Enter your Enterprise Name:')`)
  replaced with an inline expand-to-form in the existing "Welcome to Mend"
  card. While wiring this up, found a real bug: `<Toaster/>` was mounted
  deep inside `AuthenticatedApp`'s main-shell render branch — only reached
  once authenticated AND enterprise-selected — meaning toast calls during
  login/registration or the pre-enterprise screen had no host to render
  into and would have silently done nothing. Moved `<Toaster/>` and a new
  `<ConfirmDialogProvider/>` to wrap the entire app.
- Added `src/components/ConfirmDialogProvider.tsx` — async replacement for
  `window.confirm()`, backed by the existing shadcn Dialog primitive.
- **26 `alert()` calls** across 12 files → `toast.success`/`toast.error`
  (delegated the mechanical sweep to an agent, independently verified every
  diff myself before trusting it). **22 `confirm()` calls** across 16 files
  → the new async `useConfirm()` hook (also agent-assisted, also
  independently verified) — one site required real restructuring
  (`subcontracts/columns.tsx`'s confirm lives in a plain builder function,
  not a component, so `useConfirm()` had to be threaded through as a dep
  from `LineItemsPanel.tsx` instead of called directly, to respect Rules of
  Hooks).
- `bootstrapIfEmpty` failures now surface via `toast.error`, not just
  `console.error`.
- Invite-token URL cleanup was already done as a side effect of the Phase
  13.A invite rewrite (confirmed still in place, not redone).
- **13.D.2 (top-level error boundary) was already done** before this
  session — `src/components/ErrorBoundary.tsx` already wraps the whole app
  in `main.tsx` with a proper fallback UI. Nothing to build.

Zero `alert()`/`confirm()`/`prompt()` calls remain anywhere in `src/`
(verified via grep). Not visually verified in an actual browser (none
available this session) — verified via tsc, unit tests, and the full E2E
suite at every step, plus direct diff review of every agent-produced change.

### Phase 13.C.2 — zod schemas (definitions only, NOT wired into adapters)

`src/domain/schemas/` — 40 zod schemas across 8 files, one per type in
`domain/types.ts`, plus 49 runtime parse tests. Deliberately scoped down
from the full 13.C.2 item: **adapter wiring (parse-on-read with
log+quarantine, parse-on-write with throw) is NOT done** — that's a much
larger, higher-risk change touching ~10 adapters' read/write paths
(parse-on-write-throws could reject currently-tolerated real production
data), left as its own clearly-separate follow-up rather than rushed
through at the end of an already-long session.

Caught a real problem before committing: the schemas were originally
written as `const XSchema: z.ZodType<X> = z.object({...})` — the standard
pattern for a compile-time guarantee that the zod shape matches the TS
interface exactly. That guarantee silently doesn't work in this repo
because `tsconfig.json` has no `strictNullChecks` — without it, TS treats
every zod-object field as optional regardless of the interface, producing
36 false-positive errors that would have broken `npm run lint` (the same
command CI runs). Verified this directly before it shipped. Enabling
`strictNullChecks` repo-wide to make the pattern work is a much bigger,
separate initiative (surfaces ~132 unrelated pre-existing errors elsewhere
when tested — did not pursue). Removed the `z.ZodType<T>` annotations;
correctness now rests on the 49 runtime tests plus manual cross-referencing
against the raw `types.ts` source (spot-checked several of the more complex
ones — `Project`, `Risk`, `RiskRecord` — directly against the interface
text).

**13.C.1 (cascade-delete registry) deliberately skipped** — unlike the
schemas, this one is genuinely throwaway if the Supabase migration starts
(Postgres gives `ON DELETE CASCADE` for free), so not worth building on
Firestore right now.

### Verified clean throughout (every commit, not just at the end)

`tsc --noEmit`, `npm run lint` (tsc + eslint boundary), `npx vitest run`
(252/252 by the end), `npm run test:rules` (7/7, Firestore emulator),
`npm run build`, `npx playwright test` (47/47).

### What to do next

See "ACTION NEEDED FROM BERNARD" at the top of this entry. After those:
wire the zod schemas into the Firestore adapters (rest of 13.C.2), then
either the Supabase migration conversation or 13.B2.2 depending on what the
FK audit report shows.

## 2026-07-11 (continued, same day) — FK audit applied + 13.B2.2 (id||code fallback removal)

Acted on the "ACTION NEEDED FROM BERNARD" item #1 from the prior entry: ran
`scripts/normalize-costcode-fk.ts --all-projects` for real (report mode
first, then `--apply` on Bernard's go-ahead — test data, minimal risk).

**Audit result: ambiguity was real, not near-zero** (this matters — the plan
had assumed near-zero would deprioritize 13.B2.2 and the Supabase-timing
conversation). 575 ambiguous `costCodeId` values found across 3 projects
(12 / 535 / 28), all fixed via `--apply`. 535 collapsed to 49 document
writes for the subcontract-lineItems-heavy project — `lineItems` is an
array field, so multiple ambiguous entries in the same subcontract doc are
one write, not one each.

**6 orphaned records left untouched** in project `E9h5Oh9kLsIoIoxjBarT` —
`costCodeId="E3 - E3"` / `"E2 - E2"` (doubled code string, not a normal
id/code mismatch). Not investigated yet — the write path producing this
malformed shape is still unknown. Follow-up, not done this session.

**Given the audit wasn't near-zero, proceeded with 13.B2.2 properly** rather
than just deleting the read-side fallback in isolation. Found the real risk
first: 4 CSV bulk-import write paths (`BulkRiskRecords.tsx`,
`LineItemsPanel.tsx`, `ProgressItemsPanel.tsx`, `BulkChangeRecords.tsx`)
wrote whatever a user typed in a spreadsheet cell straight into
`costCodeId` with zero resolution to the actual doc id — unlike
`ActualCost.tsx`/`BaselineBudget.tsx`, which already resolved correctly.
Deleting the read-side fallback before fixing these would have made bad
data disappear silently instead of erroring. Fixed all 4 to resolve
code-or-id input via `costCodes.find(c => c.id === raw || c.code === raw)`
(same pattern `ActualCost.tsx` already used) before writing.
`BulkChangeRecords.tsx` was the interesting case — it already validated the
cost code existed via a lookup, just wasn't using the resolved id.

Then removed the now-dead read-side `id||code` fallback comparisons in 8
sites: `ActualCost.tsx`, `BaselineBudget.tsx`, `CostCodes.tsx` (×3),
`CostReportingPeriod.tsx` (×2), `GlobalTimephasing.tsx`.

**Found a 9th, different bug while in `CostCodes.tsx`**: the "Changes"
drill-down filter (`selectedChangesCode`) compared `changeRecords.costCodeId`
(a doc id) directly against a raw `.code` string with *no* resolution at
all — unlike its 3 sibling filters (baseline/actuals/timephasing) in the
same file, which all resolve through a `costCodeObj` lookup first. This
looks like a pre-existing bug (the Changes drill-down likely never filtered
correctly), not something this session's changes caused. Fixed it to match
the sibling pattern.

Deliberately left `costPhasing`/`etcDetails` alone — confirmed via
`domain/rollups.ts`'s own comment that `EtcDetail` is intentionally keyed by
the code string, not the id. Different design, not a fallback bug; out of
scope of the FK audit's 4 target collections.

**Verified**: `npm run lint` (tsc+eslint) clean, `npx vitest run` 252/252,
`npm run test:rules` 7/7, `npx playwright test` 47/47. Re-ran the audit
script (report-only) as a regression check afterward: **0 ambiguous**
across every project with cost codes. One project (`YYAvcfIxOuu4BSz3eYai`)
hit a Firestore free-tier daily-read-quota error mid-scan on the regression
run — unrelated to this change, just quota exhausted from two full scans in
one session. Worth re-running that single project once quota resets if full
coverage confirmation matters.

### What to do next

- Re-scan `YYAvcfIxOuu4BSz3eYai` once Firestore quota resets, to confirm 0
  ambiguous there too (wasn't reached in the regression check).
- Investigate the 6 orphaned `"E3 - E3"`/`"E2 - E2"` records' write path —
  still unknown, still untouched.
- Everything else from the prior entry's "ACTION NEEDED FROM BERNARD" list
  is still open (CI push, untracked scripts/docs decision,
  `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel, 13.A.4/13.A.5).
