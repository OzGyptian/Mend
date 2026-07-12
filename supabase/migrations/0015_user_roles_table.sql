-- Mirrors the Firestore `userRoles` collection, which is genuinely separate
-- from the legacy Project.users / Enterprise.adminUsers fields that
-- actually drive live authorization today (mirrored as enterprise_members
-- / project_members in migration 0001). Confirmed via grep: UserRoleRepository
-- has zero usages anywhere in src/components or App.tsx -- this is dormant
-- scaffolding for a future, more granular role system
-- (domain/roles.ts: 'enterprise_admin'/'enterprise_member',
-- 'project_admin'/'project_writer'/'project_reader'/'project_guest'), not
-- a replacement for the tables that are live today. Mirrored 1:1 rather
-- than unified with enterprise_members/project_members, since the current
-- codebase itself keeps them separate and this migration's job is to
-- faithfully carry data over, not redesign an unused system.
create table user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  platform_role text,
  memberships jsonb not null default '[]'::jsonb
);

alter table user_roles enable row level security;

create policy user_roles_self_or_admin on user_roles
  for select using (user_id = (select auth.uid()) or is_platform_admin());
create policy user_roles_self_update on user_roles
  for update using (user_id = (select auth.uid()) or is_platform_admin());
create policy user_roles_self_insert on user_roles
  for insert with check (user_id = (select auth.uid()) or is_platform_admin());
