# Mend — CLAUDE.md

## Project Overview

**Mend** is a construction project cost management and forecasting tool. It tracks budgets, actuals, EAC/ETC, subcontracts, procurement, progress, risk, and change management across enterprise and project levels.

**Stack:** React 19 · Vite 6 · TypeScript 5.8 · Firebase 11 (Firestore + Auth) · Express (email only) · AG Grid 35 (Enterprise) · Univerjs · Tailwind CSS 4 · shadcn/ui · Gemini AI (@google/genai)

**Repo:** `github.com/tag0388/Mend` — Tarek (tag0388) owns the domain/product code. Bernard drives the refactor.

---

## Refactor Goal — Ports & Adapters Seam

Extract a clean platform seam so domain/product code **never imports Firebase directly**. Firebase is then a swappable adapter behind typed interfaces. Target storage: PostgreSQL (Supabase).

### The non-negotiable rule

> **No `firebase/*` imports outside `src/platform/firestore/` and `src/platform/auth/`. No exceptions.**

If a domain or product file imports from `firebase/*`, that is a refactor violation. Stop and fix it before continuing.

After Chunk 6 (boundary lint), ESLint will enforce this automatically. Until then, enforce manually.

---

## Architecture

### Server

`server.ts` is a thin Express server with **one** API route:
- `POST /api/invite` — sends invitation emails via Resend

The server **has no Firestore calls**. All Firebase usage is client-side only.

### Client

Pure SPA. All Firestore reads/writes happen in React components and `src/lib/` files.

Startup: `npm run dev` runs `tsx server.ts` which starts Express + Vite middleware together on port 3000.

---

## Directory Structure

### Current (pre-refactor)

```
src/
  App.tsx              — root: auth, routing, top-level Firestore queries
  firebase.ts          — Firebase init (auth + db exports)
  types.ts             — domain type definitions
  main.tsx             — React entry point
  index.css
  components/          — 50+ flat component files, most import firebase/firestore directly
  lib/
    audit.ts           — Firestore write (audit log) — imports firebase
    errorHandlers.ts   — Firestore error handling — imports firebase
    procurementUtils.ts — date/calendar calculations (nearly pure)
    utils.ts           — phasing calculations + formatDate (formatDate leaks Firestore Timestamp)
```

### Target (post-refactor)

```
src/
  domain/              — pure functions, no I/O
    phasing.ts         — distribution calculations (from lib/utils.ts)
    procurement.ts     — date/calendar logic (from lib/procurementUtils.ts)
    risk.ts            — Beta Pert formula
    eac.ts             — EAC/ETC/variance formulas
  product/             — UI components (no firebase imports)
    components/        — moved from src/components/
    App.tsx
  platform/
    ports/             — TypeScript interfaces (no firebase types)
      ProjectRepository.ts
      CostCodeRepository.ts
      ForecastRepository.ts
      ... (one per Firestore collection group)
    firestore/         — Firestore adapter implementations
      firebase.ts      — (moved from src/firebase.ts)
      ...
    memory/            — in-memory fake adapters (tests + acid test)
    auth/              — auth adapter (Firebase Auth)
    config/            — environment / composition root
  lib/
    utils.ts           — non-firebase utilities only
```

---

## Firestore Collections in Use

Identified during recon (Chunk 0):

| Collection | Domain type |
|-----------|------------|
| `enterprises` | `Enterprise` |
| `projects` | `Project` |
| `costCodes` | `CostCode` |
| `forecastRows` (sheets) | `ForecastRow` |
| `etcDetails` | `EtcDetail` |
| `changes` | `Change` |
| `changeRecords` | `ChangeRecord` |
| `risks` | `Risk` |
| `riskRecords` | `RiskRecord` |
| `subcontracts` | `Subcontract` |
| `subcontractLineItems` | `SubcontractLineItem` |
| `invoices` | `Invoice` |
| `progressPackages` | `ProgressPackage` |
| `progressItems` | `ProgressItem` |
| `rulesOfCredit` | `RuleOfCredit` |
| `scheduleItems` | `ScheduleItem` |
| `procurementItems` | `ProcurementItem` |
| `calendars` | `Calendar` |
| `savedViews` | `SavedView` |
| `auditLogs` | (write-only) |

_Exact collection names to be confirmed during Chunk 0 recon._

---

## Domain Calculations — Canonical Locations

These pure functions live in `src/domain/` after Chunk 2. Before that, they live in `src/lib/utils.ts` and `src/lib/procurementUtils.ts`.

| Calculation | Target location |
|------------|----------------|
| Time phasing distributions (Even, Bell, Front/Back load, S-Curve, Profile) | `src/domain/phasing.ts` |
| EAC / ETC / cost variance | `src/domain/eac.ts` |
| Beta Pert exposure formula `(Min + 4×ML + Max) / 6` | `src/domain/risk.ts` |
| Working day / business day arithmetic | `src/domain/procurement.ts` |
| Procurement date recalculation | `src/domain/procurement.ts` |

**Single Source of Truth:** `betaPertImpactAmount` on `RiskRecord` is a stored derived value. The formula `(Min + 4×ML + Max) / 6` must be computed by the canonical function in `src/domain/risk.ts`. All reads must recompute from leaf fields; never trust the stored value as authoritative.

---

## firebase Import Scope (pre-refactor)

41 files import from `firebase/*`:
- `src/firebase.ts` — init file (moves to `src/platform/firestore/`)
- `src/App.tsx` — auth + Firestore (moves to `src/product/`)
- `src/lib/audit.ts` — Firestore write (becomes a port adapter)
- `src/lib/errorHandlers.ts` — imports `auth` from firebase
- 37 `src/components/*.tsx` files — all import `firebase/firestore` directly

---

## Coding Conventions

**TypeScript:**
- No `any` — use `unknown` and narrow explicitly; existing `any` in types.ts is tech debt to address progressively
- No `console.log` — `console.error` for genuine errors only; remove debug logs before committing
- Explicit return types on all exported functions
- No non-null assertions (`!`) unless value is guaranteed by a prior guard in the same function

**File/function size:**
- Files: 200–400 lines typical, 800 hard max — extract modules when approaching limit
- Functions: 50 lines max — split if longer

**Immutability:** Never mutate state in place; always return new objects.

**No firebase imports outside `src/platform/`** — see the non-negotiable rule above.

**Port interfaces — no storage types:**
- Port interfaces in `src/platform/ports/` must use domain types only
- No `Timestamp`, `DocumentSnapshot`, `DocumentReference`, `FieldValue`, or any other Firebase type in port contracts
- Dates are plain ISO strings in domain types

**Naming:**
- Files/directories: `kebab-case`
- Components: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (port interfaces: `XRepository`, `XAdapter`)

---

## Grid Libraries

Two libraries are in use — this is intentional for now:
- **AG Grid 35 Enterprise** — primary data grid throughout the app
- **Univerjs** — spreadsheet-style grid (used in `UniverSheet.tsx`, `UniverMasterListEditor.tsx`)

Chunk 8 wraps the AG Grid in a `<DataGrid>` component. Univerjs is handled separately (lower priority).

---

## Development Commands

```bash
npm run dev          # Express + Vite on http://localhost:3000
npm run build        # Vite client build + esbuild server bundle
npm run start        # Run production build (node dist/server.cjs)
npm run lint         # TypeScript type-check only (tsc --noEmit)
```

**Not yet configured (to add during refactor setup):**
```bash
npm run type-check   # (alias for lint — add as separate script)
npm run test         # Vitest unit tests (install in Phase 0)
npm run test:e2e     # Playwright (add at Tier 3)
```

**Note:** `npm run lint` currently runs `tsc --noEmit` only. ESLint will be added in Chunk 6 (boundary enforcement). When ESLint is added, a dedicated `lint` script runs ESLint and `type-check` runs TypeScript.

---

## Environment Variables

Required in `.env` (or `.env.local`):
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
RESEND_API_KEY=
GEMINI_API_KEY=          # if AI features are in use
VITE_ADAPTER=firestore   # or "memory" for acid test
```

The repo has `firebase-applet-config.json` — this is the public Firebase client config (not a secret). The `.env` is gitignored.

---

## Session Start Checklist

Run these before writing any code:

1. Read JOURNAL.md (last entry) and PLAN.md (current phase) to orient
2. Check for orphaned Claude branches: `git branch -a | grep claude/`; check for unique commits with `git log main..<branch> --oneline`
3. Verify clean working tree: `git status` must be clean before making changes
4. Baseline type-check: `npm run lint` must pass before any changes
5. State out loud what you are building and which files will change

---

## Requirements-First — No Exceptions

Never write code until the requirement is fully understood and the design is agreed.

1. Restate the requirement in your own words
2. Ask clarifying questions — numbered, 2–3 concrete options with tradeoffs each
3. Propose the design
4. Identify risks
5. Get explicit sign-off

After sign-off, write agreed design into PLAN.md `## In Progress` section and commit it before opening any code file.

---

## Incremental Commits

Write → type-check → version bump → commit. One logical layer at a time.

```bash
npm version patch --no-git-tag-version   # bumps 1.0.0 → 1.0.1
git add package.json package-lock.json
git commit -m "refactor: ..."
```

Every feature/fix/refactor commit must include a version bump.

---

## Branch Strategy

| Branch | Deploys to | Push rule |
|--------|-----------|-----------|
| `refactor/platform-seam` | — (local only until merge gate) | Bernard only |
| `main` | (Tarek's baseline) | PR merge only |

Single long-lived branch. **No merge to `main` until the full acid test passes and Tarek reviews.**

---

## PR Workflow

The refactor ships as one PR: `refactor/platform-seam` → `main`. Tarek reviews.

Feature PR checklist before opening:
- [ ] `npm run lint` passes (type-check)
- [ ] `npm run test` passes (unit suite)
- [ ] `npm run build` passes
- [ ] Acid test: app runs fully on `VITE_ADAPTER=memory`
- [ ] No `firebase/*` imports outside `src/platform/`
- [ ] JOURNAL.md updated
- [ ] Tarek has reviewed port interfaces (Chunk 3 gate)

---

## Collaboration

- **Tarek** reviews port interface contracts (Chunk 3 gate) and final PR
- **Bernard** drives all refactor code
- Tarek's next step after merge: graduate to Claude Code, no more AI Studio
