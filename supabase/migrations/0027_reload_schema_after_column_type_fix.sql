-- Migration 0026 correctly altered default_duration_days to numeric(6,2)
-- (confirmed via information_schema), but PostgREST caches column type
-- info for request validation and doesn't pick up DDL changes
-- automatically -- it kept rejecting "1.2" as an invalid integer using its
-- stale cached schema, even though the real column was already fixed.
-- Same root cause as migration 0025, just triggered by a column-type
-- change instead of a newly-exposed schema.
notify pgrst, 'reload schema';
