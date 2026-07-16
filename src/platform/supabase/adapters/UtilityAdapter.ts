import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database, Json } from '../database.types';
import type { SavedView, PeriodSnapshot, Sheet } from '../../../domain/types';
import type { UtilityRepository } from '../../ports/utility.port';
import type { Unsubscribe } from '../../ports/index';

type SavedViewInsert = Database['public']['Tables']['saved_views']['Insert'];
type SavedViewUpdate = Database['public']['Tables']['saved_views']['Update'];
type PeriodSnapshotInsert = Database['public']['Tables']['period_snapshots']['Insert'];
type InvitationInsert = Database['public']['Tables']['invitations']['Insert'];
type SheetUpdate = Database['public']['Tables']['sheets']['Update'];

export class PostgresUtilityAdapter implements UtilityRepository {
  subscribeSavedViews(userId: string, tableId: string, callback: (views: SavedView[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('saved_views').select('*').eq('user_id', userId).eq('table_id', tableId);
      callback((data ?? []).map((row) => fromRow<SavedView>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`saved_views:${userId}:${tableId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_views', filter: `user_id=eq.${userId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async createSavedView(data: Omit<SavedView, 'id' | 'createdAt'>): Promise<SavedView> {
    const row = toRow<SavedViewInsert>(data);
    const { data: inserted, error } = await supabase.from('saved_views').insert(row).select().single();
    if (error) throw error;
    return fromRow<SavedView>(inserted);
  }

  async updateSavedView(id: string, data: Partial<SavedView>): Promise<void> {
    const { error } = await supabase.from('saved_views').update(toRow<SavedViewUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteSavedView(id: string): Promise<void> {
    const { error } = await supabase.from('saved_views').delete().eq('id', id);
    if (error) throw error;
  }

  async savePeriodSnapshot(data: Omit<PeriodSnapshot, 'id' | 'createdAt'>): Promise<void> {
    const row = toRow<PeriodSnapshotInsert>(data);
    const { error } = await supabase.from('period_snapshots').insert(row);
    if (error) throw error;
  }

  async savePeriodSnapshots(records: Array<Omit<PeriodSnapshot, 'id' | 'createdAt'>>): Promise<void> {
    const rows = records.map((r) => toRow<PeriodSnapshotInsert>(r));
    const { error } = await supabase.from('period_snapshots').insert(rows);
    if (error) throw error;
  }

  async createInvitation(data: {
    token: string;
    email: string;
    enterpriseId: string;
    enterpriseName: string;
    invitedBy: string;
    status: 'pending';
    createdAt: string;
  }): Promise<{ id: string }> {
    const row = toRow<InvitationInsert>({
      token: data.token,
      invitedEmail: data.email,
      enterpriseId: data.enterpriseId,
      enterpriseName: data.enterpriseName,
      invitedBy: data.invitedBy,
      status: data.status,
    });
    const { data: inserted, error } = await supabase.from('invitations').insert(row).select('id').single();
    if (error) throw error;
    return { id: inserted.id };
  }

  async updateSheet(id: string, data: Partial<Sheet>): Promise<void> {
    const { error } = await supabase.from('sheets').update(toRow<SheetUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  subscribeSheet(id: string, callback: (sheet: Sheet | null) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('sheets').select('*').eq('id', id).maybeSingle();
      callback(data ? fromRow<Sheet>(data) : null);
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`sheet:${id}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheets', filter: `id=eq.${id}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async recordAuditEvent(data: {
    enterpriseId: string;
    projectId: string | null;
    userId: string;
    userEmail: string;
    action: string;
    occurredAt: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase.from('audit_logs').insert({
      enterprise_id: data.enterpriseId,
      project_id: data.projectId,
      actor_user_id: data.userId,
      actor_email: data.userEmail,
      action: data.action,
      details: (data.details ?? {}) as Json,
    });
    if (error) throw error;
  }
}
