-- The previous fix (0026, default_duration_days) didn't resolve the error
-- -- procurement_step_definitions has a second integer column, "order",
-- which is at least as likely a culprit: fractional sort orders (e.g. 1.2)
-- are a common pattern for inserting an item between two existing ones
-- without renumbering the whole list. Fixing both rather than guessing
-- with another live-data read (Firestore quota is precious).
alter table procurement_step_definitions
  alter column "order" type numeric(10, 2) using "order"::numeric;
notify pgrst, 'reload schema';
