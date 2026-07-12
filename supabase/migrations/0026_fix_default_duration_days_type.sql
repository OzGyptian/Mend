-- Caught by the first real --apply run against live data: real
-- procurement step definitions have fractional day durations (e.g. 1.2),
-- not just whole days. The domain type (defaultDurationDays?: number)
-- doesn't distinguish int vs float, so this only surfaced against real
-- data, not from reading the type definition.
alter table procurement_step_definitions
  alter column default_duration_days type numeric(6, 2) using default_duration_days::numeric;
