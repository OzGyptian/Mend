# Phase 3 — Boundary / Adapter Audit (NOTES — phase not yet started)

This file is collecting findings that surfaced early (during Phases 0–1) but belong to
Phase 3. Do not treat as complete; Phase 3 proper has not run.

## Early findings (surfaced during Phase 1)

### P3-1 — `src/platform/supabase/database.types.ts` is STALE
The generated types still describe the pre-migration `risk_records` shape:
`min_impact_amount`, `most_likely_impact_amount`, `max_impact_amount`,
`beta_pert_impact_amount` (a GENERATED column). Migration `0037_risk_model_flexibility.sql`
dropped all of those and added `risk_model text` + `model_inputs jsonb`. The DB has the new
shape (confirmed in Phase 0 §column dump); the generated types were never regenerated.

Impact: every consumer of the `risk_records` Insert/Row types is type-checked against a
schema that no longer exists — masks real errors and forces casts. Broke the Phase 1 test
compile. Phase 3 must regenerate `database.types.ts` from the live schema and see how much
else has drifted (this is unlikely to be the only stale table).

### P3-2 — `RiskAdapter.createRiskRecord` references the dropped generated column
`RiskAdapter.ts:97` excludes `beta_pert_impact_amount` from the insert and comments it as
"a GENERATED column -- Postgres computes it, never write it." That column was dropped in
0037. The exclusion is now a no-op, and the adapter uses a generic `toRow<RiskRecordInsert>`
rather than a risk-model-aware mapping. Phase 3 must verify createRiskRecord/bulk actually
write `risk_model` + `model_inputs` correctly and don't silently drop them, and reconcile
against the `toRiskRecordRow`/`fromRiskRecordRow` helpers that were supposedly added in the
risk-model work (possible incomplete/duplicated implementation).

(More Phase 3 findings to be gathered when the phase runs: `?? 0` financial fallbacks —
GitHub #15; `as never`/`as any` boundary casts; fromRow/toRow correctness; swallowed
errors; port interfaces leaking storage types.)
