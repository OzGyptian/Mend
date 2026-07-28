-- D1 remainder (issue #25) + fix for a live breakage introduced by 0038.
--
-- METHOD NOTE (the lesson from 0038 and from incident P3-0): every CHECK below was
-- derived from the vocabulary the UI actually writes, cross-checked against the
-- TypeScript type, the zod schema, and the live row values — not from assumption.
-- A CHECK that disagrees with the UI is a live outage, as STEP 1 demonstrates.

-- ──────────────────────────────────────────────────────────────────────────────
-- STEP 1 (FIX — live breakage): projects.status
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
-- STEP 2: the four categoricals 0038 deferred, now that their vocabularies are
-- empirically confirmed (live values ⊆ UI options == TS type in every case).
-- ──────────────────────────────────────────────────────────────────────────────

-- cost_codes.eac_method — a strategy switch: a typo here mis-computes cost-at-completion,
-- which is the D1 "silent wrong number" risk in its most expensive form.
-- UI: cost-codes/columns.tsx:931. Live: Sub-Contract Management 66, ETC Details 59,
-- Manual 11, Change Management 6 (142 rows, no NULL, no drift).
alter table cost_codes
  add constraint cost_codes_eac_method_check
  check (eac_method is null or eac_method in (
    'Manual', 'Change Management', 'ETC Details', 'Sub-Contract Management'
  ));

-- progress_items phasing curves — the progress module has its own lowercase vocabulary,
-- consistent across UI (progress-tracking/columns.tsx:1075), the zod PhasingCurveSchema,
-- domain/types.ts, and its own distribution function. Constrained to that set as-is;
-- unifying it with domain/phasing.ts's title-case vocabulary is a behaviour change and
-- is deliberately NOT bundled here (see JOURNAL / issue note).
-- Live: phasing_curve = even 5, Bell 1; current_phasing_curve = NULL 5, 'front load' 1.
alter table progress_items
  add constraint progress_items_phasing_curve_check
  check (phasing_curve is null or phasing_curve in (
    'Scurve', 'Bell', 'front load', 'back load', 'even'
  ));

alter table progress_items
  add constraint progress_items_current_phasing_curve_check
  check (current_phasing_curve is null or current_phasing_curve in (
    'Scurve', 'Bell', 'front load', 'back load', 'even'
  ));

-- progress_items.phasing_method — UI ProgressItemsPanel.tsx:449; TS 'Auto' | 'Manual'.
-- Live: Auto 6. current_phasing_method shares the vocabulary.
alter table progress_items
  add constraint progress_items_phasing_method_check
  check (phasing_method is null or phasing_method in ('Auto', 'Manual'));

alter table progress_items
  add constraint progress_items_current_phasing_method_check
  check (current_phasing_method is null or current_phasing_method in ('Auto', 'Manual'));

-- etc_details.phasing_method — a DIFFERENT vocabulary for a same-named concept
-- (TS line 432: 'Manual' | 'Auto-Phase'). 0038 deferred this as "full set unknown";
-- live data confirms exactly the declared pair: Manual 36, Auto-Phase 14.
alter table etc_details
  add constraint etc_details_phasing_method_check
  check (phasing_method is null or phasing_method in ('Manual', 'Auto-Phase'));

-- sheets.forecast_method — UI ProjectDashboard.tsx:391-392; TS ForecastMethod.
-- Live: commitment 2.
alter table sheets
  add constraint sheets_forecast_method_check
  check (forecast_method is null or forecast_method in ('commitment', 'time-based'));

-- ──────────────────────────────────────────────────────────────────────────────
-- STILL DEFERRED (deliberately, with reasons)
--
--   invoice_items.type — all 6 live rows are NULL and no UI writes a value; there is
--     no evidence for a canonical set. Constraining on a guess is how 0038 broke
--     projects.status. Revisit when the column is actually used.
--
--   changes.status — 0038's CHECK is a strict SUPERSET of the UI options
--     (Approved/Pending/Rejected ⊂ Open/Pending/Under Review/Approved/Rejected/Cancelled),
--     so it cannot break a UI action. Left as-is; tightening it is cosmetic.
--
--   Unifying the two phasing vocabularies (progress lowercase vs domain title-case)
--     and the duplicate distribution engine in ProgressTracking.tsx — a behaviour
--     change, needs its own characterization test. Tracked separately.
-- ──────────────────────────────────────────────────────────────────────────────
