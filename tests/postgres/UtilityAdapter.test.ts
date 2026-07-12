import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresUtilityAdapter } from '../../src/platform/supabase/adapters/UtilityAdapter';
import {
  addEnterpriseMember,
  cleanupEnterprise,
  createFixtureEnterprise,
  createTestUser,
  deleteTestUser,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

describe('PostgresUtilityAdapter', () => {
  const adapter = new PostgresUtilityAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let enterpriseId: string;
  let enterpriseAdmin: TestUser;
  let otherUser: TestUser;

  beforeAll(async () => {
    enterpriseAdmin = await createTestUser('util-ent-admin');
    otherUser = await createTestUser('util-other');
    userIds.push(enterpriseAdmin.id, otherUser.id);

    enterpriseId = await createFixtureEnterprise('Utility Test Enterprise');
    enterpriseIds.push(enterpriseId);
    await addEnterpriseMember(enterpriseId, enterpriseAdmin.id, 'admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('lets a user create and read their own saved view, invisible to another user', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const view = await adapter.createSavedView({
      userId: enterpriseAdmin.id,
      tableId: 'cost-codes-grid',
      name: 'My View',
      columns: ['code', 'name'],
    } as never);
    expect(view.name).toBe('My View');

    const own = await subscribeOnce(enterpriseAdmin.id, 'cost-codes-grid');
    expect(own.map((v) => v.id)).toContain(view.id);

    await signInAs(supabase, otherUser);
    const others = await subscribeOnce(enterpriseAdmin.id, 'cost-codes-grid');
    expect(others).toHaveLength(0);
  });

  function subscribeOnce(userId: string, tableId: string) {
    return new Promise<{ id: string }[]>((resolve) => {
      const unsub = adapter.subscribeSavedViews(userId, tableId, (views) => {
        unsub();
        resolve(views as { id: string }[]);
      });
    });
  }

  it('lets an enterprise admin create an invitation with no role field (matches the real domain contract)', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const invitation = await adapter.createInvitation({
      token: 'test-token-123',
      email: 'invitee@example.com',
      enterpriseId,
      enterpriseName: 'Utility Test Enterprise',
      invitedBy: enterpriseAdmin.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    expect(invitation.id).toBeTruthy();
  });

  it('RLS: a non-admin cannot create an invitation for the enterprise', async () => {
    await signInAs(supabase, otherUser);
    await expect(
      adapter.createInvitation({
        token: 'test-token-456',
        email: 'invitee2@example.com',
        enterpriseId,
        enterpriseName: 'Utility Test Enterprise',
        invitedBy: otherUser.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });
});
