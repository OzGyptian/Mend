import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { Change, ChangeRecord } from '../../../domain/types';
import type { ChangeRepository } from '../../ports/change.port';
import type { Unsubscribe } from '../../ports/index';

type ChangeInsert = Database['public']['Tables']['changes']['Insert'];
type ChangeUpdate = Database['public']['Tables']['changes']['Update'];
type ChangeRecordInsert = Database['public']['Tables']['change_records']['Insert'];
type ChangeRecordUpdate = Database['public']['Tables']['change_records']['Update'];

// Change.changeId (human-facing short code) is stored as change_code -- see
// migration 0012's naming-collision fix.
const CHANGE_RENAMES = { change_id: 'change_code' };

export class PostgresChangeAdapter implements ChangeRepository {
  subscribeChanges(projectId: string, callback: (changes: Change[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('changes').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<Change>(row, CHANGE_RENAMES)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`changes:${projectId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'changes', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listChanges(projectId: string): Promise<Change[]> {
    const { data, error } = await supabase.from('changes').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<Change>(row, CHANGE_RENAMES));
  }

  async getChange(id: string): Promise<Change | null> {
    const { data, error } = await supabase.from('changes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow<Change>(data, CHANGE_RENAMES) : null;
  }

  async createChange(data: Omit<Change, 'id' | 'createdAt' | 'updatedAt'>): Promise<Change> {
    const row = toRow<ChangeInsert>(data, CHANGE_RENAMES);
    const { data: inserted, error } = await supabase.from('changes').insert(row).select().single();
    if (error) throw error;
    return fromRow<Change>(inserted, CHANGE_RENAMES);
  }

  async updateChange(id: string, data: Partial<Change>): Promise<void> {
    const { error } = await supabase.from('changes').update(toRow<ChangeUpdate>(data, CHANGE_RENAMES)).eq('id', id);
    if (error) throw error;
  }

  async deleteChange(id: string): Promise<void> {
    const { error } = await supabase.from('changes').delete().eq('id', id);
    if (error) throw error;
  }

  async updateManyChanges(updates: Array<{ id: string; data: Partial<Change> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('changes').update(toRow<ChangeUpdate>(data, CHANGE_RENAMES)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  subscribeChangeRecords(projectId: string, callback: (records: ChangeRecord[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('change_records').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<ChangeRecord>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`change_records:${projectId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_records', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listChangeRecords(projectId: string, changeId?: string): Promise<ChangeRecord[]> {
    let q = supabase.from('change_records').select('*').eq('project_id', projectId);
    if (changeId) q = q.eq('change_id', changeId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ChangeRecord>(row));
  }

  async createChangeRecord(data: Omit<ChangeRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChangeRecord> {
    const row = toRow<ChangeRecordInsert>(data);
    const { data: inserted, error } = await supabase.from('change_records').insert(row).select().single();
    if (error) throw error;
    return fromRow<ChangeRecord>(inserted);
  }

  async updateChangeRecord(id: string, data: Partial<ChangeRecord>): Promise<void> {
    const { error } = await supabase.from('change_records').update(toRow<ChangeRecordUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteChangeRecord(id: string): Promise<void> {
    const { error } = await supabase.from('change_records').delete().eq('id', id);
    if (error) throw error;
  }

  async updateManyChangeRecords(updates: Array<{ id: string; data: Partial<ChangeRecord> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('change_records').update(toRow<ChangeRecordUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async createManyChangeRecords(records: Array<Omit<ChangeRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const rows = records.map((r) => toRow<ChangeRecordInsert>(r));
    const { error } = await supabase.from('change_records').insert(rows);
    if (error) throw error;
  }

  async deleteManyChangeRecords(ids: string[]): Promise<void> {
    const { error } = await supabase.from('change_records').delete().in('id', ids);
    if (error) throw error;
  }
}
