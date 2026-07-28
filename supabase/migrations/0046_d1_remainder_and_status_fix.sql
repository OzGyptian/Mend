-- D1 remainder (issue #25) + fix for a live breakage introduced by 0038.
--
-- METHOD NOTE (the lesson from 0038 and from incident P3-0): every CHECK below was
-- derived from the vocabulary the UI actually writes, cross-checked against the
-- TypeScript type, the zod schema, and the live row values -- not from assumption.
-- A CHECK that disagrees with the UI is a live outage, as STEP 1 demonstrates.

-- ──────────────────────────────────────────────────────────────────────────────
-- STEP 1 (FIX -- live breakage): projects.status
--
-- 0038 added projects_status_check allowing ('Active','Inactive','Complete','On Hold').
-- But the status dropdown offers Active / On Hold / Closed / Archived
-- (EnterpriseAdmin.tsx and enterprise-admin/columns.tsx), and domain/types.ts declares
--   ProjectStatus = 'Active' | 'On Hold' | 'Closed' | 'Archived'.
-- Only 'Active' and 'On Hold' overlap, so selecting "Closed" or "Archived" has been
-- failing with a constraint violation since 0038 was applied. Verified live:
--   update projects set status='Closed' -> ERROR: violates check constraint
--                                                  "projects_status_check"
-- 'Inactive'/'Complete' are writable by nothing in the codebase. Live data holds only
-- 'Active' (5) and NULL (4), so realigning to the UI vocabulary loses no rows.
-- ──────────────────────────────────────────────────────────────────────────────

alter table projects drop constraint if exists projects_status_check;

alter table projects
  add constraint projects_status_check
  check (status is null or status in ('Active', 'On Hold', 'Closed', 'Archived'));

-- ──────────────────────────────────────────────────────────────────────────────
-- STEP 2: the two categoricals that are genuinely unconstrained.
--
-- CORRECTION to the deferral note in 0038: of the columns 0038 listed as "pending
-- investigation", the progress_items phasing columns and etc_details.phasing_method
-- were ALREADY constrained -- inline, at table-creation time, by 0008 and 0017
-- respectively (Postgres auto-named them progress_items_phasing_curve_check etc.).
-- Adding them again fails with "constraint already exists"; the first attempt to apply
-- this migration did exactly that. Their existing vocabularies match the UI/TS sets
-- exactly, so nothing is needed there. Only these two columns were ever unguarded,
-- confirmed empirically by writing an invalid value and observing it accepted.
-- ──────────────────────────────────────────────────────────────────────────────

-- cost_codes.eac_method -- a strategy switch: a typo here mis-computes cost-at-completion,
-- which is the D1 "silent wrong number" risk in its most expensive form.
-- UI: cost-codes/columns.tsx:931. Live: Sub-Contract Management 66, ETC Details 59,
-- Manual 11, Change Management 6 (142 rows, no NULL, no drift).
alter table cost_codes
  add constraint cost_codes_eac_method_check
  check (eac_method is null or eac_method in (
    'Manual', 'Change Management', 'ETC Details', 'Sub-Contract Management'
  ));

-- sheets.forecast_method -- UI ProjectDashboard.tsx:391-392; TS ForecastMethod.
-- Live: commitment 2.
alter table sheets
  add constraint sheets_forecast_method_check
  check (forecast_method is null or forecast_method in ('commitment', 'time-based'));

-- ──────────────────────────────────────────────────────────────────────────────
-- ALREADY CONSTRAINED ELSEWHERE (no action needed -- documented so the next person
-- does not repeat 0038's deferral):
--   progress_items.phasing_curve / current_phasing_curve  -- 0008
--       in ('Scurve','Bell','front load','back load','even')
--   progress_items.phasing_method / current_phasing_method -- 0008  in ('Auto','Manual')
--   etc_details.phasing_method                             -- 0017  in ('Manual','Auto-Phase')
--
-- STILL DEFERRED (deliberately, with reasons):
--   invoice_items.type -- all 6 live rows are NULL and no UI writes a value; there is
--     no evidence for a canonical set. Constraining on a guess is how 0038 broke
--     projects.status. Revisit when the column is actually used.
--
--   changes.status -- the CHECK from 0038 is a strict SUPERSET of the UI options
--     (Approved/Pending/Rejected within Open/Pending/Under Review/Approved/Rejected/
--     Cancelled), so it cannot break a UI action. Tightening it is cosmetic.
--
--   Unifying the two phasing vocabularies (progress lowercase vs domain title-case)
--     and the duplicate distribution engine in ProgressTracking.tsx -- a behaviour
--     change, needs its own characterization test. Tracked separately.
-- ──────────────────────────────────────────────────────────────────────────────
