-- Audit log hardening: overwrite actor fields from the authenticated JWT
-- so clients cannot spoof who performed an action.
--
-- BEFORE INSERT: if auth.uid() is available (real user session), the DB
-- overwrites whatever actor_user_id / actor_email the client sent with
-- values derived from the session. Service-role inserts (auth.uid() = null)
-- are trusted and pass through as-is (used for server-side audit writes).

create or replace function enforce_audit_actor()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.uid() is not null then
    new.actor_user_id := auth.uid();
    select email
      into new.actor_email
      from user_profiles
     where user_id = auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_enforce_audit_actor
before insert on audit_logs
for each row execute function enforce_audit_actor();
