import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresProcurementAdapter } from '../../src/platform/supabase/adapters/ProcurementAdapter';
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

describe('PostgresProcurementAdapter', () => {
  const adapter = new PostgresProcurementAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let projectId: string;
  let projectMember: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    projectMember = await createTestUser('proc-project-member');
    outsider = await createTestUser('proc-outsider');
    userIds.push(projectMember.id, outsider.id);

    const enterpriseId = await createFixtureEnterprise('Procurement Test Enterprise');
    enterpriseIds.push(enterpriseId);
    projectId = await createFixtureProject(enterpriseId, 'PTP-001', 'Procurement Test Project');
    await addProjectMember(projectId, projectMember.id, 'Project Admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('lets a project member create, list, update, and delete a procurement item', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createProcurementItem({
      projectId,
      description: 'Structural steel package',
      category: 'Materials',
    } as never);
    expect(created.description).toBe('Structural steel package');

    const list = await adapter.listProcurementItems(projectId);
    expect(list.map((i) => i.id)).toContain(created.id);

    await adapter.updateProcurementItem(created.id, { category: 'Subcontract' } as never);
    const afterUpdate = await adapter.listProcurementItems(projectId);
    expect((afterUpdate.find((i) => i.id === created.id) as never as { category: string })?.category).toBe('Subcontract');

    await adapter.deleteProcurementItem(created.id);
    const afterDelete = await adapter.listProcurementItems(projectId);
    expect(afterDelete.map((i) => i.id)).not.toContain(created.id);
  });

  it('RLS: an outsider with no project membership sees no procurement items', async () => {
    await signInAs(supabase, projectMember);
    await adapter.createProcurementItem({
      projectId,
      description: 'Concrete supply package',
      category: 'Materials',
    } as never);

    await signInAs(supabase, outsider);
    const list = await adapter.listProcurementItems(projectId);
    expect(list).toHaveLength(0);
  });
});
