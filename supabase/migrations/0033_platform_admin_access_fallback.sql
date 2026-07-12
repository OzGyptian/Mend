-- firestore.rules always included isSystemAdmin() as an alternate access
-- path for both enterprises and projects (`isSystemAdmin() || ... ||
-- isAdminOfEnterprise(...)`), but can_access_enterprise() / can_access_project()
-- (migration 0003) only check enterprise_members / project_members --
-- dropped the platform-admin fallback during translation. Confirmed missing
-- via the same integration test run as 0031/0032: a platform admin creating
-- an enterprise on someone else's behalf (SystemAdmin.tsx, adminUsers: [])
-- could never read it back, since they have no membership row for it.
create or replace function can_access_enterprise(ent_id uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select is_platform_admin() or is_enterprise_admin(ent_id) or exists (
    select 1 from enterprise_members
    where enterprise_id = ent_id and user_id = auth.uid()
  );
$$;

create or replace function can_access_project(proj_id uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select is_platform_admin() or is_enterprise_admin((select enterprise_id from projects where id = proj_id))
    or exists (
      select 1 from project_members
      where project_id = proj_id and user_id = auth.uid()
    );
$$;
