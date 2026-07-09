import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryEnterpriseAdapter, resetAllStores } from '../../src/platform/memory/MemoryAdapters';

describe('MemoryEnterpriseAdapter', () => {
  let adapter: MemoryEnterpriseAdapter;

  beforeEach(() => {
    // Reset all module-level singletons including the enterprise store
    resetAllStores();
    adapter = new MemoryEnterpriseAdapter();
  });

  // ── get ─────────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns null for an unknown enterprise', async () => {
      const result = await adapter.get('no-such-enterprise');
      expect(result).toBeNull();
    });

    it('returns the enterprise after create', async () => {
      const ent = await adapter.create({ name: 'Acme Corp', adminUsers: [], users: {}, settings: {} } as any);
      const found = await adapter.get(ent.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Acme Corp');
    });
  });

  // ── subscribeAll ─────────────────────────────────────────────────────────────

  describe('subscribeAll', () => {
    it('fires immediately with seeded demo-enterprise', () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeAll(rows => calls.push(rows));
      expect(calls).toHaveLength(1);
      expect(calls[0].some((e: any) => e.id === 'demo-enterprise')).toBe(true);
      unsub();
    });

    it('fires again after a new enterprise is created', async () => {
      const calls: any[][] = [];
      const unsub = adapter.subscribeAll(rows => calls.push(rows));
      await adapter.create({ name: 'New Corp', adminUsers: [], users: {}, settings: {} } as any);
      expect(calls.length).toBeGreaterThan(1);
      const last = calls[calls.length - 1];
      expect(last.some((e: any) => e.name === 'New Corp')).toBe(true);
      unsub();
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('assigns a new id and returns the enterprise', async () => {
      const ent = await adapter.create({ name: 'Builders Ltd', adminUsers: ['u1'], users: {}, settings: {} } as any);
      expect(ent.id).toBeTruthy();
      expect(ent.name).toBe('Builders Ltd');
    });

    it('stores the enterprise so it appears in subscribeAll', async () => {
      await adapter.create({ name: 'TargetCo', adminUsers: [], users: {}, settings: {} } as any);
      const calls: any[][] = [];
      const unsub = adapter.subscribeAll(rows => calls.push(rows));
      const found = calls[0].find((e: any) => e.name === 'TargetCo');
      expect(found).toBeDefined();
      unsub();
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('mutates the stored enterprise', async () => {
      const ent = await adapter.create({ name: 'Old Name', adminUsers: [], users: {}, settings: {} } as any);
      await adapter.update(ent.id, { name: 'New Name' });
      const found = await adapter.get(ent.id);
      expect(found!.name).toBe('New Name');
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('removes the enterprise so get returns null', async () => {
      const ent = await adapter.create({ name: 'Doomed Corp', adminUsers: [], users: {}, settings: {} } as any);
      await adapter.delete(ent.id);
      const found = await adapter.get(ent.id);
      expect(found).toBeNull();
    });
  });

  // ── bootstrapIfEmpty ─────────────────────────────────────────────────────────

  describe('bootstrapIfEmpty', () => {
    it('creates an enterprise when the store is empty', async () => {
      // Store starts empty after resetAllStores
      await adapter.bootstrapIfEmpty('u1', 'Bootstrap Corp', 'Enterprise System Admin');
      const calls: any[][] = [];
      const unsub = adapter.subscribeAll(rows => calls.push(rows));
      // subscribeAll also seeds demo-enterprise, but bootstrapIfEmpty checks first
      // Actually bootstrapIfEmpty checks the store length BEFORE seeding, so both paths need care.
      // After reset, store is empty; bootstrapIfEmpty creates 'Bootstrap Corp'.
      // subscribeAll then sees at least the bootstrapped one.
      expect(calls[0].some((e: any) => e.name === 'Bootstrap Corp')).toBe(true);
      unsub();
    });

    it('is a no-op when enterprises already exist', async () => {
      await adapter.create({ name: 'Existing Corp', adminUsers: [], users: {}, settings: {} } as any);
      const countBefore = (await (async () => {
        const rows: any[] = [];
        const unsub = adapter.subscribeAll(r => rows.push(...r));
        unsub();
        return rows;
      })()).length;
      await adapter.bootstrapIfEmpty('u1', 'Should Not Appear', 'Enterprise System Admin');
      const callsAfter: any[][] = [];
      const unsub = adapter.subscribeAll(r => callsAfter.push(r));
      unsub();
      // Should not have added a new enterprise named 'Should Not Appear'
      expect(callsAfter[0].some((e: any) => e.name === 'Should Not Appear')).toBe(false);
    });
  });
});
