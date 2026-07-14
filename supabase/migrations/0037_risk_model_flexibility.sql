-- Decouples "what inputs does a risk model need" from the SQL schema, per
-- discussion with Bernard/Tarek 2026-07-14: beta_pert_impact_amount being a
-- Postgres GENERATED COLUMN (a single hardcoded formula) meant supporting a
-- second risk model for a future customer would require another schema
-- migration every time. Moving the formula to src/domain/risk.ts (already
-- has betaPertExposure(), previously unused for individual records --
-- only for rollups) and storing raw model-specific inputs as jsonb means
-- adding a new model is a code change (a new case + zod schema in the
-- domain layer, reviewed and tested like any other code), not a schema
-- change -- the same governance discipline as cost_codes.eac_method, just
-- with the *inputs* also decoupled from the schema, not only the formula.
--
-- probability and the computed exposure stay conceptually "shared" across
-- any model (every model probability-weights something), so probability
-- remains a first-class column; the computed exposure is no longer stored
-- at all -- it's a derived value, computed at read time in the domain
-- layer from the leaves (probability + model_inputs), per this project's
-- own "store leaves, derive outputs" rule. A GENERATED column was already
-- in tension with that rule even before the multi-model question came up.
alter table risk_records add column risk_model text not null default 'beta_pert_3point';
alter table risk_records add column model_inputs jsonb not null default '{}'::jsonb;

update risk_records set model_inputs = jsonb_build_object(
  'min', min_impact_amount,
  'mostLikely', most_likely_impact_amount,
  'max', max_impact_amount
);

alter table risk_records drop column beta_pert_impact_amount;
alter table risk_records drop column min_impact_amount;
alter table risk_records drop column most_likely_impact_amount;
alter table risk_records drop column max_impact_amount;

notify pgrst, 'reload schema';
