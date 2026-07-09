import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryProjectAdapter,
  MemoryCostAdapter,
  MemoryChangeAdapter,
  MemoryRiskAdapter,
  MemoryProgressAdapter,
  resetAllStores,
} from '../../src/platform/memory/MemoryAdapters';

describe('cascade delete — deleteProjectWithSheets', () => {
  let projects: MemoryProjectAdapter;
  let costs: MemoryCostAdapter;
  let changes: MemoryChangeAdapter;
  let risks: MemoryRiskAdapter;
  let progress: MemoryProgressAdapter;

  beforeEach(() => {
    resetAllStores();
    projects = new MemoryProjectAdapter();
    costs = new MemoryCostAdapter();
    changes = new MemoryChangeAdapter();
    risks = new MemoryRiskAdapter();
    progress = new MemoryProgressAdapter();
  });

  it('removes the project itself', async () => {
    const p = await projects.create({ enterpriseId: 'e1', name: 'P1' } as any);
    await projects.deleteProjectWithSheets(p.id);
    const found = await projects.get(p.id);
    expect(found).toBeNull();
  });

  it('removes cost codes associated with the project', async () => {
    const p = await projects.create({ enterpriseId: 'e1', name: 'P1' } as any);
    const p2 = await projects.create({ enterpriseId: 'e1', name: 'P2' } as any);
    await costs.createCostCode({ projectId: p.id, code: 'A' } as any);
    await costs.createCostCode({ projectId: p2.id, code: 'B' } as any);
    await projects.deleteProjectWithSheets(p.id);
    const seen: any[][] = [];
    costs.subscribeCostCodes(p.id, rows => seen.push(rows));
    expect(seen[0]).toHaveLength(0);
    // p2 cost code must survive
    const seen2: any[][] = [];
    costs.subscribeCostCodes(p2.id, rows => seen2.push(rows));
    expect(seen2[0]).toHaveLength(1);
  });

  it('removes ETC details for the project', async () => {
    const p = await projects.create({ enterpriseId: 'e1', name: 'P1' } as any);
    await costs.createEtcDetail({ projectId: p.id, costCode: 'A.1' } as any);
    await projects.deleteProjectWithSheets(p.id);
    const remaining = await costs.listEtcDetails(p.id);
    expect(remaining).toHaveLength(0);
  });

  it('removes changes and change records for the project', async () => {
    const p = await projects.create({ enterpriseId: 'e1', name: 'P1' } as any);
    const ch = await changes.createChange({ projectId: p.id, description: 'C1' } as any);
    await changes.createChangeRecord({ projectId: p.id, changeId: ch.id } as any);
    await projects.deleteProjectWithSheets(p.id);
    expect(await changes.listChanges(p.id)).toHaveLength(0);
    expect(await changes.listChangeRecords(p.id)).toHaveLength(0);
  });

  it('removes risks and risk records for the project', async () => {
    const p = await projects.create({ enterpriseId: 'e1', name: 'P1' } as any);
    const r = await risks.createRisk({ projectId: p.id } as any);
    await risks.createRiskRecord({ projectId: p.id, riskId: r.id } as any);
    await projects.deleteProjectWithSheets(p.id);
    expect(await risks.listRisks(p.id)).toHaveLength(0);
    expect(await risks.listRiskRecords(p.id)).toHaveLength(0);
  });

  it('removes progress packages and items for the project', async () => {
    const p = await projects.create({ enterpriseId: 'e1', name: 'P1' } as any);
    await progress.createProgressPackage({ projectId: p.id, description: 'Pkg' } as any);
    await progress.createProgressItem({ projectId: p.id, description: 'Item' } as any);
    await projects.deleteProjectWithSheets(p.id);
    const pkgs: any[][] = [];
    progress.subscribeProgressPackages(p.id, rows => pkgs.push(rows));
    expect(pkgs[0]).toHaveLength(0);
    const items: any[][] = [];
    progress.subscribeProgressItems(p.id, rows => items.push(rows));
    expect(items[0]).toHaveLength(0);
  });

  it('does not affect data for a different project', async () => {
    const p1 = await projects.create({ enterpriseId: 'e1', name: 'P1' } as any);
    const p2 = await projects.create({ enterpriseId: 'e1', name: 'P2' } as any);
    await changes.createChange({ projectId: p2.id, description: 'Safe' } as any);
    await risks.createRisk({ projectId: p2.id } as any);
    await projects.deleteProjectWithSheets(p1.id);
    expect(await changes.listChanges(p2.id)).toHaveLength(1);
    expect(await risks.listRisks(p2.id)).toHaveLength(1);
  });
});

describe('cascade delete — deleteCostCode', () => {
  let costs: MemoryCostAdapter;

  beforeEach(() => {
    resetAllStores();
    costs = new MemoryCostAdapter();
  });

  it('removes the cost code itself', async () => {
    const cc = await costs.createCostCode({ projectId: 'p1', code: 'A' } as any);
    await costs.deleteCostCode(cc.id);
    const seen: any[][] = [];
    costs.subscribeCostCodes('p1', rows => seen.push(rows));
    expect(seen[0]).toHaveLength(0);
  });

  it('removes ETC details for the cost code (by code string) but not siblings', async () => {
    // EtcDetail.costCode is the human-readable code, not the document ID
    const cc1 = await costs.createCostCode({ projectId: 'p1', code: 'A.1' } as any);
    const cc2 = await costs.createCostCode({ projectId: 'p1', code: 'A.2' } as any);
    await costs.createEtcDetail({ projectId: 'p1', costCode: 'A.1' } as any);
    await costs.createEtcDetail({ projectId: 'p1', costCode: 'A.1' } as any);
    await costs.createEtcDetail({ projectId: 'p1', costCode: 'A.2' } as any);
    await costs.deleteCostCode(cc1.id);
    const remaining = await costs.listEtcDetails('p1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].costCode).toBe('A.2');
  });

  it('removes actual cost records for the cost code (by costCodeId)', async () => {
    const cc = await costs.createCostCode({ projectId: 'p1', code: 'A.1' } as any);
    await costs.createActualCost({ projectId: 'p1', costCodeId: cc.id } as any);
    await costs.deleteCostCode(cc.id);
    const remaining = await costs.listActualCosts('p1');
    expect(remaining).toHaveLength(0);
  });

  it('cost code delete does not affect other projects', async () => {
    const cc1 = await costs.createCostCode({ projectId: 'p1', code: 'A' } as any);
    await costs.createCostCode({ projectId: 'p2', code: 'A' } as any);
    await costs.deleteCostCode(cc1.id);
    const seen: any[][] = [];
    costs.subscribeCostCodes('p2', rows => seen.push(rows));
    expect(seen[0]).toHaveLength(1);
  });
});
