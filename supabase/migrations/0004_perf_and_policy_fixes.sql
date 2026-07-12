-- Performance advisor fixes after 0001-0003. Same rationale as 0003: kept
-- as its own migration rather than rewritten into earlier files.
--
-- Three real issues:
-- 1. Unindexed FK columns (genuine query-performance concern once these
--    tables hold real data, not just a lint nag).
-- 2. auth.uid() re-evaluated per row in two user_profiles policies instead
--    of once -- the well-known Supabase RLS perf gotcha, fixed by wrapping
--    in (select auth.uid()). Note the is_*_admin/can_access_* helper
--    functions were already marked `stable` and didn't trigger this --
--    only the two policies that called auth.uid() directly did.
-- 3. "for all" admin policies overlapped with the plain read policies on
--    SELECT (Postgres evaluates every permissive policy for a given
--    role+action, even redundant ones) -- split into insert/update/delete
--    so each table has exactly one policy per role+action.

create index on enterprise_members (user_id);
create index on project_members (user_id);
create index on invitations (enterprise_id);
create index on invitations (invited_by);
create index on cost_codes (project_id);
create index on cost_code_assigned_users (user_id);
create index on sheets (project_id);
create index on etc_details (cost_code_id);
create index on actual_costs (project_id);
create index on actual_costs (cost_code_id);
create index on baseline_budgets (project_id);
create index on baseline_budgets (cost_code_id);
create index on cost_phasing (cost_code_id);
create index on period_snapshots (project_id);

drop policy user_profiles_self_or_admin on user_profiles;
drop policy user_profiles_self_update on user_profiles;
create policy user_profiles_self_or_admin on user_profiles
  for select using (user_id = (select auth.uid()) or is_platform_admin());
create policy user_profiles_self_update on user_profiles
  for update using (user_id = (select auth.uid()) or is_platform_admin());

drop policy enterprises_admin_write on enterprises;
create policy enterprises_admin_insert on enterprises for insert with check (is_enterprise_admin(id));
create policy enterprises_admin_update on enterprises for update using (is_enterprise_admin(id));
create policy enterprises_admin_delete on enterprises for delete using (is_enterprise_admin(id));

drop policy enterprise_members_admin_write on enterprise_members;
create policy enterprise_members_admin_insert on enterprise_members for insert with check (is_enterprise_admin(enterprise_id));
create policy enterprise_members_admin_update on enterprise_members for update using (is_enterprise_admin(enterprise_id));
create policy enterprise_members_admin_delete on enterprise_members for delete using (is_enterprise_admin(enterprise_id));

drop policy projects_admin_write on projects;
create policy projects_admin_insert on projects for insert with check (is_enterprise_admin(enterprise_id));
create policy projects_admin_update on projects for update using (is_enterprise_admin(enterprise_id));
create policy projects_admin_delete on projects for delete using (is_enterprise_admin(enterprise_id));

drop policy project_members_admin_write on project_members;
create policy project_members_admin_insert on project_members for insert with check (is_project_admin(project_id));
create policy project_members_admin_update on project_members for update using (is_project_admin(project_id));
create policy project_members_admin_delete on project_members for delete using (is_project_admin(project_id));
