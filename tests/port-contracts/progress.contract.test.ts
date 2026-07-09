import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryProgressAdapter, resetAllStores } from '../../src/platform/memory/MemoryAdapters';

describe('MemoryProgressAdapter', () => {
  let adapter: MemoryProgressAdapter;

  beforeEach(() => {
    resetAllStores();
    adapter = new MemoryProgressAdapter();
  });

  // ── Progress Packages ───────────────────────────────────────────────────────

  describe('createProgressPackage / subscribeProgressPackages', () => {
    it('subscribe fires immediately with empty array', () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressPackages('p1', rows => calls.push(rows));
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([]);
      unsub();
    });

    it('subscribe fires again after createProgressPackage', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressPackages('p1', rows => calls.push(rows));
      await adapter.createProgressPackage({ projectId: 'p1', description: 'Pkg A' } as any);
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1]).toHaveLength(1);
      unsub();
    });

    it('updateProgressPackage mutates the stored record', async () => {
      const pkg = await adapter.createProgressPackage({ projectId: 'p1', description: 'Old' } as any);
      await adapter.updateProgressPackage(pkg.id, { description: 'New' });
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressPackages('p1', rows => calls.push(rows));
      expect(calls[0][0].description).toBe('New');
      unsub();
    });

    it('deleteProgressPackage removes the record', async () => {
      const pkg = await adapter.createProgressPackage({ projectId: 'p1', description: 'Doomed' } as any);
      await adapter.deleteProgressPackage(pkg.id);
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressPackages('p1', rows => calls.push(rows));
      expect(calls[0]).toHaveLength(0);
      unsub();
    });

    it('packages are isolated by projectId', async () => {
      await adapter.createProgressPackage({ projectId: 'p1', description: 'Pkg A' } as any);
      const callsP2: any[][] = [];
      const unsub = adapter.subscribeProgressPackages('p2', rows => callsP2.push(rows));
      expect(callsP2[callsP2.length - 1]).toHaveLength(0);
      unsub();
    });
  });

  // ── Progress Items ──────────────────────────────────────────────────────────

  describe('createProgressItem / subscribeProgressItems', () => {
    it('subscribe fires immediately with empty array', () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressItems('p1', rows => calls.push(rows));
      expect(calls[0]).toEqual([]);
      unsub();
    });

    it('subscribe fires again after createProgressItem', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressItems('p1', rows => calls.push(rows));
      await adapter.createProgressItem({ projectId: 'p1', packageId: 'pkg1', description: 'Item 1' } as any);
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1]).toHaveLength(1);
      unsub();
    });

    it('updateProgressItem mutates the stored record', async () => {
      const item = await adapter.createProgressItem({ projectId: 'p1', description: 'Old' } as any);
      await adapter.updateProgressItem(item.id, { description: 'New' });
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressItems('p1', rows => calls.push(rows));
      expect(calls[0][0].description).toBe('New');
      unsub();
    });

    it('deleteProgressItem removes the record', async () => {
      const item = await adapter.createProgressItem({ projectId: 'p1', description: 'Remove me' } as any);
      await adapter.deleteProgressItem(item.id);
      const calls: any[][] = [];
      const unsub = adapter.subscribeProgressItems('p1', rows => calls.push(rows));
      expect(calls[0]).toHaveLength(0);
      unsub();
    });
  });

  // ── Rules of Credit ─────────────────────────────────────────────────────────

  describe('createRuleOfCredit / subscribeRulesOfCredit', () => {
    it('subscribe fires immediately with empty array', () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeRulesOfCredit('p1', rows => calls.push(rows));
      expect(calls[0]).toEqual([]);
      unsub();
    });

    it('createRuleOfCredit is visible via subscribe', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeRulesOfCredit('p1', rows => calls.push(rows));
      await adapter.createRuleOfCredit({ projectId: 'p1', description: 'ROC-1', weight: 100 } as any);
      expect(calls[calls.length - 1]).toHaveLength(1);
      expect(calls[calls.length - 1][0].description).toBe('ROC-1');
      unsub();
    });

    it('updateRuleOfCredit mutates the stored record', async () => {
      const roc = await adapter.createRuleOfCredit({ projectId: 'p1', description: 'Old ROC' } as any);
      await adapter.updateRuleOfCredit(roc.id, { description: 'New ROC' });
      const calls: any[][] = [];
      const unsub = adapter.subscribeRulesOfCredit('p1', rows => calls.push(rows));
      expect(calls[0][0].description).toBe('New ROC');
      unsub();
    });

    it('deleteRuleOfCredit removes the record', async () => {
      const roc = await adapter.createRuleOfCredit({ projectId: 'p1', description: 'Gone' } as any);
      await adapter.deleteRuleOfCredit(roc.id);
      const calls: any[][] = [];
      const unsub = adapter.subscribeRulesOfCredit('p1', rows => calls.push(rows));
      expect(calls[0]).toHaveLength(0);
      unsub();
    });

    it('rules are isolated by projectId', async () => {
      await adapter.createRuleOfCredit({ projectId: 'p1', description: 'P1 ROC' } as any);
      const callsP2: any[][] = [];
      const unsub = adapter.subscribeRulesOfCredit('p2', rows => callsP2.push(rows));
      expect(callsP2[callsP2.length - 1]).toHaveLength(0);
      unsub();
    });
  });
});
