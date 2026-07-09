import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemorySubcontractAdapter, resetAllStores } from '../../src/platform/memory/MemoryAdapters';

describe('MemorySubcontractAdapter', () => {
  let adapter: MemorySubcontractAdapter;

  beforeEach(() => {
    resetAllStores();
    adapter = new MemorySubcontractAdapter();
  });

  // ── listSubcontracts ───────────────────────────────────────────────────────

  describe('listSubcontracts', () => {
    it('returns empty array when no subcontracts exist', async () => {
      const list = await adapter.listSubcontracts('p1');
      expect(list).toEqual([]);
    });

    it('returns only subcontracts for the given project', async () => {
      await adapter.createSubcontract({ projectId: 'p1', title: 'SC1' } as any);
      await adapter.createSubcontract({ projectId: 'p2', title: 'SC2' } as any);
      const list = await adapter.listSubcontracts('p1');
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('SC1');
    });
  });

  // ── createSubcontract ──────────────────────────────────────────────────────

  describe('createSubcontract', () => {
    it('returns a Subcontract with an id set', async () => {
      const sc = await adapter.createSubcontract({ projectId: 'p1', title: 'Test SC' } as any);
      expect(sc.id).toBeTruthy();
      expect(sc.title).toBe('Test SC');
    });

    it('persists so listSubcontracts can find it', async () => {
      await adapter.createSubcontract({ projectId: 'p1', title: 'Saved' } as any);
      const list = await adapter.listSubcontracts('p1');
      expect(list).toHaveLength(1);
    });
  });

  // ── updateSubcontract ──────────────────────────────────────────────────────

  describe('updateSubcontract', () => {
    it('mutates the stored subcontract', async () => {
      const sc = await adapter.createSubcontract({ projectId: 'p1', title: 'Before' } as any);
      await adapter.updateSubcontract(sc.id, { title: 'After' });
      const list = await adapter.listSubcontracts('p1');
      expect(list[0].title).toBe('After');
    });
  });

  // ── deleteSubcontract ──────────────────────────────────────────────────────

  describe('deleteSubcontract', () => {
    it('removes the subcontract from the store', async () => {
      const sc = await adapter.createSubcontract({ projectId: 'p1', title: 'ToDelete' } as any);
      await adapter.deleteSubcontract(sc.id);
      const list = await adapter.listSubcontracts('p1');
      expect(list).toHaveLength(0);
    });
  });

  // ── subscribeSubcontracts ──────────────────────────────────────────────────

  describe('subscribeSubcontracts', () => {
    it('fires callback with empty array on initial subscribe', () => {
      const cb = vi.fn();
      const unsub = adapter.subscribeSubcontracts('p1', cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith([]);
      unsub();
    });

    it('fires again after createSubcontract', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeSubcontracts('p1', rows => calls.push(rows));
      await adapter.createSubcontract({ projectId: 'p1', title: 'NewSC' } as any);
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1]).toHaveLength(1);
      unsub();
    });

    it('does not include subcontracts from other projects', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeSubcontracts('p1', rows => calls.push(rows));
      await adapter.createSubcontract({ projectId: 'p2', title: 'Other' } as any);
      const last = calls[calls.length - 1];
      expect(last.every((s: any) => s.projectId === 'p1')).toBe(true);
      unsub();
    });
  });

  // ── createInvoice ──────────────────────────────────────────────────────────

  describe('createInvoice', () => {
    it('returns an Invoice with an id set', async () => {
      const inv = await adapter.createInvoice({ projectId: 'p1', subcontractId: 'sc-1' } as any);
      expect(inv.id).toBeTruthy();
      expect(inv.subcontractId).toBe('sc-1');
    });
  });

  // ── updateInvoice ──────────────────────────────────────────────────────────

  describe('updateInvoice', () => {
    it('mutates the stored invoice visible through subscribeInvoices', async () => {
      const inv = await adapter.createInvoice({ projectId: 'p1', subcontractId: 'sc-1', amount: 100 } as any);
      await adapter.updateInvoice(inv.id, { amount: 200 });
      const latestInvoices: any[][] = [];
      const unsub = adapter.subscribeInvoices('p1', rows => latestInvoices.push(rows));
      unsub();
      expect(latestInvoices[0][0].amount).toBe(200);
    });
  });

  // ── deleteInvoice ──────────────────────────────────────────────────────────

  describe('deleteInvoice', () => {
    it('removes the invoice from the store', async () => {
      const inv = await adapter.createInvoice({ projectId: 'p1', subcontractId: 'sc-1' } as any);
      await adapter.deleteInvoice(inv.id);
      const seen: any[][] = [];
      const unsub = adapter.subscribeInvoices('p1', rows => seen.push(rows));
      unsub();
      expect(seen[0]).toHaveLength(0);
    });
  });

  // ── subscribeInvoices ──────────────────────────────────────────────────────

  describe('subscribeInvoices', () => {
    it('fires callback with empty array on initial subscribe', () => {
      const cb = vi.fn();
      const unsub = adapter.subscribeInvoices('p1', cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith([]);
      unsub();
    });

    it('fires again after createInvoice', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeInvoices('p1', rows => calls.push(rows));
      await adapter.createInvoice({ projectId: 'p1', subcontractId: 'sc-1' } as any);
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1]).toHaveLength(1);
      unsub();
    });

    it('only fires with invoices for the subscribed project', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeInvoices('p1', rows => calls.push(rows));
      await adapter.createInvoice({ projectId: 'p2', subcontractId: 'sc-2' } as any);
      const last = calls[calls.length - 1];
      expect(last.every((i: any) => i.projectId === 'p1')).toBe(true);
      unsub();
    });
  });
});
