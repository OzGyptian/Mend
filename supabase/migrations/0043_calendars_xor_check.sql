-- Enforce that every calendar row belongs to exactly one scope:
-- either an enterprise OR a project, never both, never neither.
alter table calendars
  add constraint calendars_scope_xor check (
    (enterprise_id is not null and project_id is null) or
    (enterprise_id is null     and project_id is not null)
  );
