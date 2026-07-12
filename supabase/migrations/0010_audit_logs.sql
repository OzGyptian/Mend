-- Write-only audit trail, shape confirmed against the actual
-- logAuditAction() implementation in src/platform/firestore/audit.ts
-- rather than guessed (CLAUDE.md notes this collection as "write-only, no
-- read type needed" -- true for the domain layer, but the real fields are
-- concrete and worth getting right for a real table).
--
-- No update or delete policy at all -- once written, an audit row is
-- permanent. Only insert (any project/enterprise member) and select
-- (enterprise admins, to actually review the log) are granted.

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references enterprises (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,
  actor_user_id uuid references auth.users (id),
  actor_email text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on audit_logs (enterprise_id);
create index on audit_logs (project_id);
create index on audit_logs (actor_user_id);

alter table audit_logs enable row level security;

create policy audit_logs_insert on audit_logs for insert with check (can_access_enterprise(enterprise_id));
create policy audit_logs_select on audit_logs for select using (is_enterprise_admin(enterprise_id));
-- Deliberately no update or delete policy -- audit rows are immutable once written.
