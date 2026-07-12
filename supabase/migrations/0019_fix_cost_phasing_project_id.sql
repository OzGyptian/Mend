-- Firestore's costPhasing collection stores projectId as a direct top-level
-- field (queried alongside costCodeId, not derived via a join) -- migration
-- 0002 only added cost_code_id. Adding the real column instead of relying
-- on a join-through-cost_codes workaround in the adapter.
alter table cost_phasing add column project_id uuid references projects (id) on delete cascade;
create index on cost_phasing (project_id);
