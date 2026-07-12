import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresProgressAdapter } from '../../src/platform/supabase/adapters/ProgressAdapter';
import {
  addProjectMember,
  adminClient,
  cleanupEnterprise,
  createFixtureEnterprise,
  createFixtureProject,
  createTestUser,
  deleteTestUser,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

describe('PostgresProgressAdapter', () => {
  const adapter = new PostgresProgressAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let projectId: string;
  let costCodeId: string;
  let projectMember: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    projectMember = await createTestUser('progress-project-member');
    outsider = await createTestUser('progress-outsider');
    userIds.push(projectMember.id, outsider.id);

    const enterpriseId = await createFixtureEnterprise('Progress Test Enterprise');
    enterpriseIds.push(enterpriseId);
    projectId = await createFixtureProject(enterpriseId, 'PGTP-001', 'Progress Test Project');
    await addProjectMember(projectId, projectMember.id, 'Project Admin');

    const { data: costCode, error } = await adminClient
      .from('cost_codes')
      .insert({ code: 'CC-PG-1', project_id: projectId, name: 'Progress Cost Code', eac_method: 'Manual', sort_order: 1 })
      .select('id')
      .single();
    if (error) throw error;
    costCodeId = costCode.id;
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('lets a project member create a progress package and item, with the embedded package_code join intact', async () => {
    await signInAs(supabase, projectMember);
    const pkg = await adapter.createProgressPackage({
      projectId,
      packageCode: 'PKG-001',
      description: 'Foundations package',
    } as never);
    expect(pkg.description).toBe('Foundations package');

    const item = await adapter.createProgressItem({
      projectId,
      packageDocId: pkg.id,
      itemCode: 'ITEM-001',
      description: 'Footings',
      costCodeId,
      totalQty: 100,
      phasingMethod: 'Auto',
      phasingCurve: 'even',
    } as never);
    expect(item.description).toBe('Footings');
    // ProgressItem.packageId is derived from the progress_packages join
    // (package_code), not the package's raw uuid -- see ProgressAdapter.ts.
    expect(item.packageId).toBe('PKG-001');

    const list = await adapter.listProgressItems(projectId);
    expect(list.map((i) => i.id)).toContain(item.id);
  });

  it('RLS: an outsider with no project membership sees no progress items', async () => {
    await signInAs(supabase, outsider);
    const list = await adapter.listProgressItems(projectId);
    expect(list).toHaveLength(0);
  });
});
