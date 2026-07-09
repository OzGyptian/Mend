import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRiskAdapter, resetAllStores } from '../../src/platform/memory/MemoryAdapters';

describe('MemoryRiskAdapter', () => {
  let adapter: MemoryRiskAdapter;

  beforeEach(() => {
    resetAllStores();
    adapter = new MemoryRiskAdapter();
  });

  // ── listRisks ──────────────────────────────────────────────────────────────

  describe('listRisks', () => {
    it('returns empty array when no risks exist', async () => {
      const risks = await adapter.listRisks('p1');
      expect(risks).toEqual([]);
    });

    it('returns risks for the given project only', async () => {
      await adapter.createRisk({ projectId: 'p1', title: 'R1' } as any);
      await adapter.createRisk({ projectId: 'p2', title: 'R2' } as any);
      const risks = await adapter.listRisks('p1');
      expect(risks).toHaveLength(1);
      expect((risks[0] as any).title).toBe('R1');
    });
  });

  // ── createRisk ─────────────────────────────────────────────────────────────

  describe('createRisk', () => {
    it('returns a Risk with an id set', async () => {
      const risk = await adapter.createRisk({ projectId: 'p1', title: 'My Risk' } as any);
      expect(risk.id).toBeTruthy();
      expect((risk as any).title).toBe('My Risk');
    });

    it('persists so listRisks can find it', async () => {
      await adapter.createRisk({ projectId: 'p1', title: 'Persisted' } as any);
      const list = await adapter.listRisks('p1');
      expect(list).toHaveLength(1);
    });
  });

  // ── updateRisk ─────────────────────────────────────────────────────────────

  describe('updateRisk', () => {
    it('mutates the stored risk', async () => {
      const risk = await adapter.createRisk({ projectId: 'p1', title: 'Original' } as any);
      await adapter.updateRisk(risk.id, { title: 'Updated' } as any);
      const list = await adapter.listRisks('p1');
      expect((list[0] as any).title).toBe('Updated');
    });
  });

  // ── deleteRisk ─────────────────────────────────────────────────────────────

  describe('deleteRisk', () => {
    it('removes the risk from the store', async () => {
      const risk = await adapter.createRisk({ projectId: 'p1', title: 'ToDelete' } as any);
      await adapter.deleteRisk(risk.id);
      const list = await adapter.listRisks('p1');
      expect(list).toHaveLength(0);
    });
  });

  // ── createManyRisks ────────────────────────────────────────────────────────

  describe('createManyRisks', () => {
    it('creates all provided risks and returns them with ids', async () => {
      const results = await adapter.createManyRisks([
        { projectId: 'p1', title: 'R1' } as any,
        { projectId: 'p1', title: 'R2' } as any,
      ]);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBeTruthy();
      expect(results[1].id).toBeTruthy();
      const list = await adapter.listRisks('p1');
      expect(list).toHaveLength(2);
    });
  });

  // ── subscribeRisks ─────────────────────────────────────────────────────────

  describe('subscribeRisks', () => {
    it('fires callback with empty array on subscribe when no risks exist', () => {
      const cb = vi.fn();
      const unsub = adapter.subscribeRisks('p1', cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith([]);
      unsub();
    });

    it('fires again with updated list after createRisk', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeRisks('p1', rows => calls.push(rows));
      await adapter.createRisk({ projectId: 'p1', title: 'NewRisk' } as any);
      expect(calls.length).toBeGreaterThan(1);
      const last = calls[calls.length - 1];
      expect(last).toHaveLength(1);
      expect(last[0].title).toBe('NewRisk');
      unsub();
    });

    it('only fires with risks belonging to the subscribed project', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeRisks('p1', rows => calls.push(rows));
      await adapter.createRisk({ projectId: 'p2', title: 'OtherProject' } as any);
      // Callback fired at least once (initial), but p2 risk should not appear
      const last = calls[calls.length - 1];
      expect(last.every((r: any) => r.projectId === 'p1')).toBe(true);
      unsub();
    });
  });

  // ── listRiskRecords ────────────────────────────────────────────────────────

  describe('listRiskRecords', () => {
    it('returns empty array when no records exist', async () => {
      const records = await adapter.listRiskRecords('p1');
      expect(records).toEqual([]);
    });

    it('filters by riskId when provided', async () => {
      const r1 = await adapter.createRisk({ projectId: 'p1', title: 'R1' } as any);
      const r2 = await adapter.createRisk({ projectId: 'p1', title: 'R2' } as any);
      await adapter.createRiskRecord({ projectId: 'p1', riskId: r1.id } as any);
      await adapter.createRiskRecord({ projectId: 'p1', riskId: r2.id } as any);
      const records = await adapter.listRiskRecords('p1', r1.id);
      expect(records).toHaveLength(1);
      expect(records[0].riskId).toBe(r1.id);
    });

    it('returns all project records when riskId is omitted', async () => {
      const r1 = await adapter.createRisk({ projectId: 'p1', title: 'R1' } as any);
      const r2 = await adapter.createRisk({ projectId: 'p1', title: 'R2' } as any);
      await adapter.createRiskRecord({ projectId: 'p1', riskId: r1.id } as any);
      await adapter.createRiskRecord({ projectId: 'p1', riskId: r2.id } as any);
      const records = await adapter.listRiskRecords('p1');
      expect(records).toHaveLength(2);
    });
  });

  // ── createRiskRecord ───────────────────────────────────────────────────────

  describe('createRiskRecord', () => {
    it('returns a RiskRecord with an id set', async () => {
      const record = await adapter.createRiskRecord({ projectId: 'p1', riskId: 'risk-1' } as any);
      expect(record.id).toBeTruthy();
      expect(record.riskId).toBe('risk-1');
    });
  });

  // ── updateRiskRecord ───────────────────────────────────────────────────────

  describe('updateRiskRecord', () => {
    it('mutates the stored record', async () => {
      const record = await adapter.createRiskRecord({ projectId: 'p1', riskId: 'r1', description: 'old' } as any);
      await adapter.updateRiskRecord(record.id, { description: 'new' } as any);
      const list = await adapter.listRiskRecords('p1');
      expect((list[0] as any).description).toBe('new');
    });
  });

  // ── deleteRiskRecord ───────────────────────────────────────────────────────

  describe('deleteRiskRecord', () => {
    it('removes the record from the store', async () => {
      const record = await adapter.createRiskRecord({ projectId: 'p1', riskId: 'r1' } as any);
      await adapter.deleteRiskRecord(record.id);
      const list = await adapter.listRiskRecords('p1');
      expect(list).toHaveLength(0);
    });
  });

  // ── deleteManyRiskRecords ──────────────────────────────────────────────────

  describe('deleteManyRiskRecords', () => {
    it('removes multiple records by id', async () => {
      const rec1 = await adapter.createRiskRecord({ projectId: 'p1', riskId: 'r1' } as any);
      const rec2 = await adapter.createRiskRecord({ projectId: 'p1', riskId: 'r1' } as any);
      const rec3 = await adapter.createRiskRecord({ projectId: 'p1', riskId: 'r1' } as any);
      await adapter.deleteManyRiskRecords([rec1.id, rec2.id]);
      const list = await adapter.listRiskRecords('p1');
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(rec3.id);
    });
  });

  // ── subscribeRiskRecords ───────────────────────────────────────────────────

  describe('subscribeRiskRecords', () => {
    it('fires callback immediately with empty array', () => {
      const cb = vi.fn();
      const unsub = adapter.subscribeRiskRecords('p1', cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith([]);
      unsub();
    });

    it('fires again after createRiskRecord', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeRiskRecords('p1', rows => calls.push(rows));
      await adapter.createRiskRecord({ projectId: 'p1', riskId: 'r1' } as any);
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1]).toHaveLength(1);
      unsub();
    });
  });
});
