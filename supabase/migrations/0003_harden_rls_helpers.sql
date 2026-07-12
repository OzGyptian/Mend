-- Fixes from running the Supabase security advisor against the scratch
-- project (mend-migration-scratch) after applying 0001+0002. Kept as its
-- own migration rather than folded back into 0001, so the history honestly
-- reflects what was actually caught and when, same as this project's usual
-- journaling convention.
--
-- Two real issues:
-- 1. SECURITY DEFINER functions had a mutable search_path (a real
--    search_path-hijacking risk, not just a lint nag).
-- 2. The RLS helper functions were directly callable via the public REST
--    API (/rest/v1/rpc/is_platform_admin etc.) since they live in the
--    public schema with default grants. They're meant to be internal
--    helpers used inside RLS policies, not a public API surface.

create or replace function is_platform_admin() returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from user_profiles
    where user_id = auth.uid() and platform_role = 'admin'
  );
$$;

create or replace function is_enterprise_admin(ent_id uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select is_platform_admin() or exists (
    select 1 from enterprise_members
    where enterprise_id = ent_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function can_access_enterprise(ent_id uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select is_enterprise_admin(ent_id) or exists (
    select 1 from enterprise_members
    where enterprise_id = ent_id and user_id = auth.uid()
  );
$$;

create or replace function can_access_project(proj_id uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select is_enterprise_admin((select enterprise_id from projects where id = proj_id))
    or exists (
      select 1 from project_members
      where project_id = proj_id and user_id = auth.uid()
    );
$$;

create or replace function is_project_admin(proj_id uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select is_enterprise_admin((select enterprise_id from projects where id = proj_id))
    or exists (
      select 1 from project_members
      where project_id = proj_id and user_id = auth.uid() and role = 'Project Admin'
    );
$$;

create or replace function protect_platform_role() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.platform_role is distinct from old.platform_role and not is_platform_admin() then
    raise exception 'platform_role can only be changed by a platform admin';
  end if;
  return new;
end;
$$;

-- These are internal RLS helpers, not a public API surface -- revoke direct
-- callability via /rest/v1/rpc/* for both anon and authenticated roles.
-- RLS policies can still call them internally regardless of this revoke.
revoke execute on function is_platform_admin() from public, anon, authenticated;
revoke execute on function is_enterprise_admin(uuid) from public, anon, authenticated;
revoke execute on function can_access_enterprise(uuid) from public, anon, authenticated;
revoke execute on function can_access_project(uuid) from public, anon, authenticated;
revoke execute on function is_project_admin(uuid) from public, anon, authenticated;
revoke execute on function protect_platform_role() from public, anon, authenticated;
