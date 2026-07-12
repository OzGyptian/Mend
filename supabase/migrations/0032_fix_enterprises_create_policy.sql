-- Found by the same integration test run as 0031: creating a brand-new
-- enterprise failed RLS for every user, including ones who should be able to
-- self-serve onboard (firestore.rules: `allow create: if isAuthenticated();`
-- -- any signed-in user can create an enterprise, e.g. via bootstrapIfEmpty).
--
-- Root cause: migration 0004 already split 0001's single admin-gated
-- `enterprises_admin_write` into three named policies, but perpetuated the
-- same bug for insert -- `enterprises_admin_insert` still checks
-- is_enterprise_admin(id). Enterprises are the root entity: on insert, `id`
-- is the brand-new row's own id, so no enterprise_members row can exist for
-- it yet -- is_enterprise_admin(id) is unsatisfiable for any user, always,
-- by construction. An admin-gated insert policy can never permit the first
-- insert that would make someone an admin.
--
-- Also fixing enterprises_admin_delete while here: it currently lets any
-- enterprise admin delete their own enterprise. firestore.rules restricts
-- delete to isSystemAdmin() only (see `match /enterprises/{id}`) -- matching
-- that here rather than leaving a second, narrower discrepancy in place.
drop policy enterprises_admin_insert on enterprises;
drop policy enterprises_admin_delete on enterprises;

create policy enterprises_insert on enterprises
  for insert with check (auth.uid() is not null);
create policy enterprises_platform_admin_delete on enterprises
  for delete using (is_platform_admin());
