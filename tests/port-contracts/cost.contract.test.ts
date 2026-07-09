import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCostAdapter, resetAllStores } from '../../src/platform/memory/MemoryAdapters';

describe('MemoryCostAdapter', () => {
  let adapter: MemoryCostAdapter;

  beforeEach(() => {
    resetAllStores();
    adapter = new MemoryCostAdapter();
  });

  // ── Cost Codes ──────────────────────────────────────────────────────────────

  describe('createCostCode / subscribeCostCodes', () => {
    it('subscribe fires with empty array for unknown project', () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeCostCodes('p-none', rows => calls.push(rows));
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([]);
      unsub();
    });

    it('subscribe fires again after createCostCode', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeCostCodes('p1', rows => calls.push(rows));
      await adapter.createCostCode({ projectId: 'p1', code: 'CC-001' } as any);
      expect(calls.length).toBeGreaterThan(1);
      const last = calls[calls.length - 1];
      expect(last).toHaveLength(1);
      expect(last[0].code).toBe('CC-001');
      unsub();
    });

    it('subscribe only delivers cost codes for the subscribed project', async () => {
      const callsP1: any[][] = [];
      const callsP2: any[][] = [];
      const unsubP1 = adapter.subscribeCostCodes('p1', rows => callsP1.push(rows));
      const unsubP2 = adapter.subscribeCostCodes('p2', rows => callsP2.push(rows));
      await adapter.createCostCode({ projectId: 'p1', code: 'CC-100' } as any);
      const lastP1 = callsP1[callsP1.length - 1];
      const lastP2 = callsP2[callsP2.length - 1];
      expect(lastP1).toHaveLength(1);
      expect(lastP2).toHaveLength(0);
      unsubP1();
      unsubP2();
    });
  });

  describe('getCostCode', () => {
    it('returns null for a missing cost code', async () => {
      const result = await adapter.getCostCode('does-not-exist');
      expect(result).toBeNull();
    });

    it('returns the cost code after create', async () => {
      const cc = await adapter.createCostCode({ projectId: 'p1', code: 'CC-001', name: 'Foundation' } as any);
      const found = await adapter.getCostCode(cc.id);
      expect(found).not.toBeNull();
      expect(found!.code).toBe('CC-001');
    });
  });

  describe('updateCostCode / deleteCostCode / updateManyCostCodes', () => {
    it('updateCostCode mutates the stored record', async () => {
      const cc = await adapter.createCostCode({ projectId: 'p1', code: 'CC-001', name: 'Old' } as any);
      await adapter.updateCostCode(cc.id, { name: 'New' });
      const found = await adapter.getCostCode(cc.id);
      expect(found!.name).toBe('New');
    });

    it('deleteCostCode removes the record', async () => {
      const cc = await adapter.createCostCode({ projectId: 'p1', code: 'CC-001' } as any);
      await adapter.deleteCostCode(cc.id);
      const found = await adapter.getCostCode(cc.id);
      expect(found).toBeNull();
    });

    it('updateManyCostCodes applies all updates', async () => {
      const cc1 = await adapter.createCostCode({ projectId: 'p1', code: 'A', name: 'Old A' } as any);
      const cc2 = await adapter.createCostCode({ projectId: 'p1', code: 'B', name: 'Old B' } as any);
      await adapter.updateManyCostCodes([
        { id: cc1.id, data: { name: 'New A' } },
        { id: cc2.id, data: { name: 'New B' } },
      ]);
      expect((await adapter.getCostCode(cc1.id))!.name).toBe('New A');
      expect((await adapter.getCostCode(cc2.id))!.name).toBe('New B');
    });
  });

  describe('subscribeCostCodesByProjectIds', () => {
    it('delivers cost codes from multiple projects', async () => {
      await adapter.createCostCode({ projectId: 'p1', code: 'A' } as any);
      await adapter.createCostCode({ projectId: 'p2', code: 'B' } as any);
      await adapter.createCostCode({ projectId: 'p3', code: 'C' } as any);
      const calls: any[][] = [];
      const unsub = adapter.subscribeCostCodesByProjectIds(['p1', 'p2'], rows => calls.push(rows));
      const last = calls[calls.length - 1];
      expect(last).toHaveLength(2);
      expect(last.map((r: any) => r.code).sort()).toEqual(['A', 'B']);
      unsub();
    });
  });

  // ── ETC Details ─────────────────────────────────────────────────────────────

  describe('createEtcDetail / listEtcDetails', () => {
    it('listEtcDetails returns empty for unknown project', async () => {
      const result = await adapter.listEtcDetails('p-none');
      expect(result).toEqual([]);
    });

    it('createEtcDetail persists and listEtcDetails returns it', async () => {
      await adapter.createEtcDetail({ projectId: 'p1', costCodeId: 'cc1' } as any);
      const list = await adapter.listEtcDetails('p1');
      expect(list).toHaveLength(1);
      expect(list[0].projectId).toBe('p1');
    });

    it('listEtcDetails does not return records from other projects', async () => {
      await adapter.createEtcDetail({ projectId: 'p1', costCodeId: 'cc1' } as any);
      await adapter.createEtcDetail({ projectId: 'p2', costCodeId: 'cc2' } as any);
      const list = await adapter.listEtcDetails('p1');
      expect(list).toHaveLength(1);
    });
  });

  // ── Actual Costs ─────────────────────────────────────────────────────────────

  describe('createActualCost / listActualCosts', () => {
    it('listActualCosts returns empty for unknown project', async () => {
      const result = await adapter.listActualCosts('p-none');
      expect(result).toEqual([]);
    });

    it('createActualCost is retrievable via listActualCosts', async () => {
      await adapter.createActualCost({ projectId: 'p1', costCodeId: 'cc1', cost: 5000 } as any);
      const list = await adapter.listActualCosts('p1');
      expect(list).toHaveLength(1);
      expect((list[0] as any).cost).toBe(5000);
    });
  });

  // ── Cost Phasing ─────────────────────────────────────────────────────────────

  describe('saveCostPhasing / listCostPhasing / listAllCostPhasing', () => {
    it('saveCostPhasing stores records retrievable by listAllCostPhasing', async () => {
      await adapter.saveCostPhasing([
        { projectId: 'p1', costCodeId: 'cc1', period: '2026-01', amount: 100 } as any,
        { projectId: 'p1', costCodeId: 'cc1', period: '2026-02', amount: 200 } as any,
      ]);
      const all = await adapter.listAllCostPhasing('p1');
      expect(all).toHaveLength(2);
    });

    it('listCostPhasing with costCodeId filters correctly', async () => {
      await adapter.saveCostPhasing([
        { projectId: 'p1', costCodeId: 'cc1', period: '2026-01', amount: 100 } as any,
        { projectId: 'p1', costCodeId: 'cc2', period: '2026-01', amount: 999 } as any,
      ]);
      const filtered = await adapter.listCostPhasing('p1', 'cc1');
      expect(filtered).toHaveLength(1);
      expect((filtered[0] as any).costCodeId).toBe('cc1');
    });

    it('listCostPhasing without costCodeId returns all for project', async () => {
      await adapter.saveCostPhasing([
        { projectId: 'p1', costCodeId: 'cc1', period: '2026-01', amount: 100 } as any,
        { projectId: 'p1', costCodeId: 'cc2', period: '2026-01', amount: 200 } as any,
      ]);
      const all = await adapter.listCostPhasing('p1');
      expect(all).toHaveLength(2);
    });
  });
});
