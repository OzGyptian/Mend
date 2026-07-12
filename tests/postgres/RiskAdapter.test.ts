import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresRiskAdapter } from '../../src/platform/supabase/adapters/RiskAdapter';
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

describe('PostgresRiskAdapter', () => {
  const adapter = new PostgresRiskAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let projectId: string;
  let projectMember: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    projectMember = await createTestUser('risk-project-member');
    outsider = await createTestUser('risk-outsider');
    userIds.push(projectMember.id, outsider.id);

    const enterpriseId = await createFixtureEnterprise('Risk Test Enterprise');
    enterpriseIds.push(enterpriseId);
    projectId = await createFixtureProject(enterpriseId, 'RTP-001', 'Risk Test Project');
    await addProjectMember(projectId, projectMember.id, 'Project Admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('lets a project member create, list, update, and delete a risk', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createRisk({
      projectId,
      riskId: 'RISK-001',
      description: 'Ground conditions worse than expected',
      type: 'Geotechnical',
      status: 'Open',
      strategy: 'Mitigate',
      initiator: 'Site Engineer',
      reference: 'Geotech Report v2',
      mitigation: 0,
      residualExposure: 0,
    } as never);
    expect(created.description).toBe('Ground conditions worse than expected');

    const list = await adapter.listRisks(projectId);
    expect(list.map((r) => r.id)).toContain(created.id);

    await adapter.updateRisk(created.id, { status: 'Mitigated' });
    const afterUpdate = await adapter.listRisks(projectId);
    expect(afterUpdate.find((r) => r.id === created.id)?.status).toBe('Mitigated');

    await adapter.deleteRisk(created.id);
    const afterDelete = await adapter.listRisks(projectId);
    expect(afterDelete.map((r) => r.id)).not.toContain(created.id);
  });

  it('RLS: an outsider with no project membership sees no risks for the project', async () => {
    await signInAs(supabase, projectMember);
    await adapter.createRisk({
      projectId,
      riskId: 'RISK-002',
      description: 'Supply chain delay for structural steel',
      type: 'Procurement',
      status: 'Open',
      strategy: 'Accept',
      initiator: 'Procurement Lead',
      reference: 'Vendor email 2026-06-01',
      mitigation: 0,
      residualExposure: 0,
    } as never);

    await signInAs(supabase, outsider);
    const list = await adapter.listRisks(projectId);
    expect(list).toHaveLength(0);
  });
});
