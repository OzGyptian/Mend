# Mend — CLAUDE.md

## Project Overview

**Mend** is a construction project cost management and forecasting tool. It tracks budgets, actuals, EAC/ETC, subcontracts, procurement, progress, risk, and change management across enterprise and project levels.

**Stack:** React 19 · Vite 6 · TypeScript 5.8 · Firebase 11 (Firestore + Auth) · Express (email only) · AG Grid 35 (Enterprise) · Univerjs · Tailwind CSS 4 · shadcn/ui · Gemini AI (@google/genai)

**Repo:** `github.com/tag0388/Mend` — Tarek and Bernard both actively build on this repo (see Collaboration section below). The Firestore→Postgres platform-seam refactor Bernard drove solo is complete; this is no longer a single-owner refactor.

---

## Data sensitivity — scratch Supabase project

The Postgres/Supabase project used for the migration (`hryshufihwwcdurlqysy`, "mend-migration-scratch") contains **only synthetic and seed/demo data** — construction projects, cost codes, budgets, risks, etc. created for testing this migration, confirmed directly by Bernard (2026-07-11/12). There is no production deployment and no real customer data anywhere in this system as of this writing. Row-level content in that database (project names, budget figures, cost codes, etc.) can be queried, inspected, and modified directly without the extra caution appropriate for production data.

**This does not extend to real personal information that happens to pass through the system**, e.g. Tarek's or Bernard's real email addresses used to sign into the app, or anyone else's real credentials. Standard care around accounts, credentials, and sending things on someone's behalf still applies — see the global safety rules. If a real production deployment is ever stood up, this note no longer applies to it.

### `smoke-test@mend-test.invalid` holds permanent `platform_admin`

This is a dedicated, non-real test account (`.invalid` domain, can't receive real email) used for smoke testing (`tests/e2e/live/`) and ad-hoc live diagnosis. As of 2026-07-16 it permanently holds `platform_admin` on both `user_profiles` and `user_roles`, by Bernard's explicit decision, specifically because this is still pre-production/pre-customer development.

**This must be revisited before a real production deployment with real customers exists.** At that point, either scope the smoke-test account down to only the specific access its tests actually need, or have CI grant/revoke the elevated role around each test run instead of holding it permanently. Don't carry this forward unexamined once the "no production yet" premise stops being true — see the note above, which draws the same line.

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

Confirmed by grepping all `collection(db, ...)` calls in src/ — 26 collections:

| Collection | Domain type in `src/types.ts` |
|-----------|------------------------------|
| `enterprises` | `Enterprise` |
| `projects` | `Project` |
| `costCodes` | `CostCode` |
| `sheets` | `Sheet` |
| `etcDetails` | `EtcDetail` |
| `changes` | `Change` |
| `changeRecords` | `ChangeRecord` |
| `risks` | `Risk` |
| `riskRecords` | `RiskRecord` |
| `subcontracts` | `Subcontract` |
| `invoices` | `Invoice` |
| `progressPackages` | `ProgressPackage` |
| `progressItems` | `ProgressItem` |
| `progressReportingPeriods` | `ProgressReportingPeriod` |
| `rulesOfCredit` | `RuleOfCredit` |
| `scheduleItems` | `ScheduleItem` |
| `procurementItems` | `ProcurementItem` |
| `procurementStepDefinitions` | `ProcurementStepDefinition` |
| `calendars` | `Calendar` |
| `savedViews` | `SavedView` |
| `actualCosts` | no type in types.ts — investigate |
| `baselineBudgets` | no type in types.ts — investigate |
| `costPhasing` | no type in types.ts — investigate |
| `periodSnapshots` | no type in types.ts — investigate |
| `invitations` | no type in types.ts — write-once |
| `auditLogs` | write-only (no read type needed) |

**Note:** 4 collections (`actualCosts`, `baselineBudgets`, `costPhasing`, `periodSnapshots`) have no corresponding type in `src/types.ts`. These are likely inferred inline in components. Types need to be extracted during Chunk 2.

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

## Gemini AI

`@google/genai` is in `package.json` but **has zero usages in `src/`**. It is a planned AI Studio capability (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` in `metadata.json`) — the API key is injected by AI Studio at runtime. No migration work needed now. When Gemini calls are added, they go through `src/platform/ai/` (a future adapter).

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
GEMINI_API_KEY=              # if AI features are in use
VITE_ADAPTER=firestore       # or "memory" for acid test
FIREBASE_SERVICE_ACCOUNT_KEY=  # JSON string (server-only, never VITE_-prefixed) — see below
```

The repo has `firebase-applet-config.json` — this is the public Firebase client config (not a secret). The `.env` is gitignored.

**`FIREBASE_SERVICE_ACCOUNT_KEY`** — required for `POST /api/accept-invite` (server.ts) to work.
This is a Firebase Admin SDK service account, used to verify a user's ID token and read/write
Firestore server-side when accepting an invitation — the trust boundary that replaced the old
`isJoiningViaInvitation()` Firestore rule (removed in Phase 13.A / F3 fix; see SYSTEM_REVIEW.md).

To generate: Firebase Console → Project Settings → Service Accounts → Generate new private key.
Set the env var to the **raw JSON contents of that file as a single-line string** (e.g. `export
FIREBASE_SERVICE_ACCOUNT_KEY="$(cat service-account.json)"` locally, or pasted as one value into
Vercel's environment variable UI). **Never commit the JSON file or check it into git.** If missing,
`/api/accept-invite` returns a 500 with a clear message — the rest of the app still works.

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
npm version patch --no-git-tag-version   # bumps 0.2.0 → 0.2.1
git add package.json package-lock.json
git commit -m "refactor: ..."
```

Every feature/fix/refactor commit must include a version bump.

**Versioning convention:**
- `0.1.x` — Tarek's original Firestore build (historical)
- `0.2.x` — Current Postgres/Supabase build (pre-production; Beta badge shown in UI)
- `1.0.0` — First live production deployment

---

## Migration Process

**Never apply migrations out-of-band (direct SQL in Supabase Studio or psql).** All schema changes must go through migration files in `supabase/migrations/` and be applied via:

```bash
npx supabase db push   # applies pending migrations to the configured project
```

This is the lesson from incident P3-0 (2026-07-xx): a migration was applied directly in Supabase Studio while the deployed code expected the old schema, causing a production breakage in risk-record creation.

**Rules:**
1. Every schema change has a migration file in `supabase/migrations/` before it is applied.
2. Migration files are applied via `npx supabase db push`, not through the Studio SQL editor.
3. Code that depends on a migration change must be committed in the same PR, so they move together.
4. When a real production deployment exists: production migrations must run through CI before the code deploy, not after.

---

## Branch Strategy

The platform-seam refactor (Firestore → Postgres/Supabase) is complete and merged. As of 2026-07-16, Mend is in active parallel development, not a single gated refactor — both Bernard and Tarek work directly on `main` via short-lived feature branches.

| Branch | Deploys to | Push rule |
|--------|-----------|-----------|
| `main` | Vercel production (stable, non-preview URL) | PR merge, either Bernard or Tarek |
| feature branches | Vercel preview (per-branch, ephemeral URL) | whoever's working on it |

**No standing review-before-merge gate during this development phase.** The bar for merging to `main` is the test suite passing (`npm run lint`, `npm run test`, `npm run test:postgres`, `npx playwright test`), not a specific person's sign-off — requiring one person to review before the other can merge doesn't hold up once both are actively shipping in parallel, and became actively counterproductive the one time it would have blocked a fix the other person needed just to be able to sign in at all.

**This changes once there's a real production deployment with real users.** At that point, reinstate a review-before-merge gate (or equivalent — CI-enforced checks, a staging environment, whatever fits by then) before anything reaches production. The current permissiveness is specific to this being pre-production, synthetic-data development — see the data-sensitivity note above, which draws the same production/development line.

### Cadence & mechanics

- **Branch naming:** `feat/<owner>-<short-desc>` (e.g. `feat/tarek-risk-export`) so ownership is visible at a glance.
- **Merge little and often.** A feature branch lives **hours to a couple of days, never a week.** We integrate on `main` continuously — *not* in a big batch before a call. Long-lived branches are what make merges (and shared-DB schema drift) painful.
- **Rebase at the start of every session:** `git switch main && git pull --rebase origin main`, then branch. Branch protection requires branches be up to date before merge, which enforces this.
- **Squash-merge only.** Each PR collapses to exactly one commit on `main` — one clean feature commit, linear history. Commit incrementally on your branch (per the version-bump rule below); those squash away on merge.
- **Merge gate:** PR + all CI checks green. No mandatory human approval during this pre-production phase (see above).

### Production boundary — how 1.0.0 ships (design ahead of time)

Today there is exactly **one** long-lived branch: `main`, which Vercel auto-deploys to the production URL. There is **no separate `production` branch**, and we are not going to add one. When 1.0.0 arrives, the production boundary is a **tag**, not a second branch:

- **Release = an annotated, immutable git tag** (`v1.0.0`, `v1.0.1`, …) on a commit of `main`. Production deploys are pinned to a tag, never to "whatever `main` is right now."
- **Why a tag, not a `production` branch:** a tag is immutable and cannot drift. A second long-lived branch promoted from `main` (via squash- or merge-commit) develops a permanently divergent history even when the *trees* are identical — the "phantom-ahead" trap where production reads as forever behind `main`. A tag sidesteps that class of bug entirely: there is no promotion merge, so there is nothing to drift.
- **If a promotion merge is ever unavoidable** (e.g. a real `release` branch is introduced later), it must be **fast-forward-only** — never squash or merge-commit across the production boundary — precisely to avoid the drift above. Squash-only (below) is correct for `feature → main`; it is *wrong* for any `main → release` promotion. Keep the two rules distinct.
- **Rollback = re-deploy the previous tag.** No revert-and-repush dance on `main`.

This is a forward design note, not a live process yet — nothing here changes the current single-branch, squash-into-`main` flow.

---

## PR Workflow

Short-lived feature branches → PR → `main`. Either Bernard or Tarek can open and merge. Opening a PR loads `.github/pull_request_template.md` (the checklist below, plus the DB-change question).

Feature PR checklist before opening:
- [ ] `npm run lint` passes (type-check) — *also enforced in CI*
- [ ] `npm run test` passes (unit suite) — *also enforced in CI*
- [ ] `npm run test:postgres` passes (integration suite against the scratch Supabase project) — **local pre-PR check only, not a CI gate** (see note below)
- [ ] `npx playwright test` passes (e2e acid test, `VITE_ADAPTER=memory`) — *also enforced in CI*
- [ ] `npm run build` passes — *also enforced in CI*
- [ ] No `firebase/*` imports outside `src/platform/`
- [ ] JOURNAL.md updated
- [ ] Schema change? → migration in `supabase/migrations/` **and** the other dev flagged (the `db-change-notify` workflow auto-labels + @-mentions on PRs touching migrations)

> **Why `test:postgres` is not a CI gate.** It runs `dotenv -e .env.local -- vitest …` against the scratch Supabase project, and `.env.local` (the Supabase scratch credentials) is gitignored — so CI has no way to run it without provisioning those secrets. It is deliberately a **local pre-PR check**, run by whoever opens the PR. The three checks that *are* branch-protection-required in CI are `lint, unit tests, build`, `firestore rules (emulator)`, and `e2e (memory adapter)`. **At 1.0.0**, wire `test:postgres` into CI against a dedicated ephemeral test schema (its own project or a per-run Supabase branch) with credentials injected as CI secrets, and promote it to a required check.

---

## Collaboration

- **Bernard** and **Tarek** both actively build features, in parallel, on separate short-lived branches
- Coordination happens via GitHub Issues (the project backlog) and regular catch-ups, not a single gatekeeper reviewing every change — see the backlog reference in memory for the issue list
- **Both develop with Claude Code.** The repo is self-contained for AI-assisted work: shared conventions live in this file (`CLAUDE.md`) and in the committed `.claude/` config (see `.claude/README.md`). Project-level `.claude/rules/` and `.claude/agents/` override each person's personal global config, so both of us — and both Claude instances — code to an identical rulebook. If any tooling wants its own entrypoint file, it should point back here rather than fork a divergent copy.
- **New-developer setup lives in `ONBOARDING.md`** (access grants, local bootstrap, the daily loop).
- **Ownership lanes** (which of the two takes which areas) are agreed directly and recorded in `ONBOARDING.md §6`; they keep two people off the same files. Shared hot files (`src/App.tsx`, `src/types.ts`) get a heads-up in the PR.
