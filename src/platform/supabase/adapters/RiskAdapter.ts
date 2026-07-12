import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { Risk, RiskRecord } from '../../../domain/types';
import type { RiskRepository } from '../../ports/risk.port';
import type { Unsubscribe } from '../../ports/index';

type RiskInsert = Database['public']['Tables']['risks']['Insert'];
type RiskUpdate = Database['public']['Tables']['risks']['Update'];
type RiskRecordInsert = Database['public']['Tables']['risk_records']['Insert'];
type RiskRecordUpdate = Database['public']['Tables']['risk_records']['Update'];

// Risk.riskId (the human-facing short code) is stored as risk_code, not
// risk_id -- see migration 0012's naming-collision fix. risk_records.riskId
// (the FK to the parent risk's doc id) keeps its normal name.
const RISK_RENAMES = { risk_id: 'risk_code' };

export class PostgresRiskAdapter implements RiskRepository {
  subscribeRisks(projectId: string, callback: (risks: Risk[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('risks').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<Risk>(row, RISK_RENAMES)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`risks:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risks', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listRisks(projectId: string): Promise<Risk[]> {
    const { data, error } = await supabase.from('risks').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<Risk>(row, RISK_RENAMES));
  }

  async createRisk(data: Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Risk> {
    const row = toRow<RiskInsert>(data, RISK_RENAMES);
    const { data: inserted, error } = await supabase.from('risks').insert(row).select().single();
    if (error) throw error;
    return fromRow<Risk>(inserted, RISK_RENAMES);
  }

  async createManyRisks(records: Array<Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>>): Promise<string[]> {
    const rows = records.map((r) => toRow<RiskInsert>(r, RISK_RENAMES));
    const { data, error } = await supabase.from('risks').insert(rows).select('id');
    if (error) throw error;
    return (data ?? []).map((r) => r.id);
  }

  async updateRisk(id: string, data: Partial<Risk>): Promise<void> {
    const { error } = await supabase.from('risks').update(toRow<RiskUpdate>(data, RISK_RENAMES)).eq('id', id);
    if (error) throw error;
  }

  async updateManyRisks(updates: Array<{ id: string; data: Partial<Risk> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('risks').update(toRow<RiskUpdate>(data, RISK_RENAMES)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteRisk(id: string): Promise<void> {
    const { error } = await supabase.from('risks').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteManyRisks(ids: string[]): Promise<void> {
    const { error } = await supabase.from('risks').delete().in('id', ids);
    if (error) throw error;
  }

  subscribeRiskRecords(projectId: string, callback: (records: RiskRecord[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('risk_records').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<RiskRecord>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`risk_records:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_records', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listRiskRecords(projectId: string, riskId?: string): Promise<RiskRecord[]> {
    let q = supabase.from('risk_records').select('*').eq('project_id', projectId);
    if (riskId) q = q.eq('risk_id', riskId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<RiskRecord>(row));
  }

  async createRiskRecord(data: Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RiskRecord> {
    // betaPertImpactAmount is a GENERATED column -- Postgres computes it, never write it.
    const row = toRow<RiskRecordInsert>(data, {}, ['beta_pert_impact_amount']);
    const { data: inserted, error } = await supabase.from('risk_records').insert(row).select().single();
    if (error) throw error;
    return fromRow<RiskRecord>(inserted);
  }

  async createManyRiskRecords(records: Array<Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const rows = records.map((r) => toRow<RiskRecordInsert>(r, {}, ['beta_pert_impact_amount']));
    const { error } = await supabase.from('risk_records').insert(rows);
    if (error) throw error;
  }

  async updateRiskRecord(id: string, data: Partial<RiskRecord>): Promise<void> {
    const row = toRow<RiskRecordUpdate>(data, {}, ['beta_pert_impact_amount']);
    const { error } = await supabase.from('risk_records').update(row).eq('id', id);
    if (error) throw error;
  }

  async updateManyRiskRecords(updates: Array<{ id: string; data: Partial<RiskRecord> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) =>
        supabase.from('risk_records').update(toRow<RiskRecordUpdate>(data, {}, ['beta_pert_impact_amount'])).eq('id', id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteRiskRecord(id: string): Promise<void> {
    const { error } = await supabase.from('risk_records').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteManyRiskRecords(ids: string[]): Promise<void> {
    const { error } = await supabase.from('risk_records').delete().in('id', ids);
    if (error) throw error;
  }
}
