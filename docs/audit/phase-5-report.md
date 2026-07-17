# Phase 5 — Report & Remediation Roadmap

The synthesis of Phases 0–4. This is the deliverable to plan work from.

## Executive summary

The audit started from Bernard's hypothesis: a week of bugs traced to the same root — the
data model was translated from Firestore, not designed for relational multi-tenancy. The
audit **confirms the hypothesis but with a reassuring nuance**: the security *foundation*
is sound (RLS is comprehensive and correct; the read/write tenant boundary genuinely
holds), and the problems are concentrated in specific, fixable **joints** — unvalidated
references between correctly-gated rows, duplicated sources of truth, free-text where enums
belong, and — the biggest surprise — an almost-empty ESLint config that let a whole class
of bugs ship.

**One live production breakage was found and fixed during the audit** (risk-record creation,
P3-0 — merged PR #10). Two findings are genuinely serious and need deliberate remediation
(F1 cross-tenant FKs, A1/ESLint). The rest are medium/low and mostly hygiene.

Crucially, **no data-read tenant breach exists** — one enterprise cannot read another's
data. The scary-sounding findings (F1) are integrity/availability issues, not data leaks,
though F1 has a latent leak path worth closing.

## Complete findings register (ranked)

| ID | Sev | Finding | Status / Issue |
|----|-----|---------|----------------|
| P3-0 | CRITICAL (op) | Risk-record create broken in prod — live DB had 0037 schema, deployed code didn't | ✅ **FIXED** (PR #10 merged, verified live) |
| F1 | CRITICAL | Cross-tenant FK references — attach B's cost_code to A's record; pins B's data (RESTRICT), latent read leak | #23, `it.fails` regression test |
| A1 | HIGH | ESLint enforces only firebase boundary — root cause of the auth-timing bug cluster; "lint passes" is false confidence | subsumes #18 |
| D1 | HIGH | Categorical values as unconstrained free text; case/vocab drift LIVE (`Even`/`even`); 4 vocabularies for one concept; silent-wrong-financials trap | new issue |
| F3 / D3 | MEDIUM | platform_role in 2 tables/2 type systems; self-settable `user_roles.platform_role` → System-Admin UI + enterprise-name disclosure (DB-inert) | #12 |
| A2 | MEDIUM | Hardcoded Tarek-email admin check in 3 components; pre-DB-role residue | #13 |
| A3 | MEDIUM | ForecastGrid computes EAC inline, bypassing domain/eac.ts — DRY/divergence; the real D6 case | new issue |
| D2 | MEDIUM | Membership modelled 4 ways; only the 2 (empty) relational tables are authoritative; 2 are dead residue | new issue |
| F2 | MEDIUM | Denormalized enterprise_id on subcontracts/invoices unvalidated by RLS (inert today) | folds into F1 fix |
| D9 | MEDIUM | Dual-scope tables allow both-null (invisible) rows; cost_phasing/etc_details project_id RLS-ignored, can disagree | folds into F1 fix + CHECK |
| D10 | MEDIUM | projects copies enterprise defaults per-project → drift; worsens with hierarchy | new issue (hierarchy-linked) |
| P3-1/2 | MEDIUM | Stale generated types + toRow/fromRow assert types away → no boundary type safety | mitigated by #10; workflow gap remains |
| audit actor | MED-integrity | audit_logs actor fields client-asserted (tenant-scoped, not a breach) | note |
| D4 | LOW | Role value conventions inconsistent across the 3 enums | note |
| D5 | LOW/MED | Status columns free text (enum candidates) | folds into D1 |
| D7 | LOW | No auth.users FK on any user_id column | note |
| D8 | LOW | No updated_at triggers (app-maintained) | note |
| #15 | — | ETL `?? 0` financial fallbacks (ETL-only; adapters are clean) | #15 |
| D6 | RESOLVED | Derived values: cost_codes ✅ compute-on-read; forecast_rows → A3 | — |

## Root causes (the few things that explain the many findings)

1. **Firestore→Postgres translation without relational redesign.** Explains D2 (4 membership
   models), D3 (role duplication), D10 (per-project default copies), the denormalized
   enterprise_id columns (F2/D9), and free-text categoricals (D1/D5). Firestore documents
   embed and denormalize freely; the relational port kept the shapes instead of normalizing.
2. **RLS gates rows, not references.** Explains F1/F2/D9 — the policy layer correctly checks
   each row's own tenancy but never validates that FK-referenced rows share it.
3. **Tooling doesn't enforce the conventions the codebase claims.** ESLint checks one rule
   (A1); no enum constraints (D1); types asserted away at the boundary (P3-1/2). CLAUDE.md
   says "no any", "business logic in lib/", "leaves-only" — nothing mechanically enforces
   them, so drift accumulates silently.
4. **One Supabase project behind both dev and production**, with migrations applied
   out-of-band. Directly caused P3-0 and is the standing structural risk.

## Remediation roadmap

Sequenced to respect cross-phase dependencies. Each wave is independently shippable.

### Wave 0 — DONE during the audit
- **P3-0** risk-create breakage — PR #10 merged, verified live. ✅

### Wave 1 — fix now (independent, high leverage, no hierarchy dependency)
1. **A1 — enable real linting.** Install `eslint-plugin-react-hooks`; enable
   `exhaustive-deps` + `rules-of-hooks`; add typescript-eslint recommended + `no-explicit-any`
   ratchet (#18). Triage the backlog it surfaces. *This prevents recurrence of the entire
   auth-timing bug class and is the cheapest high-value fix.*
2. **D1 — enum-ify categoricals.** Promote distribution_method, eac_method, payment_type,
   line-item type, forecast_method, and the status columns (D5) to Postgres enums/CHECKs
   with one canonical vocabulary; normalize existing drift (`even`→`Even`); collapse the
   domain-type vocabularies to one shared union. *Highest structural value; converts
   silent-wrong-number bugs into insert-time errors.*
3. **D3 + F3 + A2 (#12, #13) — one platform-admin signal.** Make `user_profiles.platform_role`
   the sole source; have the frontend read it (RPC/view); delete/lock `user_roles.platform_role`;
   delete the 3 hardcoded-email checks. *Closes the F3 UI disclosure.*
4. **Process — split dev from prod DB; ban out-of-band migrations.** Stand up a separate
   Supabase project for the deployed app, or at minimum add a check that main's
   `supabase/migrations/` matches the live applied-migration history before deploy. *Removes
   the structural enabler of P3-0.*

### Wave 2 — after settling hierarchy direction (do NOT reorder)
5. **D10 — model inheritance as null=inherit** (not eager per-project copy), *before* any
   hierarchy work multiplies the copy surface.
6. **F1 (#23) — composite foreign keys.** MUST come after (5) and after the tenancy-column
   shape is pinned, so the composite keys include the future department level and aren't
   migrated twice. Also closes F2 and the cost_phasing/etc_details half of D9. *The
   `it.fails` regression test flips to a real pass when this lands.*

### Wave 3 — hygiene / opportunistic (when touching the area)
7. D2 delete dead membership representations (after Phase-4-confirming they're unread).
8. D9 add `CHECK (num_nonnulls(project_id, enterprise_id) = 1)` to the dual-scope tables.
9. A3 move forecast EAC into domain/eac.ts; decide store-vs-compute for forecast_rows.
10. audit_logs actor hardening (set from auth.uid() in a trigger) if audit becomes
    compliance-relevant.
11. D4 standardize role-label conventions; D7 orphan-check job; D8 generic updated_at trigger.

## What this means, plainly

- The system is **not** fundamentally insecure. The tenant wall holds for reads and writes.
- It **is** fragile in exactly the ways Bernard suspected — and the fragility is
  concentrated and fixable, not pervasive rot.
- The single most cost-effective action is **Wave 1.1 (enable ESLint)** — it's an afternoon
  of work that would have prevented most of this week's bugs.
- The department hierarchy is **viable to add later** without a rewrite, *if* Wave 2 is
  sequenced correctly (D10 before hierarchy, F1 composite keys designed for it).
- Nothing here blocks continued development; the CRITICAL operational issue (P3-0) is
  already resolved.

## Test/enforcement artifacts produced by the audit
- `tests/postgres/tenant-isolation.test.ts` — 13-attack adversarial suite, permanent
  regression guard (1 `it.fails` marks F1 until fixed).
- `docs/audit/phase-0..5` — full inventory, findings, and this roadmap.
- Recommend: the audit suite + a migration-history-vs-live check become CI gates (Wave 1).
