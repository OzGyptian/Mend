-- Same underlying problem as 0032 (enterprises insert), one level down:
-- adding the FIRST enterprise_members row for a brand-new enterprise
-- requires being an existing admin of that enterprise
-- (is_enterprise_admin(enterprise_id)) -- unsatisfiable for the very row
-- that would make someone an admin. Firestore never had this problem:
-- adminUsers/users were fields embedded directly in the enterprises
-- document, written atomically by the same `allow create: if
-- isAuthenticated()` rule that created the enterprise itself. Normalizing
-- them into a separate enterprise_members table (a reasonable 3NF decision)
-- introduced a bootstrap case Firestore's rules never had to solve.
--
-- Rejected approach: loosening enterprise_members' insert policy to allow
-- self-admin whenever the enterprise currently has zero members. That's
-- unsafe -- "zero members" isn't the same fact as "this enterprise is brand
-- new"; an existing enterprise could legitimately end up with zero members
-- (last admin removed, a data gap), and the same policy would then let any
-- authenticated user grant themselves admin over someone else's real
-- enterprise.
--
-- Instead: a SECURITY DEFINER function that creates the enterprise and its
-- first admin membership atomically in one call, so no general-purpose
-- policy has to infer "new" from "empty". enterprise_members' existing
-- insert policy (is_enterprise_admin(enterprise_id)) is untouched --
-- ordinary membership changes still go through it as before. This function
-- enforces its own narrower rule: callers may only name themselves as
-- admin (the normal self-serve create flow), unless they're a platform
-- admin, who may also create a shell enterprise with no admin yet (the
-- SystemAdmin.tsx provisioning-on-someone's-behalf case) or assign
-- someone else directly.
create or replace function create_enterprise_with_admins(
  p_name text,
  p_theme text default 'dark',
  p_logo_url text default null,
  p_admin_user_ids uuid[] default null
) returns enterprises
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
  v_caller uuid := auth.uid();
  v_admin_ids uuid[] := coalesce(p_admin_user_ids, array[]::uuid[]);
  v_result enterprises;
begin
  if v_caller is null then
    raise exception 'must be authenticated to create an enterprise';
  end if;

  if array_length(v_admin_ids, 1) is null then
    if not is_platform_admin() then
      raise exception 'only a platform admin may create an enterprise with no admins assigned';
    end if;
  elsif not is_platform_admin() and (array_length(v_admin_ids, 1) <> 1 or v_admin_ids[1] <> v_caller) then
    raise exception 'you may only add yourself as admin when creating an enterprise';
  end if;

  insert into enterprises (id, name, theme, logo_url)
  values (v_id, p_name, p_theme, p_logo_url)
  returning * into v_result;

  if array_length(v_admin_ids, 1) is not null then
    insert into enterprise_members (enterprise_id, user_id, role)
    select v_id, uid, 'admin' from unnest(v_admin_ids) as uid;
  end if;

  return v_result;
end;
$$;

grant execute on function create_enterprise_with_admins(text, text, text, uuid[]) to authenticated;
