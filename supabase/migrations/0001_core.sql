-- Core identity, membership, and enterprise/project scaffolding.
-- Everything else in the schema hangs off enterprises/projects via FK.

create extension if not exists "pgcrypto";

create type platform_role as enum ('admin', 'user');
create type project_member_role as enum ('Project Admin', 'Project Member', 'Viewer');
create type enterprise_member_role as enum ('admin', 'member');

-- One row per Supabase Auth user, mirrors what UserProfile/userRoles meant in Firestore.
-- platform_role replaces the 9-site hardcoded isSystemAdmin() email check.
create table user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text not null,
  platform_role platform_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table enterprises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table enterprise_members (
  enterprise_id uuid not null references enterprises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role enterprise_member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (enterprise_id, user_id)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references enterprises (id) on delete cascade,
  project_code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enterprise_id, project_code)
);

create table project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role project_member_role not null default 'Project Member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references enterprises (id) on delete cascade,
  invited_email text not null,
  role enterprise_member_role not null default 'member',
  status text not null default 'pending',
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- RLS helper functions. Mirror firestore.rules' isSystemAdmin() / isAdminOfEnterprise()
-- / canAccessProject() exactly so authorization behavior doesn't drift during migration.

create function is_platform_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from user_profiles
    where user_id = auth.uid() and platform_role = 'admin'
  );
$$;

create function is_enterprise_admin(ent_id uuid) returns boolean
language sql security definer stable as $$
  select is_platform_admin() or exists (
    select 1 from enterprise_members
    where enterprise_id = ent_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create function can_access_enterprise(ent_id uuid) returns boolean
language sql security definer stable as $$
  select is_enterprise_admin(ent_id) or exists (
    select 1 from enterprise_members
    where enterprise_id = ent_id and user_id = auth.uid()
  );
$$;

create function can_access_project(proj_id uuid) returns boolean
language sql security definer stable as $$
  select is_enterprise_admin((select enterprise_id from projects where id = proj_id))
    or exists (
      select 1 from project_members
      where project_id = proj_id and user_id = auth.uid()
    );
$$;

create function is_project_admin(proj_id uuid) returns boolean
language sql security definer stable as $$
  select is_enterprise_admin((select enterprise_id from projects where id = proj_id))
    or exists (
      select 1 from project_members
      where project_id = proj_id and user_id = auth.uid() and role = 'Project Admin'
    );
$$;

-- Protects platformRole from self-grant (closes the Phase 13.A hole at the DB layer,
-- which RLS row-policies alone can't do since they don't restrict individual columns).
create function protect_platform_role() returns trigger
language plpgsql security definer as $$
begin
  if new.platform_role is distinct from old.platform_role and not is_platform_admin() then
    raise exception 'platform_role can only be changed by a platform admin';
  end if;
  return new;
end;
$$;

create trigger user_profiles_protect_platform_role
  before update on user_profiles
  for each row execute function protect_platform_role();

alter table user_profiles enable row level security;
alter table enterprises enable row level security;
alter table enterprise_members enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table invitations enable row level security;

create policy user_profiles_self_or_admin on user_profiles
  for select using (user_id = auth.uid() or is_platform_admin());
create policy user_profiles_self_update on user_profiles
  for update using (user_id = auth.uid() or is_platform_admin());

create policy enterprises_member_read on enterprises
  for select using (can_access_enterprise(id));
create policy enterprises_admin_write on enterprises
  for all using (is_enterprise_admin(id));

create policy enterprise_members_read on enterprise_members
  for select using (can_access_enterprise(enterprise_id));
create policy enterprise_members_admin_write on enterprise_members
  for all using (is_enterprise_admin(enterprise_id));

create policy projects_member_read on projects
  for select using (can_access_project(id));
create policy projects_admin_write on projects
  for all using (is_enterprise_admin(enterprise_id));

create policy project_members_read on project_members
  for select using (can_access_project(project_id));
create policy project_members_admin_write on project_members
  for all using (is_project_admin(project_id));

create policy invitations_enterprise_admin on invitations
  for all using (is_enterprise_admin(enterprise_id));
