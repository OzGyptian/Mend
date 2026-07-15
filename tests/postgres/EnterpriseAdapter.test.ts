import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresEnterpriseAdapter } from '../../src/platform/supabase/adapters/EnterpriseAdapter';
import {
  addEnterpriseMember,
  cleanupEnterprise,
  createTestUser,
  deleteTestUser,
  makePlatformAdmin,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

// Runs against the real mend-migration-scratch Supabase project (see
// vitest.postgres.config.ts / npm run test:postgres). Exercises the adapter
// through the same anon-key client singleton the app uses, signed in as a
// real Supabase Auth test user -- this validates the adapter's logic AND the
// RLS policies together, since RLS is always on for that client regardless
// of test intent.
describe('PostgresEnterpriseAdapter', () => {
  const adapter = new PostgresEnterpriseAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let member: TestUser;
  let outsider: TestUser;
  let platformAdmin: TestUser;

  beforeAll(async () => {
    member = await createTestUser('ent-member');
    outsider = await createTestUser('ent-outsider');
    platformAdmin = await createTestUser('ent-platform-admin');
    userIds.push(member.id, outsider.id, platformAdmin.id);
    await makePlatformAdmin(platformAdmin.id, platformAdmin.email);
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('returns null for a non-existent enterprise', async () => {
    await signInAs(supabase, member);
    const result = await adapter.get('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('creates an enterprise with the caller as admin, and get() attaches members', async () => {
    await signInAs(supabase, member);
    const created = await adapter.create({
      name: 'Test Enterprise Alpha',
      theme: 'dark',
      adminUsers: [member.id],
    } as never);
    enterpriseIds.push(created.id);

    expect(created.name).toBe('Test Enterprise Alpha');
    expect(created.adminUsers).toContain(member.id);

    const fetched = await adapter.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.adminUsers).toContain(member.id);
    expect(fetched?.users?.[member.id]?.role).toBe('Enterprise System Admin');
  });

  it('lets the admin update the enterprise', async () => {
    await signInAs(supabase, member);
    const created = await adapter.create({ name: 'Test Enterprise Beta', theme: 'dark', adminUsers: [member.id] } as never);
    enterpriseIds.push(created.id);

    await adapter.update(created.id, { name: 'Test Enterprise Beta Renamed' });
    const fetched = await adapter.get(created.id);
    expect(fetched?.name).toBe('Test Enterprise Beta Renamed');
  });

  it('RLS: a user with no membership cannot see the enterprise', async () => {
    await signInAs(supabase, member);
    const created = await adapter.create({ name: 'Test Enterprise Gamma', theme: 'dark', adminUsers: [member.id] } as never);
    enterpriseIds.push(created.id);

    await signInAs(supabase, outsider);
    const result = await adapter.get(created.id);
    expect(result).toBeNull();
  });

  it('RLS: an enterprise member (not admin) can read but the admin flag reflects role', async () => {
    await signInAs(supabase, member);
    const created = await adapter.create({ name: 'Test Enterprise Delta', theme: 'dark', adminUsers: [member.id] } as never);
    enterpriseIds.push(created.id);
    await addEnterpriseMember(created.id, outsider.id, 'member');

    await signInAs(supabase, outsider);
    const fetched = await adapter.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.adminUsers).not.toContain(outsider.id);
    expect(fetched?.users?.[outsider.id]?.role).toBe('Enterprise User');
  });

  it('RLS: an enterprise admin (not platform admin) cannot delete their own enterprise', async () => {
    await signInAs(supabase, member);
    const created = await adapter.create({ name: 'Test Enterprise Zeta', theme: 'dark', adminUsers: [member.id] } as never);
    enterpriseIds.push(created.id);

    await adapter.delete(created.id);
    const fetched = await adapter.get(created.id);
    expect(fetched).not.toBeNull();
  });

  it('deletes an enterprise as a platform admin', async () => {
    await signInAs(supabase, member);
    const created = await adapter.create({ name: 'Test Enterprise Epsilon', theme: 'dark', adminUsers: [member.id] } as never);

    await signInAs(supabase, platformAdmin);
    await adapter.delete(created.id);
    const fetched = await adapter.get(created.id);
    expect(fetched).toBeNull();
  });

  it('supports two concurrent subscribeAll() callers without throwing', async () => {
    // Regression test: App.tsx (for platform admins) and SystemAdmin.tsx both
    // call subscribeAll() independently and concurrently whenever a platform
    // admin is on the System Admin page. subscribeAll() used to open a
    // Supabase realtime channel under a single fixed name ('enterprises_all'),
    // and two concurrent .subscribe() calls on the same channel name threw
    // "cannot add postgres_changes callbacks ... after subscribe()" --
    // uncaught, which crashed the whole page via the error boundary. This
    // wasn't caught by the e2e suite because that runs on the memory adapter,
    // which doesn't exercise real Supabase realtime channels at all.
    await signInAs(supabase, platformAdmin);

    let unsubscribeA: (() => void) | undefined;
    let unsubscribeB: (() => void) | undefined;
    expect(() => {
      unsubscribeA = adapter.subscribeAll(() => {});
      unsubscribeB = adapter.subscribeAll(() => {});
    }).not.toThrow();

    unsubscribeA?.();
    unsubscribeB?.();
  });
});
