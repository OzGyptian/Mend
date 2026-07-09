import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryChangeAdapter, resetAllStores } from '../../src/platform/memory/MemoryAdapters';

describe('MemoryChangeAdapter', () => {
  let adapter: MemoryChangeAdapter;

  beforeEach(() => {
    resetAllStores();
    adapter = new MemoryChangeAdapter();
  });

  // ── listChanges ────────────────────────────────────────────────────────────

  describe('listChanges', () => {
    it('returns empty array when no changes exist', async () => {
      const changes = await adapter.listChanges('p1');
      expect(changes).toEqual([]);
    });

    it('returns only changes for the given project', async () => {
      await adapter.createChange({ projectId: 'p1', description: 'C1' } as any);
      await adapter.createChange({ projectId: 'p2', description: 'C2' } as any);
      const changes = await adapter.listChanges('p1');
      expect(changes).toHaveLength(1);
      expect((changes[0] as any).description).toBe('C1');
    });
  });

  // ── getChange ──────────────────────────────────────────────────────────────

  describe('getChange', () => {
    it('returns null for unknown id', async () => {
      const result = await adapter.getChange('no-such-id');
      expect(result).toBeNull();
    });

    it('returns the change by id', async () => {
      const change = await adapter.createChange({ projectId: 'p1', description: 'Found' } as any);
      const result = await adapter.getChange(change.id);
      expect(result).not.toBeNull();
      expect(result!.description).toBe('Found');
    });
  });

  // ── createChange ───────────────────────────────────────────────────────────

  describe('createChange', () => {
    it('returns a Change with an id set', async () => {
      const change = await adapter.createChange({ projectId: 'p1', description: 'Test' } as any);
      expect(change.id).toBeTruthy();
      expect(change.description).toBe('Test');
    });

    it('persists so listChanges can find it', async () => {
      await adapter.createChange({ projectId: 'p1', description: 'Persisted' } as any);
      const list = await adapter.listChanges('p1');
      expect(list).toHaveLength(1);
    });
  });

  // ── updateChange ───────────────────────────────────────────────────────────

  describe('updateChange', () => {
    it('mutates the stored change', async () => {
      const change = await adapter.createChange({ projectId: 'p1', description: 'Before' } as any);
      await adapter.updateChange(change.id, { description: 'After' } as any);
      const list = await adapter.listChanges('p1');
      expect((list[0] as any).description).toBe('After');
    });
  });

  // ── deleteChange ───────────────────────────────────────────────────────────

  describe('deleteChange', () => {
    it('removes the change from the store', async () => {
      const change = await adapter.createChange({ projectId: 'p1', description: 'ToDelete' } as any);
      await adapter.deleteChange(change.id);
      const list = await adapter.listChanges('p1');
      expect(list).toHaveLength(0);
    });
  });

  // ── updateManyChanges ──────────────────────────────────────────────────────

  describe('updateManyChanges', () => {
    it('updates multiple changes in one call', async () => {
      const c1 = await adapter.createChange({ projectId: 'p1', description: 'A' } as any);
      const c2 = await adapter.createChange({ projectId: 'p1', description: 'B' } as any);
      await adapter.updateManyChanges([
        { id: c1.id, data: { description: 'A-updated' } },
        { id: c2.id, data: { description: 'B-updated' } },
      ]);
      const list = await adapter.listChanges('p1');
      const titles = list.map(c => c.description).sort();
      expect(titles).toEqual(['A-updated', 'B-updated']);
    });
  });

  // ── subscribeChanges ───────────────────────────────────────────────────────

  describe('subscribeChanges', () => {
    it('fires callback with empty array on initial subscribe', () => {
      const cb = vi.fn();
      const unsub = adapter.subscribeChanges('p1', cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith([]);
      unsub();
    });

    it('fires again after createChange', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeChanges('p1', rows => calls.push(rows));
      await adapter.createChange({ projectId: 'p1', description: 'New' } as any);
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1]).toHaveLength(1);
      unsub();
    });

    it('does not include changes from other projects', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeChanges('p1', rows => calls.push(rows));
      await adapter.createChange({ projectId: 'p2', description: 'Other' } as any);
      const last = calls[calls.length - 1];
      expect(last.every((c: any) => c.projectId === 'p1')).toBe(true);
      unsub();
    });
  });

  // ── listChangeRecords ──────────────────────────────────────────────────────

  describe('listChangeRecords', () => {
    it('returns empty array when no records exist', async () => {
      const records = await adapter.listChangeRecords('p1');
      expect(records).toEqual([]);
    });

    it('filters by changeId when provided', async () => {
      const ch1 = await adapter.createChange({ projectId: 'p1', description: 'C1' } as any);
      const ch2 = await adapter.createChange({ projectId: 'p1', description: 'C2' } as any);
      await adapter.createChangeRecord({ projectId: 'p1', changeId: ch1.id } as any);
      await adapter.createChangeRecord({ projectId: 'p1', changeId: ch2.id } as any);
      const records = await adapter.listChangeRecords('p1', ch1.id);
      expect(records).toHaveLength(1);
      expect(records[0].changeId).toBe(ch1.id);
    });

    it('returns all project records when changeId is omitted', async () => {
      const ch1 = await adapter.createChange({ projectId: 'p1', description: 'C1' } as any);
      const ch2 = await adapter.createChange({ projectId: 'p1', description: 'C2' } as any);
      await adapter.createChangeRecord({ projectId: 'p1', changeId: ch1.id } as any);
      await adapter.createChangeRecord({ projectId: 'p1', changeId: ch2.id } as any);
      const records = await adapter.listChangeRecords('p1');
      expect(records).toHaveLength(2);
    });
  });

  // ── createChangeRecord ─────────────────────────────────────────────────────

  describe('createChangeRecord', () => {
    it('returns a ChangeRecord with an id set', async () => {
      const record = await adapter.createChangeRecord({ projectId: 'p1', changeId: 'ch-1' } as any);
      expect(record.id).toBeTruthy();
      expect(record.changeId).toBe('ch-1');
    });
  });

  // ── updateChangeRecord ─────────────────────────────────────────────────────

  describe('updateChangeRecord', () => {
    it('mutates the stored record', async () => {
      const record = await adapter.createChangeRecord({ projectId: 'p1', changeId: 'ch-1', description: 'old' } as any);
      await adapter.updateChangeRecord(record.id, { description: 'new' } as any);
      const list = await adapter.listChangeRecords('p1');
      expect((list[0] as any).description).toBe('new');
    });
  });

  // ── deleteChangeRecord ─────────────────────────────────────────────────────

  describe('deleteChangeRecord', () => {
    it('removes the record from the store', async () => {
      const record = await adapter.createChangeRecord({ projectId: 'p1', changeId: 'ch-1' } as any);
      await adapter.deleteChangeRecord(record.id);
      const list = await adapter.listChangeRecords('p1');
      expect(list).toHaveLength(0);
    });
  });

  // ── deleteManyChangeRecords ───────────────────────────────────────────────

  describe('deleteManyChangeRecords', () => {
    it('removes multiple records in one call', async () => {
      const change = await adapter.createChange({ projectId: 'p1', description: 'C1' } as any);
      const r1 = await adapter.createChangeRecord({ projectId: 'p1', changeId: change.id, description: 'R1' } as any);
      const r2 = await adapter.createChangeRecord({ projectId: 'p1', changeId: change.id, description: 'R2' } as any);
      const r3 = await adapter.createChangeRecord({ projectId: 'p1', changeId: change.id, description: 'R3' } as any);
      await adapter.deleteManyChangeRecords([r1.id, r3.id]);
      const remaining = await adapter.listChangeRecords('p1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(r2.id);
    });
  });

  // ── subscribeChangeRecords ─────────────────────────────────────────────────

  describe('subscribeChangeRecords', () => {
    it('fires callback with empty array on initial subscribe', () => {
      const cb = vi.fn();
      const unsub = adapter.subscribeChangeRecords('p1', cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith([]);
      unsub();
    });

    it('fires again after createChangeRecord', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeChangeRecords('p1', rows => calls.push(rows));
      await adapter.createChangeRecord({ projectId: 'p1', changeId: 'ch-1' } as any);
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1]).toHaveLength(1);
      unsub();
    });
  });
});
