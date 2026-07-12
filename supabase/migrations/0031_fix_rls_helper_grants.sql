-- Found by the first real integration test run against a signed-in user
-- (tests/postgres/EnterpriseAdapter.test.ts) -- every query hit "permission
-- denied for function is_enterprise_admin" / "can_access_enterprise", for
-- every operation, for every table. Not a narrow bug: this broke RLS
-- entirely for every authenticated user in the app.
--
-- Root cause: migration 0003's comment claimed "RLS policies can still call
-- [these functions] internally regardless of this revoke" -- that's wrong.
-- SECURITY DEFINER changes whose *privileges* the function body runs with
-- (so it can read enterprise_members/user_profiles even though the calling
-- role has no direct table grant), but it does not change who is allowed to
-- *invoke* the function at all. A policy's USING/WITH CHECK expression still
-- executes as the querying role (authenticated), so revoking EXECUTE from
-- authenticated breaks the policy check itself, not just the direct
-- /rest/v1/rpc/* surface it was aimed at.
--
-- Granting EXECUTE back to authenticated (not anon -- the app never queries
-- as anon, and there's no reason to invite it). This does re-open direct
-- RPC callability (e.g. /rest/v1/rpc/is_enterprise_admin), which was 0003's
-- stated concern, but on inspection that's not a real data-exposure risk:
-- every one of these functions only answers "does auth.uid() (the caller's
-- own, unspoofable identity) have this specific access" for an id the caller
-- already supplies -- it doesn't return or leak any other user's data, and a
-- user could already infer the same answer by querying their own
-- enterprise_members/project_members rows, which RLS already permits.
grant execute on function is_platform_admin() to authenticated;
grant execute on function is_enterprise_admin(uuid) to authenticated;
grant execute on function can_access_enterprise(uuid) to authenticated;
grant execute on function can_access_project(uuid) to authenticated;
grant execute on function is_project_admin(uuid) to authenticated;
grant execute on function protect_platform_role() to authenticated;
