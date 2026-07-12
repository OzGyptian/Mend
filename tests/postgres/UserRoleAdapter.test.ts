import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresUserRoleAdapter } from '../../src/platform/supabase/adapters/UserRoleAdapter';
import {
  createTestUser,
  deleteTestUser,
  makePlatformAdmin,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

// firestore.rules' /userRoles/{userId} only ever allowed isSystemAdmin() ||
// self -- not "any enterprise admin" -- so an ordinary enterprise admin
// granting a teammate a role goes through the privileged server-side
// /api/accept-invite flow (service role, bypasses RLS), never a direct
// client-side write to another user's row. user_roles' RLS matches that
// exactly (see supabase/migrations/0015_user_roles_table.sql).
describe('PostgresUserRoleAdapter', () => {
  const adapter = new PostgresUserRoleAdapter();
  const userIds: string[] = [];
  let self: TestUser;
  let otherUser: TestUser;
  let platformAdmin: TestUser;

  beforeAll(async () => {
    self = await createTestUser('roles-self');
    otherUser = await createTestUser('roles-other');
    platformAdmin = await createTestUser('roles-platform-admin');
    userIds.push(self.id, otherUser.id, platformAdmin.id);
    await makePlatformAdmin(platformAdmin.id, platformAdmin.email);
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('returns an empty role set for a user with no row yet', async () => {
    await signInAs(supabase, self);
    const roles = await adapter.getUserRoles(self.id);
    expect(roles.memberships).toEqual([]);
  });

  it('lets a user set their own enterprise and project role', async () => {
    await signInAs(supabase, self);
    await adapter.setEnterpriseRole(self.id, '11111111-1111-1111-1111-111111111111', 'enterprise_admin');
    await adapter.setProjectRole(self.id, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'project_admin');

    const roles = await adapter.getUserRoles(self.id);
    const membership = roles.memberships.find((m) => m.enterpriseId === '11111111-1111-1111-1111-111111111111');
    expect(membership?.role).toBe('enterprise_admin');
    expect(membership?.projectRoles['22222222-2222-2222-2222-222222222222']).toBe('project_admin');
  });

  it('RLS: an ordinary user cannot set another user\'s role', async () => {
    await signInAs(supabase, self);
    await expect(
      adapter.setEnterpriseRole(otherUser.id, '11111111-1111-1111-1111-111111111111', 'enterprise_admin'),
    ).rejects.toThrow();
  });

  it('RLS: a platform admin can set another user\'s role', async () => {
    await signInAs(supabase, platformAdmin);
    await adapter.setEnterpriseRole(otherUser.id, '33333333-3333-3333-3333-333333333333', 'enterprise_admin');
    const roles = await adapter.getUserRoles(otherUser.id);
    expect(roles.memberships.find((m) => m.enterpriseId === '33333333-3333-3333-3333-333333333333')?.role).toBe('enterprise_admin');
  });
});
