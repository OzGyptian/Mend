import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresUserRoleAdapter } from '../../src/platform/supabase/adapters/UserRoleAdapter';
import {
  addEnterpriseMember,
  cleanupEnterprise,
  createFixtureEnterprise,
  createTestUser,
  deleteTestUser,
  makePlatformAdmin,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

// getUserRoles() reads platform_role from user_profiles.
// memberships is always [] — authoritative in enterprise_members/project_members.
// setEnterpriseRole/setProjectRole write to enterprise_members/project_members.
describe('PostgresUserRoleAdapter', () => {
  const adapter = new PostgresUserRoleAdapter();
  const userIds: string[] = [];
  let self: TestUser;
  let otherUser: TestUser;
  let platformAdmin: TestUser;
  let enterpriseId: string;

  beforeAll(async () => {
    self = await createTestUser('roles-self');
    otherUser = await createTestUser('roles-other');
    platformAdmin = await createTestUser('roles-platform-admin');
    userIds.push(self.id, otherUser.id, platformAdmin.id);
    await makePlatformAdmin(platformAdmin.id, platformAdmin.email);
    enterpriseId = await createFixtureEnterprise('roles-test-enterprise');
    // Make self an enterprise admin so they can upsert their own membership
    await addEnterpriseMember(enterpriseId, self.id, 'admin');
    await addEnterpriseMember(enterpriseId, platformAdmin.id, 'admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of userIds) await deleteTestUser(id);
    await cleanupEnterprise(enterpriseId);
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

  it('lets an enterprise admin set another user\'s enterprise role', async () => {
    await signInAs(supabase, self);
    await expect(
      adapter.setEnterpriseRole(otherUser.id, enterpriseId, 'enterprise_member'),
    ).resolves.not.toThrow();
    // getUserRoles still returns memberships=[] — reads user_profiles only
    const roles = await adapter.getUserRoles(otherUser.id);
    expect(roles.memberships).toEqual([]);
  });

  it('RLS: an ordinary non-member user cannot write another user\'s enterprise role', async () => {
    const stranger = await createTestUser('roles-stranger');
    userIds.push(stranger.id);
    await signInAs(supabase, stranger);
    // stranger is not an enterprise member, so this should be rejected by RLS
    await expect(
      adapter.setEnterpriseRole(otherUser.id, enterpriseId, 'enterprise_admin'),
    ).rejects.toThrow();
  });

  it('lets a platform admin set another user\'s enterprise role', async () => {
    await signInAs(supabase, platformAdmin);
    await expect(
      adapter.setEnterpriseRole(otherUser.id, enterpriseId, 'enterprise_admin'),
    ).resolves.not.toThrow();
  });
});
