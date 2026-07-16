# Full System Audit — Mend

Started 2026-07-17. Bernard requested a ground-up audit of the database structure and
coding logic, motivated by a week of bugs that all traced back to the same root:
the data model was translated from Firestore rather than designed for relational
multi-tenancy.

**Target architecture being audited against:** a multi-tenanted system (Salesforce-style)
where enterprises are securely isolated from each other, with a future hierarchy of
enterprise → departments → sub-departments → projects. Today the model is flat
(enterprise → projects); the hierarchy is directional, not yet built.

**Key architectural fact that shapes the whole audit:** there is no backend API — the
browser talks directly to Postgres. RLS is the *only* real tenant boundary. Every
client-side check is UX, not security.

## Phase structure

| Phase | File | Status |
|-------|------|--------|
| 0 — Ground truth inventory | [phase-0-inventory.md](phase-0-inventory.md) | ✅ complete |
| 1 — Tenant isolation audit | [phase-1-tenancy.md](phase-1-tenancy.md) | not started |
| 2 — Data model structural audit | [phase-2-data-model.md](phase-2-data-model.md) | not started |
| 3 — Boundary/adapter audit | [phase-3-adapters.md](phase-3-adapters.md) | not started |
| 4 — Application logic audit | [phase-4-app-logic.md](phase-4-app-logic.md) | not started |
| 5 — Report & remediation roadmap | [phase-5-report.md](phase-5-report.md) | not started |

Checkpoint with Bernard after Phase 1 before continuing.

## Severity scale

- **CRITICAL** — tenant isolation breach: one enterprise can read/write another's data
- **HIGH** — silent data corruption or loss possible
- **MEDIUM** — drift trap: two sources of truth that will diverge (e.g. platform_role in two tables)
- **LOW** — hygiene: naming, missing indexes, style

## Standing context

- Scratch Supabase project `hryshufihwwcdurlqysy` — synthetic data only, no production
- `smoke-test@mend-test.invalid` holds permanent platform_admin (dev-phase decision);
  adversarial tests must use NON-admin users so admin bypass doesn't mask isolation holes
- Existing GitHub issues #12 (DB audit), #13 (SYSTEM_OWNER_EMAILS), #15 (ETL financial
  fields) fold into this audit rather than being duplicated
- Test suites: `npm run test` (unit), `npm run test:postgres` (integration, live DB),
  `npx playwright test` (e2e memory), `npm run test:e2e:live` (e2e vs deployed URL)
