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

## 2026-07-11 (continued, same day #2) — root cause of the orphan bug found and fixed

Continued from the FK audit session. Went looking for the write path
producing the `"E3 - E3"` / `"E2 - E2"` orphaned records and found something
bigger than expected: the actual root cause of most of today's ambiguity,
not just the orphan pattern.

**Root cause:** `src/components/subcontracts/columns.tsx` had two AG Grid
columns — `costCodeId` (subcontract line items) and `defaultCostCodeId`
(subcontract-level default) — using `agRichSelectCellEditor` with
`values: sortedCostCodes.map(c => c.code)` (the underlying value list was
the CODE, not the id) and `allowTyping: true`, with **no `valueSetter`**.
AG Grid's default behavior with no valueSetter writes `newValue` straight
to the field, so this column has been storing the raw code in `costCodeId`
by design — contradicting `domain/rollups.ts`, which trusts `costCodeId` as
an id with no fallback. This is the everyday interactive editing path for
subcontract line items, far more heavily used than CSV import, so it's the
most likely dominant source of the 535 ambiguous records fixed earlier. It
also explains the orphan pattern: `allowTyping` with no validation lets a
user leave the *formatted display label itself* (`"E3 - E3"`, when a cost
code's `name` happens to equal its `code`) in the cell, which then gets
committed verbatim.

Two more instances of the identical bug found while tracing this:
`Subcontracts.tsx` and `SubcontractFormDialog.tsx` both have a plain HTML
`<select><option value={c.code}>` for setting a subcontract's
`defaultCostCodeId` on create/edit — same root cause, simpler fix (native
select only allows listed options, no free-typing risk).

**Fix, after checking with Bernard on the failure-mode design (reject
silently, keep old value — matches the audit script's philosophy of never
guessing on bad data):**
- `columns.tsx`: both columns' `values`/`formatValue`/`valueFormatter`
  switched from matching `.code` to matching `.id`. Added a `valueSetter`
  to each that resolves the entered value (by id, by code, or by parsing a
  `"CODE - NAME"` label back to its code) to the cost code's `.id`, and
  returns `false` (rejects the edit, keeps the old value) if nothing
  resolves — closing off future orphans at the source instead of just
  cleaning them up after the fact.
- `Subcontracts.tsx` / `SubcontractFormDialog.tsx`: `<option value={c.code}>`
  → `<option value={c.id}>`.
- Confirmed via grep that every other read site for `defaultCostCodeId`
  (`CostCodes.tsx`, `GlobalTimephasing.tsx`, `domain/rollups.ts`) already
  treated it as an id — only the write paths were wrong, so this closes the
  loop rather than opening a new inconsistency.

**Extended the audit script** (`scripts/normalize-costcode-fk.ts`) to also
check `subcontracts.defaultCostCodeId` (a scalar field on the subcontract
doc, separate from the already-audited `lineItems[].costCodeId` array) —
this field was never in scope of the original audit, so any pre-existing
bad data there is still live and unconfirmed. Generalized
`auditTopLevelCollection` to accept a field name instead of hardcoding
`costCodeId`. **Could not run it today** — hit the Firestore free-tier
daily read quota (exhausted from today's two earlier full scans across all
projects). The script change itself is inert until run, so safe to commit;
the actual data check is still pending.

**Verified**: `npm run lint` (tsc+eslint) clean, `npx vitest run` 252/252,
`npx playwright test` 47/47 — all after the `columns.tsx` change (no
existing test exercises editing a subcontract line item's cost code cell or
the subcontract create/edit forms directly, so this fix is confirmed by
type-check/lint only; genuinely untested at the interaction level, and no
browser session was available this session to check manually).

### What to do next

- Run `npx tsx scripts/normalize-costcode-fk.ts --all-projects` once the
  Firestore free daily quota resets, to check `defaultCostCodeId` for
  existing bad data (never previously audited) and to finish the
  `YYAvcfIxOuu4BSz3eYai` regression check from the prior entry.
- Consider adding E2E/unit coverage for the `columns.tsx` valueSetter logic
  and the subcontract create/edit cost-code dropdowns — currently
  unexercised by any automated test.
- Everything else from the prior two entries' outstanding items is still
  open and unchanged.

## 2026-07-11 (continued, same day #3) — DRY cleanup + test coverage for the cost code fix

Noticed after the columns.tsx fix: the same "resolve raw id/code/label
input to the cost code's canonical id" logic had been independently
written 5 times across today's session (3 CSV import fixes, 2 columns.tsx
valueSetters) - a DRY violation per the project's own coding standards.
Extracted to `src/domain/costCodes.ts::resolveCostCodeId`, a pure function,
and refactored all 5 call sites to use it. Added 10 unit tests covering id
passthrough, code lookup, "CODE - NAME" label parsing, the doubled
"E3 - E3" case specifically (the shape that caused today's orphaned
records), whitespace trimming, and no-match. This also closes the test
coverage gap flagged in the prior entry - the valueSetter logic was
previously verified by type-check only.

Verified: tsc+eslint clean, 262/262 unit (252 + 10 new), 47/47 E2E.

## 2026-07-12 — manual browser verification of the cost code editor fix

Firestore free-tier quota was still exhausted this morning (same error as
yesterday) — the `defaultCostCodeId` audit and the `YYAvcfIxOuu4BSz3eYai`
regression check are still blocked, unclear when the reset actually lands.
Not retried further; pivoted to something actually actionable: manually
verifying the `columns.tsx` grid editor fix in a real browser, since it had
only been confirmed by type-check until now.

Ran `dev:memory` (VITE_ADAPTER=memory, no Firestore risk) and drove it with
Claude in Chrome. Hit an unrelated environment snag first: Chrome returned
431 (Request Header Fields Too Large) against `localhost:5178` and
`127.0.0.1:5178` alike - almost certainly years of accumulated cookies
across many past local dev servers exceeding Node's default header size
limit. Fixed by relaunching with `NODE_OPTIONS="--max-http-header-size=65536"`
rather than touching Chrome's cookie jar. Worth remembering if this
recurs: it's a Node http-parser limit, not an app bug.

**Verified live, in the running app:**
- `SubcontractFormDialog.tsx`'s Default Cost Code dropdown: the DOM now
  shows `<option value="cc-100">` (an id) instead of the raw code - visible
  directly in the page's accessibility tree before even submitting.
- Setting a subcontract's default cost code and adding a line item with no
  cost code of its own correctly falls back to the default, displayed
  correctly formatted and in the expected italic/gray "inherited" style.
- Editing a line item's own cost code cell and selecting a value from the
  dropdown resolves and commits correctly - non-italic, correct code shown,
  confirming the value is now the item's own explicit `costCodeId`, not the
  fallback.
- **The core defensive fix**: typing free text that doesn't match any cost
  code (`"TOTALLY BOGUS INPUT"`) is rejected outright - the cell reverts to
  its previous value instead of committing garbage. This is the exact
  mechanism that used to allow the `"E3 - E3"` orphan pattern through;
  confirmed it can no longer happen via this path.

Did not force a live repro of the `"CODE - NAME"` label-parsing branch
specifically (typing `"100 - Substructure"` back in) - an automation
targeting issue (double-click landing on the wrong cell after a prior Tab)
got in the way, and that exact path is already covered by
`costCodes.test.ts`'s dedicated test, so didn't chase it further.

No app code changed this session - verification only. Dev server stopped
afterward; memory adapter data was in-process only, nothing to clean up.

### What to do next

- Firestore quota: retry `npx tsx scripts/normalize-costcode-fk.ts --all-projects`
  again later - still don't know the actual reset schedule.
- Everything else from the prior two entries is unchanged and still open.

## 2026-07-12 (continued) — Postgres migration: core + cost-management schema, validated

First real implementation slice of POSTGRES_MIGRATION_PLAN.md, per Bernard's
"let's implement." Scoped this to core identity/membership (enterprises,
projects, memberships, user_profiles) plus the cost-management domain —
the one that actually motivated the whole migration — rather than
attempting all 26 collections in one unreviewed pass.

Provisioned a scratch Supabase project (`mend-migration-scratch`,
$10/month, confirmed with Bernard before creating) specifically to validate
the schema/RLS pattern for real before committing to it across the rest of
the domains.

**Applied and verified against a live Postgres instance** (not just written
and hoped): 14 tables, every membership relationship (enterprise/project)
as a real join table replacing Firestore's array/map fields, every FK a
real `REFERENCES` constraint, RLS enabled on every table with policies
translated directly from `firestore.rules` (read all 579 lines to keep
authorization behavior from drifting during the migration).

Deliberately excluded `cost_codes.approvedBudget` / `actualCostToDate` /
`estimateAtCompletion` / `costVariance` / `budgetChanges` as stored
columns — those were made compute-on-read by the Phase 13.B1 (F1) fix, so
the schema now *enforces* the single-source-of-truth rule at the DB layer
by simply not giving those fields anywhere to drift. Kept the
`*Previous`/`*Movement` snapshot-cache fields as real columns, matching
current Firestore behavior exactly — a data-layer migration isn't the
place to redesign the period-close feature.

**Ran the Supabase advisor tools and fixed everything real they found**,
rather than treating "it applied without erroring" as good enough:
- Security: `SECURITY DEFINER` functions had a mutable search_path (a real
  hijacking risk); the RLS helper functions were directly callable via the
  public REST API when they should only be used internally by policies.
  Both fixed — security advisor is now clean (0 findings).
- Performance: several FK columns had no covering index; two
  `user_profiles` policies re-evaluated `auth.uid()` per row instead of
  once; the enterprise/project/member "admin" policies used `for all`,
  which overlaps with the plain read policy on SELECT (Postgres evaluates
  every permissive policy for a role+action, even redundant ones). Fixed
  all three — remaining advisor output is just expected noise (indexes
  flagged "unused" on a zero-row scratch database, an unrelated Auth
  connection-strategy setting).

Kept the advisor-driven fixes as their own migration files (0003, 0004)
rather than rewriting 0001/0002 in place — the history should honestly
show what was actually caught and when, matching how this project's
journal entries already work.

### What's NOT done yet

- The other ~20 collections (risk, change, subcontracts, invoices,
  progress, procurement, schedule, calendars, saved views, audit logs) —
  scoped out of this pass deliberately, to check in before continuing
  through the same pattern 20 more times.
- No ETL script yet, no Postgres adapters, no auth migration tooling.
- The vendor-by-email RLS edge case from the plan doc is still an open
  design question, not yet touched.

### What to do next

Check in with Bernard: continue mechanically through the remaining
domains using this now-validated pattern (join tables for memberships,
compute-on-read fields excluded from storage, RLS translated from
firestore.rules, advisor-clean before moving on), or pause for review of
this slice first.

## 2026-07-12 (continued) — Postgres migration: complete schema, all 26 collections

Continued from the core + cost-management checkpoint, per Bernard's "keep
going." Built out the remaining ~20 collections using the now-validated
pattern (real FKs, RLS translated from firestore.rules, compute-on-read
fields excluded from storage, advisor-clean before moving on).

**Precision problem worth recording**: reading `src/domain/types.ts` through
the normal Read tool kept hitting aggressive content compression that
silently stripped field names while keeping literal values -- multiple
techniques (smaller ranges, `sed`, `awk`) hit the same wall inconsistently.
Base64-encoding chunks before reading reliably bypassed it every time, so
every interface used in this session's schema work was extracted that way
and cross-checked against actual usage in components (not just the type
comment) where the two could plausibly differ -- e.g. confirmed
`RiskRecord.betaPertImpactAmount`'s real formula includes a probability
factor by reading `domain/risk.ts`'s actual `betaPertExposure()` function,
since the type comment omits it.

**Domains added**: risks/risk_records, changes/change_records,
vendors/subcontracts/subcontract_line_items/invoices/invoice_items,
progress_packages/progress_items/progress_reporting_periods/
progress_attributes/rules_of_credit/rule_of_credit_steps,
procurement_step_definitions/procurement_items/schedule_items/calendars,
saved_views, audit_logs. 35 tables total (26 collections plus join/child
tables normalizing embedded arrays and membership maps).

**Went further than "just migrate the data" in one place, on purpose**:
`risk_records.beta_pert_impact_amount` is a real Postgres `GENERATED
ALWAYS AS ... STORED` column, not just a copied value. CLAUDE.md flags
this exact field as existing tech debt ("stored derived value... never
trust as authoritative"). Since the formula only references columns on
the same row, Postgres can enforce it can never drift, for real --
stronger than what the current app does today.

**Caught while reading Project's real fields precisely**: migration 0001's
`project_member_role` enum had guessed values (`'Project Member'`,
`'Viewer'`) that don't exist in the actual domain type
(`Record<string, 'Project Admin' | 'Project User'>`). Fixed via its own
correction migration (0005) before it was used by any RLS policy that
would've silently never matched.

**Resolved the vendor-by-email RLS open question** from
POSTGRES_MIGRATION_PLAN.md: kept `vendor_users` as a plain email array
(matching `Subcontract.vendorUsers` exactly, not redesigned into a real
membership table), with a combined SELECT policy
(`can_access_project(...) OR email in vendor_users`) plus separate
project-member-only write policies -- avoids the "multiple permissive
policies" issue a `for all` + `for select` pair would cause.

**Real bug caught by `apply_migration` failing, not by the advisor**: a
genuine SQL naming collision -- `invoices.invoice_id` (human-readable text
id) and `invoice_items.invoice_id` (uuid FK) share a name, so a bare
`invoice_id` reference inside a subquery over `invoices` silently resolved
to the wrong (text) column via normal SQL scope shadowing, producing a
`uuid = text` type error. Isolated by applying the migration in
progressively smaller pieces until the exact failing statement was found,
confirmed with a standalone `execute_sql` call showing the caret position,
then fixed by qualifying every outer reference as `invoice_items.invoice_id`
rather than renaming the column (keeps parity with the domain type's own
field name).

**Verified**: ran the security and performance advisors against the
complete 35-table schema, fixed the real findings (4 missing FK indexes),
left the expected noise (unused-index warnings on a zero-row scratch
database, one project-level Auth connection-strategy setting unrelated to
schema). Security advisor: 0 findings. `list_tables` confirms all 35 with
RLS enabled.

### What's NOT done yet

- No ETL script, no Postgres adapters, no auth migration tooling.
- `ProcurementItem.stepData` and several other dynamic per-key maps
  (`period_values`, `rule_of_credit_progress`, etc.) are JSONB rather than
  fully normalized child tables -- a deliberate, flagged tradeoff, not an
  oversight; revisit only if step/period-level querying becomes a real
  product need.
- Schema hasn't been checked against a sample of real production documents
  yet -- built from the domain type definitions and cross-referenced
  against actual usage, but the type definitions are the source of truth
  used, not live data.

### What to do next

Check in with Bernard: this closes out the schema portion of
POSTGRES_MIGRATION_PLAN.md entirely. Next real piece of work is the ETL
script (read -> map -> transform -> load -> verify) or the Postgres
adapters behind the existing 12 ports -- whichever Bernard wants to tackle
first, since both are independent of each other and could go in either
order.

## 2026-07-12 (continued) — root-caused two issues Bernard asked about before continuing

Bernard asked to properly diagnose rather than keep building: the type.ts
read-compression friction from the schema session, and whether the
invoice_id naming collision was a one-off or something to fix at the root.

**types.ts compression, diagnosed for real via `headroom_stats` rather
than guessed**: "Headroom" is a real, active token-compression proxy that's
been running the entire session (8,783 of 9,635 API requests compressed,
"token" mode, ~$910/39.6% saved this session). Not a bug. It compresses
predictable/repetitive token sequences to save cost -- exactly why a long
TypeScript interface (dozens of near-identical `fieldName: type;` lines)
got hit hard while literal strings/numbers survived, and exactly why
base64-encoding a chunk before reading reliably bypassed it every time
(near-uniform high-entropy bytes give the compressor nothing repetitive to
exploit). Practical takeaway for future sessions needing exact field-level
precision from a similarly repetitive file: base64 first, don't gamble on
a small-enough byte range.

**Naming collision, audited across all 11 migration files rather than
assumed fixed**: found the identical `<parent business-id> / <child FK>`
name collision in 3 more dormant spots -- `risks.risk_id` /
`risk_records.risk_id`, `changes.change_id` / `change_records.change_id`,
`progress_packages.package_id` / `progress_items.package_id` +
`rules_of_credit.package_id`. None had triggered a visible bug yet, only
because no policy or query happened to reference them in a colliding way
-- structurally identical to the invoice_id case, not a different problem.
Worth noting: the invoice_id bug failed loudly (`uuid = text` type
mismatch) purely because the two colliding columns happened to have
different types -- if a future case had matching types, the same shadowing
would return silently wrong data instead of erroring.

Root cause of the whole class: naming every human-facing business code
`<entity>_id` when a child table's FK to that same parent conventionally
*also* gets named `<entity>_id` (which is itself completely normal,
correct FK-naming practice). Fixed at the source instead of patching each
site: renamed every business-id column to `<entity>_code`
(`risk_id`→`risk_code`, `change_id`→`change_code`,
`package_id`→`package_code`, `invoice_id`→`invoice_code` on the parent
tables) via migration 0012. Also renamed `order_id`→`order_code`,
`rule_id`→`rule_code`, `item_id`→`item_code`, which followed the same
risky pattern but hadn't collided with anything yet -- closing the
landmine before a future table steps on it, not just patching the two
that had already gone off.

Verified: security advisor 0 findings, all 35 tables intact and RLS
enabled after the rename.

### What to do next

Same as before this diagnostic detour: ETL script or Postgres adapters,
Bernard's choice on order. Also worth deciding whether to reconcile
POSTGRES_MIGRATION_PLAN.md's original schema sketch (still shows the old
`_id` column names) once that branch/PR merges -- it wasn't reachable from
this branch to update now.

## 2026-07-12 (continued) — all 12 Postgres adapters written, 10 real schema bugs found and fixed

Per Bernard's "ETL please, and postgres adapters. Let's finish this off" --
tackled the adapters first since building them meant reading every
Firestore adapter's real behavior line-by-line, which turned into the most
rigorous verification pass the schema has had yet.

**All 12 ports now have a Postgres adapter** (`src/platform/supabase/adapters/`),
matching the Firestore adapters' exact method signatures and behavior:
Risk, Change, Schedule (+ Calendar), Utility, UserRole, Procurement,
Progress, Cost (the biggest -- cost codes, sheets, forecast rows, ETC
details, actual costs, baseline budgets, cost phasing), Enterprise,
Project, Subcontract (+ Invoice), and Auth. Wired a third `postgres` case
into the composition root (`context.tsx`) alongside memory/firestore,
selected the same way via `VITE_ADAPTER`.

Built a shared `caseConvert.ts` utility (camelCase <-> snake_case,
following the same boundary-assertion pattern as the existing
`firestore/converters.ts::fromDoc<T>`) and generated real TypeScript types
from the live schema via Supabase's own generator, rather than hand-typing
35 tables -- regenerated after every schema fix so the adapters were
always checked against the actual current schema, not a stale guess.

**Reading the real adapters line-by-line surfaced 10 genuine schema bugs**,
not just style issues -- none would have been caught by the advisor, since
they're all shape mismatches, not lint-detectable problems:
- `etc_details` and `sheets` were missing nearly all of their real columns
  (migration 0002 guessed at both before the domain types were fully
  read) -- etc_details was missing `project_id` entirely, which the
  Firestore adapter queries directly.
- `enterprises` and `projects` were each missing ~20 real columns
  (attribute-definition lists, budget/date fields, audit fields) --
  caught by a `theme` field triggering a type error, which prompted a full
  cross-check of both tables rather than patching just that one field.
- `cost_phasing` was missing a direct `project_id` column -- the Firestore
  adapter filters by projectId and costCodeId as two independent top-level
  fields, not via a cost_code join.
- `invitations` was missing `token` and `enterpriseName` (the field
  enabling the whole accept-invite flow).
- `period_snapshots`' shape didn't match the real `PeriodSnapshot` type at
  all (period_id/period_name/costCodes[], not period/cost_code_summaries).
- A `forecast_rows` table didn't exist yet (Firestore stores it as a
  `sheets/{id}/rows` subcollection -- discovered while reading CostAdapter).
- A `user_roles` table didn't exist -- discovered that `domain/roles.ts`'s
  more granular role system (enterprise_admin/enterprise_member,
  project_admin/writer/reader/guest) is genuinely separate, dormant
  scaffolding (confirmed zero component usage via grep) from the legacy
  Project.users/Enterprise.adminUsers fields that actually drive live
  authorization today -- mirrored 1:1 rather than forced into the existing
  membership tables.
- `project_members.role` had invented values ('Project Member', 'Viewer')
  that don't exist in the real `Project.users` type
  (`'Project Admin' | 'Project User'`) -- fixed via its own enum migration.

**ProgressItem** needed real translation logic, not just case conversion:
its `packageId` (human-facing, denormalized in Firestore since it can't
easily join) is now derived via a real Postgres join against
`progress_packages.package_code` instead of being stored as a redundant
copy -- Postgres can do what Firestore couldn't.

**EnterpriseAdapter/ProjectAdapter** reconstruct the legacy
`adminUsers`/`users` maps from the real `enterprise_members`/
`project_members` tables. Documented a deliberate simplification: cached
profile fields (email, photoURL) that used to live denormalized in the
Firestore membership blob aren't fabricated here since they're not stored
per-membership in the normalized schema -- callers needing them should
read `user_profiles` directly.

**AuthAdapter** has one real, unavoidable API shape mismatch:
`getCurrentUser()` is synchronous in the port (matching Firebase's cached
`auth.currentUser`), but Supabase's client is async-only. Solved with a
locally-cached user kept current via `onAuthStateChange`, not a bug, just
a genuine platform difference.

**Verified**: `npm run lint` (tsc+eslint) clean, `npx vitest run` 262/262,
`npm run build` succeeds. Every fix above was applied to the live scratch
project and re-verified with `list_tables`/`get_advisors` before moving on
-- security advisor stayed at 0 findings throughout.

### What's NOT done yet

- The ETL script itself (read -> map -> transform -> load -> verify) --
  not started this session; ran out of runway after the adapter work
  surfaced far more schema-fixing than expected.
- Auth migration tooling and the `/api/accept-invite` server endpoint's
  Supabase rewire -- both still gated on Tarek's sign-off per
  POSTGRES_MIGRATION_PLAN.md.
- `AuthAdapter.getLinkedProviders()` returns an empty array rather than a
  real result -- Supabase's identity-provider list is async-only
  (`getUserIdentities()`), documented in the adapter rather than faked.

### What to do next

Build the ETL script next, now that both the schema and the adapters it
needs to write to for the "load" phase are in place and verified.

## 2026-07-12 (continued) — ETL script written, blocked from live testing by the same recurring Firestore quota issue

Finishes the piece Bernard asked for: "ETL please, and postgres adapters."
Adapters were done in the prior entry; this one is the ETL script itself.

**`scripts/etl-firestore-to-postgres.ts`** -- read -> map ids -> transform
-> load -> verify, per POSTGRES_MIGRATION_PLAN.md's design. Deliberately
scoped to exclude every table with a required (not null) FK to
`auth.users` -- `enterprise_members`, `project_members`, `user_profiles`,
`user_roles`, `cost_code_assigned_users`, `saved_views` can't be migrated
correctly until the Firebase Auth -> Supabase Auth user migration has
actually happened (still gated on Tarek's sign-off on the forced-
password-reset UX). Nullable user FKs (`created_by`, `modified_by`,
`actor_user_id`) are populated as null for now, with a documented
follow-up backfill once real user-id mappings exist. Every other
collection is migrated in full, in correct dependency order.

ID strategy matches the plan doc exactly: every Firestore doc gets a
fresh UUID recorded in `etl.id_mappings` (its own schema, not `public`,
so it's never exposed via the app's REST API), making re-runs idempotent
-- an already-migrated doc gets its existing UUID back rather than a new
one. Default mode is report-only; `--apply` is required to actually write.

**Caught and fixed a real design inconsistency before it shipped**: the
id-mapping helper was writing to `etl.id_mappings` regardless of
`--apply`, contradicting the script's own "report-only never writes to
Postgres" claim. Fixed by making report-only mode generate ephemeral,
in-memory-only ids (`crypto.randomUUID()`, never persisted) instead --
only `--apply` runs touch the mapping table for real.

Reused `caseConvert.ts` (the same camelCase/snake_case utility written for
the adapters) directly in this Node script rather than duplicating field-
mapping logic a third time -- it's plain TS with no browser dependencies,
so it works unchanged outside the app.

**Blocked from live testing**: needed the Supabase service role key to
even dry-run the script (RLS has no real Supabase Auth users yet to
authenticate the anon key as, so even report-only reads would return
nothing without it) -- asked Bernard to set it as a local env var rather
than pasting the secret into chat, which he did. Ran the script in
report-only mode against a single small project
(`HVhKyBcq57Gxl256zMqo`) to validate the pipeline for real, and hit the
exact same Firestore free-tier quota exhaustion that's recurred across
the last three days of this work. The failure happened deep inside a real
Firestore call (not a config/auth error), which at least confirms the
connection setup itself is correct -- just blocked from proving the
read/transform logic against live data by something outside my control.

Verified everything that doesn't require live Firestore data:
`tsc --noEmit` clean, `npm run lint` clean, `npx vitest run` 262/262
(unaffected, no src/ changes this pass), cleaned up two rough edges found
while re-reading the script before committing (a `(fn as any)._codeMap`
side-channel hack replaced with a proper return type, one genuinely
unused variable removed).

### What's NOT done yet

- Never actually run against live Firestore data -- correctness of the
  read/transform logic is reviewed but unverified end-to-end.
- The membership tables (enterprise_members, project_members,
  user_profiles, user_roles, cost_code_assigned_users, saved_views) have
  no migration path yet at all -- deliberately deferred, not forgotten,
  pending the auth migration.
- No backfill mechanism yet for created_by/modified_by/actor_user_id once
  user-id mappings do exist.

### What to do next

Retry the ETL script once the Firestore quota resets (unclear timing,
same open question as the last three days) to get a real end-to-end
validation. This closes out everything Bernard asked for this session --
next real decision point is either the auth migration (needs Tarek) or
holding here until the quota situation is resolved.
