import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresCostAdapter } from '../../src/platform/supabase/adapters/CostAdapter';
import {
  addEnterpriseMember,
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

describe('PostgresCostAdapter', () => {
  const adapter = new PostgresCostAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let projectId: string;
  let projectMember: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    projectMember = await createTestUser('cost-project-member');
    outsider = await createTestUser('cost-outsider');
    userIds.push(projectMember.id, outsider.id);

    const enterpriseId = await createFixtureEnterprise('Cost Test Enterprise');
    enterpriseIds.push(enterpriseId);
    projectId = await createFixtureProject(enterpriseId, 'CTP-001', 'Cost Test Project');
    await addProjectMember(projectId, projectMember.id, 'Project Admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('returns null for a non-existent cost code', async () => {
    await signInAs(supabase, projectMember);
    const result = await adapter.getCostCode('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('lets a project member create, read, update, and delete a cost code', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createCostCode({
      code: 'CC-100',
      projectId,
      name: 'Sitework',
      enterpriseAttributes: {},
      projectAttributes: {},
      eacMethod: 'Manual',
      sortOrder: 1,
    } as never);
    expect(created.name).toBe('Sitework');

    const fetched = await adapter.getCostCode(created.id);
    expect(fetched?.name).toBe('Sitework');

    await adapter.updateCostCode(created.id, { name: 'Sitework Renamed' });
    const updated = await adapter.getCostCode(created.id);
    expect(updated?.name).toBe('Sitework Renamed');

    await adapter.deleteCostCode(created.id);
    const afterDelete = await adapter.getCostCode(created.id);
    expect(afterDelete).toBeNull();
  });

  it('RLS: an outsider with no project membership cannot see the cost code', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createCostCode({
      code: 'CC-200',
      projectId,
      name: 'Concrete',
      enterpriseAttributes: {},
      projectAttributes: {},
      eacMethod: 'Manual',
      sortOrder: 2,
    } as never);

    await signInAs(supabase, outsider);
    const result = await adapter.getCostCode(created.id);
    expect(result).toBeNull();
    const list = await adapter.listCostCodes(projectId);
    expect(list).toHaveLength(0);
  });

  it('lets a project member create and read a sheet', async () => {
    await signInAs(supabase, projectMember);
    const sheet = await adapter.createSheet({
      projectId,
      sheetName: 'Budget Sheet',
      forecastMethod: 'commitment',
      version: '1.0',
      lockedStatus: false,
      createdBy: projectMember.id,
    } as never);
    expect(sheet.projectId).toBe(projectId);

    const fetched = await adapter.getSheet(sheet.id);
    expect(fetched?.sheetName).toBe('Budget Sheet');
  });
});
