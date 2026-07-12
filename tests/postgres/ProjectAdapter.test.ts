import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresProjectAdapter } from '../../src/platform/supabase/adapters/ProjectAdapter';
import {
  addEnterpriseMember,
  addProjectMember,
  adminClient,
  cleanupEnterprise,
  createFixtureEnterprise,
  createTestUser,
  deleteTestUser,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

describe('PostgresProjectAdapter', () => {
  const adapter = new PostgresProjectAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let enterpriseId: string;
  let enterpriseAdmin: TestUser;
  let projectUser: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    enterpriseAdmin = await createTestUser('proj-ent-admin');
    projectUser = await createTestUser('proj-user');
    outsider = await createTestUser('proj-outsider');
    userIds.push(enterpriseAdmin.id, projectUser.id, outsider.id);
    // resolveUserId() (used by list()'s email-scoped path) looks up
    // user_profiles by email, which createTestUser doesn't populate.
    const { error: profilesError } = await adminClient.from('user_profiles').insert([
      { user_id: enterpriseAdmin.id, email: enterpriseAdmin.email },
      { user_id: outsider.id, email: outsider.email },
    ]);
    if (profilesError) throw profilesError;

    enterpriseId = await createFixtureEnterprise('Project Test Enterprise');
    enterpriseIds.push(enterpriseId);
    await addEnterpriseMember(enterpriseId, enterpriseAdmin.id, 'admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('returns null for a non-existent project', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const result = await adapter.get('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('lets an enterprise admin create a project (no chicken-and-egg on RETURNING)', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const created = await adapter.create({
      enterpriseId,
      projectName: 'Test Project Alpha',
      projectCode: 'TPA-001',
      users: { [enterpriseAdmin.id]: 'Project Admin' },
    } as never);

    expect(created.projectName).toBe('Test Project Alpha');
    const fetched = await adapter.get(created.id);
    expect(fetched?.users?.[enterpriseAdmin.id]).toBe('Project Admin');
  });

  it('RLS: a user with no membership and no enterprise-admin role cannot see the project', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const created = await adapter.create({
      enterpriseId,
      projectName: 'Test Project Beta',
      projectCode: 'TPB-001',
      users: { [enterpriseAdmin.id]: 'Project Admin' },
    } as never);

    await signInAs(supabase, outsider);
    const result = await adapter.get(created.id);
    expect(result).toBeNull();
  });

  it('RLS: a project member can read the project via project_members even without enterprise admin', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const created = await adapter.create({
      enterpriseId,
      projectName: 'Test Project Gamma',
      projectCode: 'TPG-001',
      users: { [enterpriseAdmin.id]: 'Project Admin' },
    } as never);
    await addProjectMember(created.id, projectUser.id, 'Project User');

    await signInAs(supabase, projectUser);
    const fetched = await adapter.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.projectName).toBe('Test Project Gamma');
  });

  it('lets the enterprise admin update the project', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const created = await adapter.create({
      enterpriseId,
      projectName: 'Test Project Delta',
      projectCode: 'TPD-001',
      users: { [enterpriseAdmin.id]: 'Project Admin' },
    } as never);

    await adapter.update(created.id, { projectName: 'Test Project Delta Renamed' });
    const fetched = await adapter.get(created.id);
    expect(fetched?.projectName).toBe('Test Project Delta Renamed');
  });

  it('list() with an empty userEmail returns every project in the enterprise, not none -- matches the original Firestore falsy-check behavior', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const created = await adapter.create({
      enterpriseId,
      projectName: 'Test Project Zeta',
      projectCode: 'TPZ-001',
      users: { [enterpriseAdmin.id]: 'Project Admin' },
    } as never);

    const all = await adapter.list(enterpriseId, '');
    expect(all.map((p) => p.id)).toContain(created.id);
  });

  it('list() with a real userEmail filters to that user\'s project memberships', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const created = await adapter.create({
      enterpriseId,
      projectName: 'Test Project Eta',
      projectCode: 'TPE-2-001',
      users: { [enterpriseAdmin.id]: 'Project Admin' },
    } as never);

    const scoped = await adapter.list(enterpriseId, enterpriseAdmin.email);
    expect(scoped.map((p) => p.id)).toContain(created.id);
    const scopedToOutsider = await adapter.list(enterpriseId, outsider.email);
    expect(scopedToOutsider.map((p) => p.id)).not.toContain(created.id);
  });

  it('lets the enterprise admin delete the project', async () => {
    await signInAs(supabase, enterpriseAdmin);
    const created = await adapter.create({
      enterpriseId,
      projectName: 'Test Project Epsilon',
      projectCode: 'TPE-001',
      users: { [enterpriseAdmin.id]: 'Project Admin' },
    } as never);

    await adapter.delete(created.id);
    const fetched = await adapter.get(created.id);
    expect(fetched).toBeNull();
  });
});
