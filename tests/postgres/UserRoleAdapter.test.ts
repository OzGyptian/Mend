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

// getUserRoles() now reads platform_role from user_profiles (the RLS-authoritative table).
// memberships is always [] — membership is authoritative in enterprise_members/project_members.
// setEnterpriseRole/setProjectRole still write to user_roles for legacy reasons but those
// writes are not read back by getUserRoles. The RLS tests below verify the write policies.
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

  it('returns platformRole=null and empty memberships for an ordinary user', async () => {
    await signInAs(supabase, self);
    const roles = await adapter.getUserRoles(self.id);
    expect(roles.platformRole).toBeNull();
    expect(roles.memberships).toEqual([]);
  });

  it('returns platformRole=platform_admin for a platform admin (reads user_profiles)', async () => {
    await signInAs(supabase, platformAdmin);
    const roles = await adapter.getUserRoles(platformAdmin.id);
    expect(roles.platformRole).toBe('platform_admin');
    expect(roles.memberships).toEqual([]);
  });

  it('lets a user write their own enterprise role in user_roles (legacy write path)', async () => {
    await signInAs(supabase, self);
    // setEnterpriseRole writes to user_roles.memberships — legacy dead storage.
    // The write itself should succeed (no RLS violation for self).
    await expect(
      adapter.setEnterpriseRole(self.id, '11111111-1111-1111-1111-111111111111', 'enterprise_admin'),
    ).resolves.not.toThrow();
    // getUserRoles no longer reads memberships from user_roles; reads platform_role only.
    const roles = await adapter.getUserRoles(self.id);
    expect(roles.memberships).toEqual([]);
  });

  it('RLS: an ordinary user cannot write another user\'s role', async () => {
    await signInAs(supabase, self);
    await expect(
      adapter.setEnterpriseRole(otherUser.id, '11111111-1111-1111-1111-111111111111', 'enterprise_admin'),
    ).rejects.toThrow();
  });

  it('RLS: a platform admin can write another user\'s role in user_roles (legacy write path)', async () => {
    await signInAs(supabase, platformAdmin);
    // Write succeeds — platform admin bypasses RLS on user_roles.
    await expect(
      adapter.setEnterpriseRole(otherUser.id, '33333333-3333-3333-3333-333333333333', 'enterprise_admin'),
    ).resolves.not.toThrow();
  });
});
