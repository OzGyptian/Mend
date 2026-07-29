# Plan — API-mediated data access, two environments, and a tiered test strategy

_Drafted 2026-07-29. Supersedes nothing; complements `docs/audit/phase-5-report.md` (the
audit roadmap) and `docs/audit/rca-2026-07-28.md` (why verification was insufficient)._

## 1. Goal

**No path from the browser to the database.** Every read and write goes through the
application layer, which becomes the only holder of database credentials and the only place
authorisation is decided.

Today the browser talks directly to Postgres via `supabase-js`, and Row-Level Security is
the *only* tenant boundary — every client-side check is UX, not security. That design is
what makes audit finding **F1/#23** (cross-tenant foreign-key references) a CRITICAL rather
than a nuisance: a gap in RLS is a gap in the only wall there is.

### Why this is tractable

The ports-and-adapters seam already isolates all database access:

- **12 port interfaces** (`src/platform/ports/`) define everything the app can ask for.
- **237 Supabase calls live in 12 adapter files** — and nowhere else. None of the 119
  components import a database client.
- **Three adapter sets already exist** (`firestore`, `memory`, `supabase`), so the swap
  pattern is proven twice.
- **`tests/port-contracts/`** already defines behaviour every adapter set must satisfy.

So this is a **fourth adapter set**, not a rewrite. Product code does not change.

## 2. Decisions taken (2026-07-29, Bernard)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Expand the existing Express `server.ts`** into the API | Already deployed, already bundled, already serves `/api/invite` and `/api/accept-invite`. One codebase, simple local dev. |
| D2 | **New Supabase project = PRODUCTION; the current project becomes DEV/staging** | Production starts clean rather than inheriting scratch data and a repaired migration ledger. The existing project keeps its synthetic data for development. Closes issue **#26**. |
| D3 | **API layer first, #23 composite FKs after** | The API can validate tenancy on every reference, which mitigates the #23 exposure sooner than the FK migration. It also avoids migrating ~15 composite FKs twice if the department hierarchy lands later. |
| D4 | **Realtime via Server-Sent Events** from the API (not polling) | The app is subscription-driven: `subscribe*()` is part of the port contract, with 112 realtime call sites across 11 adapters. SSE preserves near-instant updates and the contract. **Subject to the S1 spike below.** |

## 3. Target architecture

```
Browser ──HTTP adapter──►  Express API  ──►  Postgres
         ◄────SSE────────  (auth, authz,      ▲
                            tenant checks)    │ RLS retained as
         no DB credentials                    │ defence-in-depth
```

- **Authentication**: Supabase Auth continues to issue JWTs to the browser (no user
  migration). The browser sends the JWT to the API; the API verifies it and derives identity.
  The API then uses a service-role connection internally.
- **Authorisation**: enforced in the API. Every request resolves the caller's tenant and
  validates that *both* the target row and any referenced rows belong to it — this is the
  application-level fix for #23.
- **RLS stays.** It becomes defence-in-depth rather than the sole boundary, and it lets both
  paths coexist during migration.
- **End state**: the anon key's table privileges are revoked, so the browser cannot reach
  Postgres even with a stolen token.

## 4. Open risk requiring a spike before Phase 2

**S1 — SSE on Vercel's function model.** Vercel Functions are duration-capped and bill for
held-open instances; hours-long streams are not their design point. The standard mitigation
is short-lived streams (60–240s) relying on `EventSource`'s automatic reconnect, with
resumption via `Last-Event-ID`.

**This must be proven in Phase 1 on one resource before committing all 12 ports.**
If it fails, in order of preference:
1. Move the API to a persistent host (Railway / Render / Fly) — Express is portable.
2. Fall back to adapter-level polling (contract-preserving; staleness of 5–15s).

Deciding this early is deliberate: discovering it in Phase 2 would strand the project.

## 5. Phases

### Phase 0 — Environments and scaffolding
- Provision the new Supabase project as **production**; apply migrations `0001–0047` to it
  through `supabase db push` from a clean ledger (never `db pull`).
- Reconfigure the current project as **dev/staging**.
- Vercel: production deploys point at the new project; previews point at dev.
- Wire CI secrets so `test:postgres` can finally run against dev — this closes the
  gap named as the root cause in the RCA.
- **Acceptance**: `npm run db:drift` clean against both; CI runs an integration suite
  against a real database for the first time.

### Phase 1 — API skeleton + auth + one reference resource (+ S1 spike)
- JWT verification middleware; request-scoped tenant context.
- **Projects** implemented end-to-end: REST endpoints + `src/platform/http/ProjectAdapter`.
- SSE stream for project changes — **this is the S1 spike**.
- **Acceptance**: the `http` adapter passes the existing port-contract suite for
  `ProjectPort`; SSE proven stable for a realistic session length on the target host.

### Phase 2 — Port-by-port migration
Twelve ports, each: API resource → HTTP adapter → contract tests green. Sequenced by risk:
1. Read-mostly: `utility`, `schedule`, `enterprise`
2. Straightforward CRUD: `project`, `procurement`, `progress`
3. Identity: `auth`, `userRole`
4. **Financial last**: `cost`, `change`, `risk`, `subcontract`
- **Acceptance per port**: contract suite green for `http`; API integration tests cover
  authz and cross-tenant rejection; no component changed.

### Phase 3 — Cutover
- Flip `VITE_ADAPTER=http` (same mechanism as the memory acid test; reversible).
- Add an ESLint boundary rule banning `@supabase/supabase-js` outside
  `src/platform/supabase/` — the same trick that enforced the firebase boundary.
- **Revoke the anon key's table privileges.** This is the moment the goal is met.
- **Acceptance**: with the anon key, a direct table query fails; the app is unaffected.

### Phase 4 — #23 composite foreign keys
Rehearsed in dev first, then production via CI. Requires the hierarchy decision so the
composite key includes the final tenancy column and is not migrated twice.
- **Acceptance**: the `it.fails` case in `tests/postgres/tenant-isolation.test.ts` flips to
  a passing `it`.

## 6. Testing methodology

The RCA's finding was that **all enforced testing ran against an in-memory fake with no
schema**, so schema and boundary defects were invisible by construction. The tiering below
fixes that, and adds an explicit on-demand tier for exhaustive coverage.

| Tier | Scope | Runtime | Runs |
|---|---|---|---|
| **0 — Unit** | Domain calculations, pure functions (304 today) | seconds | every PR |
| **1 — Contract** | Every adapter set satisfies identical port behaviour (`memory`, `supabase`, `http`) | seconds | every PR |
| **2 — API integration** | Every endpoint against a real database: authn, authz, tenant isolation, validation, cross-tenant rejection | ~2 min | every PR |
| **3 — E2E smoke** | Critical paths, memory adapter | ~5 min | every PR (the gate) |
| **4 — E2E full sweep** | **Every route, every CRUD path, every interactive control** against the real API + dev database | 30–60 min | on demand / nightly |
| **5 — Financial correctness** | Golden datasets; mutate an input, assert every derived value on every screen | 10–20 min | on demand / pre-release |

`npm run test:all` runs everything; CI runs tiers 0–3.

### Tier 4 — "every click, every path"
Route coverage must be **generated from the router**, not hand-listed, so a new screen
cannot silently escape coverage. A completeness test asserts every route appears in the
sweep — the same guard style as the vocabulary contract test.

### Tier 5 — "changes in value produce the correct calculations"
The mechanism, extending `cost-report.characterization.spec.ts`:
1. Seed a deterministic golden dataset.
2. Apply a matrix of input mutations: actual cost, change record, risk estimate, progress %,
   subcontract line item, phasing method.
3. After each, assert **every** derived value on **every** screen that should move has the
   expected value — EAC, ETC, variance, roll-ups, exposure, earned value.
4. Assert values that should **not** move are unchanged — this catches unintended coupling,
   which is the harder class of bug.

Tier 5 is also the safety net that makes the two-phasing-engine unification (Bell vs S-Curve)
approachable, since it pins current numbers before any change.

## 7. Risks

| Risk | Mitigation |
|---|---|
| **S1 — SSE on Vercel** | Spike in Phase 1 before committing; documented fallbacks. |
| **Scope: 237 call sites** | Port-by-port; contract tests are the definition of done. Financial ports last. |
| **Added latency** (one hop) | Screen-scoped endpoints, not per-row. Measure in Phase 1. |
| **Auth rework** | Highest-care area. Keep Supabase Auth; only move verification server-side. |
| **Parallel feature work (Tarek)** | Components are untouched by design; coordinate on `src/platform/`. His lanes (risk, progress, changes, subcontracts) are migrated last. |
| **Production cutover** | Dev environment exists first (Phase 0); cutover is one reversible env var until the anon key is revoked. |

## 8. Explicitly out of scope

- Department hierarchy implementation (a separate product decision; it *gates* Phase 4 only).
- The two-phasing-engine unification (needs Tier 5 first).
- Rewriting components to a fetch/cache model — the port contract is preserved precisely so
  this is unnecessary.
