-- D1: Enum normalisation and CHECK constraints
-- Wave 1.2 remediation from docs/audit/phase-5-report.md
--
-- What already exists (discovered during audit — do NOT add duplicates):
--   risks_status_check, risks_strategy_check
--   subcontracts_payment_type_check, subcontracts_status_check
--   subcontracts_default_distribution_check, subcontracts_default_phasing_source_check
--   subcontract_line_items_type_check, subcontract_line_items_status_check
--   subcontract_line_items_distribution_check, subcontract_line_items_phasing_source_check
--   invoices_status_check, progress_reporting_periods_status_check
--
-- What this migration adds:
--   1. Normalise case drift in cost_phasing and forecast_rows distribution_method columns
--   2. Add CHECK on cost_phasing.distribution_method
--   3. Add CHECK on forecast_rows.distribution_method
--   4. Add CHECK on projects.status
--   5. Add CHECK on changes.status
--
-- What this migration does NOT touch (intentional, pending investigation):
--   - progress_items.phasing_curve / current_phasing_curve — vocabulary conflict between
--     domain/types.ts (lowercase 'even', 'front load', 'Scurve') and phasing.ts engine
--     ('Even', 'Front load', 'S-Curve'). Needs separate vocabulary unification first.
--   - invoice_items.type — all current rows NULL; no clear canonical set yet.
--   - etc_details.phasing_method — 'Manual'/'Auto-Phase' appear stable but full set unknown.
--   - cost_codes.eac_method — value set may grow with future EAC methods.

-- ──────────────────────────────────────────────────────────────────────────────
-- STEP 1: Normalise case drift in distribution_method
-- ──────────────────────────────────────────────────────────────────────────────

-- cost_phasing had 1 row 'even' and 1 row 'manual'
update cost_phasing set distribution_method = 'Even'   where distribution_method = 'even';
update cost_phasing set distribution_method = 'Manual' where distribution_method = 'manual';

-- forecast_rows had 9 rows 'even'
update forecast_rows set distribution_method = 'Even' where distribution_method = 'even';

-- ──────────────────────────────────────────────────────────────────────────────
-- STEP 2: Add CHECK constraints (only those not already present)
-- ──────────────────────────────────────────────────────────────────────────────

-- Canonical distribution set from src/domain/phasing.ts switch cases.
-- Includes 'Bell' (bare) because the phasing engine handles it alongside 'Bell Curve'.
-- Includes 'Manual' to cover manually-set period_values (phasing engine skips recalc).
-- Aligns with the existing subcontracts_default_distribution_check values.
alter table cost_phasing
  add constraint cost_phasing_distribution_method_check
  check (distribution_method in (
    'Even', 'Bell', 'Bell Curve', 'Front load', 'Back load', 'S-Curve', 'Profile', 'Manual'
  ));

alter table forecast_rows
  add constraint forecast_rows_distribution_method_check
  check (distribution_method in (
    'Even', 'Bell', 'Bell Curve', 'Front load', 'Back load', 'S-Curve', 'Profile', 'Manual'
  ));

-- projects.status: nullable column, NULL means draft/unset
alter table projects
  add constraint projects_status_check
  check (status is null or status in ('Active', 'Inactive', 'Complete', 'On Hold'));

-- changes.status: nullable column
alter table changes
  add constraint changes_status_check
  check (status is null or status in (
    'Open', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Cancelled'
  ));
