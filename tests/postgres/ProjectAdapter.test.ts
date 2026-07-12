import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresProjectAdapter } from '../../src/platform/supabase/adapters/ProjectAdapter';
import {
  addEnterpriseMember,
  addProjectMember,
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
