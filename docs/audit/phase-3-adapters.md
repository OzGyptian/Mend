# Phase 3 — Boundary / Adapter Audit

Scope: the translation layer between Postgres and the domain — `caseConvert.ts`
(shared row↔object mapping), the 12 Postgres adapters, generated `database.types.ts`,
and the migration-history↔live-DB↔deployed-code alignment.

## Headline finding

### P3-0 — CRITICAL (operational, LIVE): production risk-record creation is broken — schema/code split-brain

The live database and the deployed code disagree about the shape of `risk_records`, and
**risk-record creation fails in production right now.**

Chain of evidence:
- Migration `0037_risk_model_flexibility` **dropped** `min_impact_amount`,
  `most_likely_impact_amount`, `max_impact_amount`, and the `beta_pert_impact_amount`
  GENERATED column, and **added** `risk_model text` + `model_inputs jsonb`.
- That migration was **applied directly to the live scratch DB** (via MCP `apply_migration`
  earlier this session). Verified live: `risk_records` HAS `risk_model`+`model_inputs` and
  does NOT have `min_impact_amount`/`beta_pert_impact_amount`.
- The migration file and its code companion (new RiskAdapter, regenerated types, the
  `RISK_MODELS`/`computeExposureForModel` domain registry) live **only on the open,
  unmerged PR #10** (`fix/risk-records-degenerate-estimate`, commit cb0451f). They are NOT
  in `main`.
- **`main` (what production `mend-app-tan` serves) still has the OLD RiskAdapter** — it
  builds inserts with `min_impact_amount`/`most_likely_impact_amount`/`max_impact_amount`
  and treats `beta_pert_impact_amount` as a generated column. `main`'s `database.types.ts`
  has no `model_inputs`. `main`'s `supabase/migrations/` stops at 0036.

So production's deployed adapter writes columns that no longer exist → every risk-record
insert 400s. Consistent with `risk_records` having 0 rows. `main` is internally
self-consistent (old code + old types + old migrations), but the **shared live DB is ahead
of main by one migration**, and that one migration is exactly the breaking one.

**Root cause (the real lesson) — process, not code:** schema migrations are being applied
to the *shared, production-serving* database out-of-band (directly, ahead of the PR that
carries the matching code merging to main). There is one Supabase project
(`hryshufihwwcdurlqysy`) behind both dev and the `mend-app-tan` production URL, so an
unmerged migration is immediately a production migration, with no guard that (a) the
migration file is committed to main and (b) the code that matches it is deployed.

**Immediate remediation (flagged to Bernard now, not deferred to Phase 5):** merge PR #10
(brings 0037's file + the matching adapter/types/domain to main), OR if #10 isn't ready to
merge wholesale, cherry-pick its RiskAdapter + types + domain-registry + the 0037 file to
main. Either realigns deployed code with the live schema. Until then, risk creation is
down in production.

**Process fix (Phase 5):** never apply a migration to the shared DB before its code
companion is on main; add a check that `supabase/migrations/` on main matches the live
DB's applied-migration history; and longer-term, separate the dev database from the
production-serving one (the standing note in CLAUDE.md already says this scratch project is
dev-only, but `mend-app-tan` points at it — that contradiction is the structural enabler).

## Other findings

### P3-1 — HIGH: `database.types.ts` is stale (subsumed by P3-0 on main; real on the audit branch)
The generated types describe the pre-0037 `risk_records` shape. On `main` this is
*consistent* with main's old adapter and old migrations (all three are pre-0037 together),
so main doesn't miscompile — it's just uniformly behind the live DB (that's P3-0). The
staleness becomes an active compile problem the moment any branch (like this audit branch,
or #10 post-merge) mixes new-schema access with the old types. **Remediation:** regenerate
`database.types.ts` from the live schema as part of merging #10, and add regeneration to
the migration workflow so types can't silently lag schema again.

### P3-2 — MED: `toRow<T>`/`fromRow<T>` assert types away, so generated types give no call-site safety
`caseConvert.ts` is otherwise well-built: a clean snake↔camel converter with an explicit
per-adapter rename map (for deliberately-renamed columns like `risk_id`→`risk_code`) and
omit list (for GENERATED columns). But `rowToCamel<T>(row): T` and the insert builders use
`as T` assertions on dynamically-constructed objects. That means the generated
`database.types.ts` provides **no actual type-checking at the adapter boundary** — a column
that's renamed, dropped, or added is caught only if the hand-maintained rename/omit map is
right. P3-0/P3-1 are the direct consequence: the RiskAdapter's omit list still names
`beta_pert_impact_amount` (a column dropped in 0037), and nothing flagged it because the
type is asserted, not checked. **Remediation:** where practical, type the insert builders
against the generated Insert types instead of `as T`, so schema drift surfaces at compile
time. At minimum, a test that round-trips each adapter against the live schema.

### Otherwise: the runtime boundary code is CLEAN
- Only one `?? 0` in the adapters, and it's a benign `count ?? 0` guard — **not** a silent
  financial fallback. The `?? 0` financial-fallback concern (GitHub #15) is confined to the
  ETL, not the live adapters. Good.
- The only casts are 3 `as unknown as Json` in UserRoleAdapter for jsonb coercion — benign.
- Error handling: adapters check `error` and throw with context; no swallowed catches found
  in the adapter layer.
- Realtime channel names were fixed earlier this session (unique per-subscription) — no
  regression.

## Handoffs
- **P3-0 is urgent and operational** — surfaced to Bernard immediately, outside the normal
  Phase 5 remediation queue.
- P3-1/P3-2 fold into the same fix (regenerate types + type the boundary) and should ride
  along with merging #10.
- D6 (Phase 2, stored-derived-value read paths) still needs Phase 4 to trace the read
  side; the adapters themselves don't recompute — they read stored columns as-is, so
  whether a derived value is trustworthy depends on the write path + any recompute, which
  is Phase 4's job.
