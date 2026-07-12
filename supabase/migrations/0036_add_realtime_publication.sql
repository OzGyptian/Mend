-- Found via live UI smoke-testing (not any adapter unit test): creating a
-- new enterprise through the real "Welcome to Mend" flow got stuck on
-- "Creating..." forever, even though the row and membership were created
-- successfully (confirmed directly in the database). App.tsx relies on
-- EnterpriseAdapter.subscribeByUserId()'s postgres_changes subscription on
-- enterprise_members to detect the new membership and transition the UI
-- away from the "no enterprise" screen -- there's no other code path that
-- resets isSubmittingEnterprise or navigates on success.
--
-- Root cause: the supabase_realtime publication had zero tables in it.
-- Every single postgres_changes subscription across all 12 adapters --
-- used throughout the app for live updates on risks, changes, schedule
-- items, calendars, saved views, subcontracts, progress items, and more --
-- was silently non-functional. Each adapter's subscribe method does an
-- initial fetch-and-emit (which works and is why this wasn't caught by the
-- adapter integration tests, which only exercised that initial callback),
-- but the live-update half never fires for any table, for any change.
alter publication supabase_realtime add table
  enterprises, enterprise_members, projects, project_members,
  cost_codes, sheets, forecast_rows, etc_details, actual_costs, baseline_budgets, cost_phasing,
  changes, change_records, risks, risk_records,
  subcontracts, subcontract_line_items, invoices,
  progress_packages, progress_items, rules_of_credit, progress_reporting_periods,
  schedule_items, calendars,
  procurement_items, procurement_step_definitions,
  saved_views, user_roles;
