-- Five real findings from the first --all-projects --apply run, across a
-- much wider real dataset than the single-project test.

-- period_snapshots never had a created_at column -- migration 0002's
-- original snapshot_taken_at was dropped by 0014's rename pass and
-- nothing replaced it, but the domain type (and this ETL script) expects one.
alter table period_snapshots add column created_at timestamptz not null default now();

-- Real Risk.mitigation / residualExposure hold narrative text ("Additional
-- boreholes ordered, structural engineer reviewing...") in practice, not
-- the number the domain type comment claims ("Legacy, kept for
-- compatibility") -- the type was already stale relative to real usage.
-- Widened to text rather than losing real content by forcing a coercion.
alter table risks alter column mitigation type text using mitigation::text;
alter table risks alter column residual_exposure type text using residual_exposure::text;

-- caseConvert.ts's camelToSnake produces "user_field1" (no underscore
-- before a trailing digit) for userField1, but migration 0008 named the
-- columns user_field_1 (with underscore) -- a genuine mismatch between the
-- schema and what the generic case converter actually produces. Renaming
-- the columns rather than special-casing this one table's conversion.
alter table rules_of_credit rename column user_field_1 to user_field1;
alter table rules_of_credit rename column user_field_2 to user_field2;
alter table rules_of_credit rename column user_field_3 to user_field3;
alter table rules_of_credit rename column user_field_4 to user_field4;
alter table rules_of_credit rename column user_field_5 to user_field5;

-- Some real Change records have no changeId -- unlike cost_codes.name
-- (which can fall back to code), there's no sensible placeholder for a
-- missing change code, but the record can still carry a real description/
-- status. Relaxed rather than dropping the whole record.
alter table changes alter column change_code drop not null;

-- Some real ProcurementItem records have no packageId -- lower-stakes
-- than a missing risk description or schedule activity id, so relaxed
-- rather than skipped.
alter table procurement_items alter column package_id drop not null;

notify pgrst, 'reload schema';
