# Mend — Development Journal

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

### What to do next (start of Session 2)

1. **P0.7 — Add Vitest** (needed before Phase 3 can run TDD). Install `vitest` + `@vitest/ui`, add `test` script to `package.json`, add `vitest.config.ts`.
2. **P0.8 — Commit operating files** to `main` (this session's work, including Vitest setup).
3. **Create branch `refactor/platform-seam`**.
4. **Phase 1 — Complete Chunk 0 recon:** Map Gemini AI usage, confirm all Firestore collection names, confirm auth patterns, finalise folder structure proposal for Bernard's approval.
5. Then **Phase 2 — Chunk 1: Scaffold & Move**.
