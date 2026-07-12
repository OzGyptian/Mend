import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresChangeAdapter } from '../../src/platform/supabase/adapters/ChangeAdapter';
import {
  addProjectMember,
  cleanupEnterprise,
  createFixtureEnterprise,
  createFixtureProject,
  createTestUser,
  deleteTestUser,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

describe('PostgresChangeAdapter', () => {
  const adapter = new PostgresChangeAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let projectId: string;
  let projectMember: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    projectMember = await createTestUser('change-project-member');
    outsider = await createTestUser('change-outsider');
    userIds.push(projectMember.id, outsider.id);

    const enterpriseId = await createFixtureEnterprise('Change Test Enterprise');
    enterpriseIds.push(enterpriseId);
    projectId = await createFixtureProject(enterpriseId, 'CHTP-001', 'Change Test Project');
    await addProjectMember(projectId, projectMember.id, 'Project Admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('returns null for a non-existent change', async () => {
    await signInAs(supabase, projectMember);
    const result = await adapter.getChange('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('lets a project member create, read, update, and delete a change with change records', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createChange({
      projectId,
      changeId: 'CHG-001',
      description: 'Additional structural review required',
      status: 'Open',
    } as never);
    expect(created.description).toBe('Additional structural review required');

    const record = await adapter.createChangeRecord({
      projectId,
      changeId: created.id,
      budgetAmount: 5000,
      eacAmount: 5000,
    } as never);
    expect(record.changeId).toBe(created.id);

    const records = await adapter.listChangeRecords(projectId, created.id);
    expect(records.map((r) => r.id)).toContain(record.id);

    await adapter.updateChange(created.id, { status: 'Approved' });
    const fetched = await adapter.getChange(created.id);
    expect(fetched?.status).toBe('Approved');

    await adapter.deleteChangeRecord(record.id);
    await adapter.deleteChange(created.id);
    const afterDelete = await adapter.getChange(created.id);
    expect(afterDelete).toBeNull();
  });

  it('RLS: an outsider with no project membership sees no changes for the project', async () => {
    await signInAs(supabase, projectMember);
    await adapter.createChange({
      projectId,
      changeId: 'CHG-002',
      description: 'Owner-directed scope addition',
      status: 'Open',
    } as never);

    await signInAs(supabase, outsider);
    const list = await adapter.listChanges(projectId);
    expect(list).toHaveLength(0);
  });
});
