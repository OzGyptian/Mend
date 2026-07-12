-- Corrected against the real Project.users type
-- (Record<string, 'Project Admin' | 'Project User'>) -- migration 0001
-- guessed 'Project Member' / 'Viewer' values that don't exist in the
-- actual domain type. Caught while reading Project's real fields
-- precisely for the later migrations, not by the advisor.

alter type project_member_role rename to project_member_role_old;
create type project_member_role as enum ('Project Admin', 'Project User');
alter table project_members alter column role drop default;
alter table project_members alter column role type project_member_role using (
  case role::text when 'Project Member' then 'Project User' else role::text end
)::project_member_role;
alter table project_members alter column role set default 'Project User';
drop type project_member_role_old;
