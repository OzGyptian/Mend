import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresSubcontractAdapter } from '../../src/platform/supabase/adapters/SubcontractAdapter';
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

describe('PostgresSubcontractAdapter', () => {
  const adapter = new PostgresSubcontractAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let enterpriseId: string;
  let projectId: string;
  let vendorId: string;
  let projectMember: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    projectMember = await createTestUser('subk-project-member');
    outsider = await createTestUser('subk-outsider');
    userIds.push(projectMember.id, outsider.id);

    enterpriseId = await createFixtureEnterprise('Subcontract Test Enterprise');
    enterpriseIds.push(enterpriseId);
    projectId = await createFixtureProject(enterpriseId, 'SBTP-001', 'Subcontract Test Project');
    await addProjectMember(projectId, projectMember.id, 'Project Admin');

    const { data: vendor, error } = await adminClient
      .from('vendors')
      .insert({ enterprise_id: enterpriseId, name: 'Test Vendor Co' })
      .select('id')
      .single();
    if (error) throw error;
    vendorId = vendor.id;
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('lets a project member create, read, update, and delete a subcontract', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createSubcontract({
      projectId,
      enterpriseId,
      orderId: 'SC-001',
      orderName: 'Structural Steel Subcontract',
      orderScope: 'Supply and install structural steel',
      status: 'Active',
      paymentType: 'LumpSum',
      awardDate: '2026-01-15',
      vendorId,
      vendorUsers: [],
      totalAmount: 250000,
    } as never);
    expect(created.orderName).toBe('Structural Steel Subcontract');

    const fetched = await adapter.getSubcontract(created.id);
    expect(fetched?.orderName).toBe('Structural Steel Subcontract');

    await adapter.updateSubcontract(created.id, { status: 'Complete' });
    const afterUpdate = await adapter.getSubcontract(created.id);
    expect(afterUpdate?.status).toBe('Complete');

    await adapter.deleteSubcontract(created.id);
    const afterDelete = await adapter.getSubcontract(created.id);
    expect(afterDelete).toBeNull();
  });

  it('RLS: an outsider with no project membership cannot see the subcontract', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createSubcontract({
      projectId,
      enterpriseId,
      orderId: 'SC-002',
      orderName: 'Electrical Subcontract',
      orderScope: 'Supply and install electrical systems',
      status: 'Active',
      paymentType: 'LumpSum',
      awardDate: '2026-01-15',
      vendorId,
      vendorUsers: [],
      totalAmount: 100000,
    } as never);

    await signInAs(supabase, outsider);
    const result = await adapter.getSubcontract(created.id);
    expect(result).toBeNull();
    const list = await adapter.listSubcontracts(projectId);
    expect(list).toHaveLength(0);
  });
});
