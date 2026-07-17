import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { Risk, RiskRecord } from '../../../domain/types';
import type { RiskRepository } from '../../ports/risk.port';
import type { Unsubscribe } from '../../ports/index';
import { computeExposureForModel } from '../../../domain/risk';

type RiskInsert = Database['public']['Tables']['risks']['Insert'];
type RiskUpdate = Database['public']['Tables']['risks']['Update'];
type RiskRecordInsert = Database['public']['Tables']['risk_records']['Insert'];
type RiskRecordUpdate = Database['public']['Tables']['risk_records']['Update'];

// Risk.riskId (the human-facing short code) is stored as risk_code, not
// risk_id -- see migration 0012's naming-collision fix. risk_records.riskId
// (the FK to the parent risk's doc id) keeps its normal name.
const RISK_RENAMES = { risk_id: 'risk_code' };

// risk_records stores min/mostLikely/max as risk_model-specific jsonb
// (model_inputs), not fixed columns -- see
// supabase/migrations/0037_risk_model_flexibility.sql and
// src/domain/risk.ts. RiskRecord's own shape stays flat (only one model
// exists today; generalize this if/when a second one does), so the adapter
// packs/unpacks between the two on every read/write instead of relying on
// the generic toRow/fromRow field-for-field mapping.
type RiskRecordRow = Database['public']['Tables']['risk_records']['Row'];

function toRiskRecordRow<T>(data: Partial<RiskRecord>): T {
  const { minImpactAmount, mostLikelyImpactAmount, maxImpactAmount, betaPertImpactAmount: _betaPertImpactAmount, ...rest } = data;
  const row = toRow<Record<string, unknown>>(rest) as Record<string, unknown>;
  if (minImpactAmount !== undefined || mostLikelyImpactAmount !== undefined || maxImpactAmount !== undefined) {
    row.risk_model = 'beta_pert_3point';
    row.model_inputs = { min: minImpactAmount, mostLikely: mostLikelyImpactAmount, max: maxImpactAmount };
  }
  return row as T;
}

function fromRiskRecordRow(row: RiskRecordRow): RiskRecord {
  const { model_inputs, risk_model, ...rest } = row;
  const base = fromRow<Omit<RiskRecord, 'minImpactAmount' | 'mostLikelyImpactAmount' | 'maxImpactAmount' | 'betaPertImpactAmount'>>(rest as RiskRecordRow);
  const inputs = (model_inputs ?? {}) as { min?: number; mostLikely?: number; max?: number };
  let betaPertImpactAmount = 0;
  try {
    betaPertImpactAmount = computeExposureForModel(risk_model, model_inputs, row.probability);
  } catch (err) {
    // A malformed row (e.g. an unrecognized risk_model, or model_inputs
    // that don't validate) shouldn't take down an entire list/subscription
    // -- log it and surface a 0 rather than crash every other risk record
    // in the same response.
    console.error(`risk_records/${row.id}: could not compute exposure`, err);
  }
  return {
    ...base,
    minImpactAmount: inputs.min ?? 0,
    mostLikelyImpactAmount: inputs.mostLikely ?? 0,
    maxImpactAmount: inputs.max ?? 0,
    betaPertImpactAmount,
  } as RiskRecord;
}

export class PostgresRiskAdapter implements RiskRepository {
  subscribeRisks(projectId: string, callback: (risks: Risk[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('risks').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<Risk>(row, RISK_RENAMES)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`risks:${projectId}:${crypto.randomUUID()}`)
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
      callback((data ?? []).map(fromRiskRecordRow));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`risk_records:${projectId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_records', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listRiskRecords(projectId: string, riskId?: string): Promise<RiskRecord[]> {
    let q = supabase.from('risk_records').select('*').eq('project_id', projectId);
    if (riskId) q = q.eq('risk_id', riskId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(fromRiskRecordRow);
  }

  async createRiskRecord(data: Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RiskRecord> {
    const row = toRiskRecordRow<RiskRecordInsert>(data);
    const { data: inserted, error } = await supabase.from('risk_records').insert(row).select().single();
    if (error) throw error;
    return fromRiskRecordRow(inserted);
  }

  async createManyRiskRecords(records: Array<Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const rows = records.map((r) => toRiskRecordRow<RiskRecordInsert>(r));
    const { error } = await supabase.from('risk_records').insert(rows);
    if (error) throw error;
  }

  async updateRiskRecord(id: string, data: Partial<RiskRecord>): Promise<void> {
    const row = toRiskRecordRow<RiskRecordUpdate>(data);
    const { error } = await supabase.from('risk_records').update(row).eq('id', id);
    if (error) throw error;
  }

  async updateManyRiskRecords(updates: Array<{ id: string; data: Partial<RiskRecord> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) =>
        supabase.from('risk_records').update(toRiskRecordRow<RiskRecordUpdate>(data)).eq('id', id)
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
