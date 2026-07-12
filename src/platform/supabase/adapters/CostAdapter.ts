import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type {
  CostCode, Sheet, ForecastRow, EtcDetail,
  ActualCostRecord, BaselineBudgetRecord, CostPhasingRecord,
} from '../../../domain/types';
import type { CostRepository } from '../../ports/cost.port';
import type { Unsubscribe } from '../../ports/index';

type CostCodeInsert = Database['public']['Tables']['cost_codes']['Insert'];
type CostCodeUpdate = Database['public']['Tables']['cost_codes']['Update'];
type SheetInsert = Database['public']['Tables']['sheets']['Insert'];
type SheetUpdate = Database['public']['Tables']['sheets']['Update'];
type ForecastRowInsert = Database['public']['Tables']['forecast_rows']['Insert'];
type ForecastRowUpdate = Database['public']['Tables']['forecast_rows']['Update'];
type EtcDetailInsert = Database['public']['Tables']['etc_details']['Insert'];
type EtcDetailUpdate = Database['public']['Tables']['etc_details']['Update'];
type ActualCostInsert = Database['public']['Tables']['actual_costs']['Insert'];
type ActualCostUpdate = Database['public']['Tables']['actual_costs']['Update'];
type BaselineBudgetInsert = Database['public']['Tables']['baseline_budgets']['Insert'];
type BaselineBudgetUpdate = Database['public']['Tables']['baseline_budgets']['Update'];
type CostPhasingInsert = Database['public']['Tables']['cost_phasing']['Insert'];
type CostPhasingUpdate = Database['public']['Tables']['cost_phasing']['Update'];

export class PostgresCostAdapter implements CostRepository {
  // ---- Cost Codes ----

  subscribeCostCodes(projectId: string, callback: (codes: CostCode[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('cost_codes').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<CostCode>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`cost_codes:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_codes', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  subscribeCostCodesByProjectIds(projectIds: string[], callback: (codes: CostCode[]) => void): () => void {
    if (projectIds.length === 0) { callback([]); return () => {}; }
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('cost_codes').select('*').in('project_id', projectIds);
      callback((data ?? []).map((row) => fromRow<CostCode>(row)));
    };
    fetchAndEmit();
    // No per-project_id filter possible on a single postgres_changes subscription
    // with an `in` list -- re-fetch on any cost_codes change and let the query
    // above re-apply the `in` filter server-side.
    const channel = supabase
      .channel(`cost_codes_multi:${projectIds.join(',')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_codes' }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async getCostCode(id: string): Promise<CostCode | null> {
    const { data, error } = await supabase.from('cost_codes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow<CostCode>(data) : null;
  }

  async listCostCodes(projectId: string): Promise<CostCode[]> {
    const { data, error } = await supabase.from('cost_codes').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<CostCode>(row));
  }

  async createCostCode(data: Omit<CostCode, 'id'>): Promise<CostCode> {
    const row = toRow<CostCodeInsert>(data);
    const { data: inserted, error } = await supabase.from('cost_codes').insert(row).select().single();
    if (error) throw error;
    return fromRow<CostCode>(inserted);
  }

  async updateCostCode(id: string, data: Partial<CostCode>): Promise<void> {
    const { error } = await supabase.from('cost_codes').update(toRow<CostCodeUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteCostCode(id: string): Promise<void> {
    const { error } = await supabase.from('cost_codes').delete().eq('id', id);
    if (error) throw error;
  }

  async updateManyCostCodes(updates: Array<{ id: string; data: Partial<CostCode> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('cost_codes').update(toRow<CostCodeUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  // ---- Sheets ----

  subscribeSheets(projectId: string, callback: (sheets: Sheet[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('sheets').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<Sheet>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`sheets:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheets', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async getSheet(id: string): Promise<Sheet | null> {
    const { data, error } = await supabase.from('sheets').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow<Sheet>(data) : null;
  }

  async createSheet(data: Omit<Sheet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sheet> {
    const row = toRow<SheetInsert>(data);
    const { data: inserted, error } = await supabase.from('sheets').insert(row).select().single();
    if (error) throw error;
    return fromRow<Sheet>(inserted);
  }

  async updateSheet(id: string, data: Partial<Sheet>): Promise<void> {
    const { error } = await supabase.from('sheets').update(toRow<SheetUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteSheet(id: string): Promise<void> {
    const { error } = await supabase.from('sheets').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Forecast Rows (a real FK to sheets, was a Firestore subcollection) ----

  subscribeForecastRows(sheetId: string, callback: (rows: ForecastRow[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('forecast_rows').select('*').eq('sheet_id', sheetId);
      callback((data ?? []).map((row) => fromRow<ForecastRow>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`forecast_rows:${sheetId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forecast_rows', filter: `sheet_id=eq.${sheetId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listForecastRows(sheetId: string): Promise<ForecastRow[]> {
    const { data, error } = await supabase.from('forecast_rows').select('*').eq('sheet_id', sheetId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ForecastRow>(row));
  }

  async createForecastRow(data: Omit<ForecastRow, 'id'>): Promise<ForecastRow> {
    const row = toRow<ForecastRowInsert>(data);
    const { data: inserted, error } = await supabase.from('forecast_rows').insert(row).select().single();
    if (error) throw error;
    return fromRow<ForecastRow>(inserted);
  }

  async createManyForecastRows(rows: Array<Omit<ForecastRow, 'id'>>): Promise<void> {
    const inserts = rows.map((r) => toRow<ForecastRowInsert>(r));
    const { error } = await supabase.from('forecast_rows').insert(inserts);
    if (error) throw error;
  }

  async updateForecastRow(_sheetId: string, rowId: string, data: Partial<ForecastRow>): Promise<void> {
    const { error } = await supabase.from('forecast_rows').update(toRow<ForecastRowUpdate>(data)).eq('id', rowId);
    if (error) throw error;
  }

  async updateManyForecastRows(_sheetId: string, updates: Array<{ id: string; data: Partial<ForecastRow> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('forecast_rows').update(toRow<ForecastRowUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteForecastRow(_sheetId: string, rowId: string): Promise<void> {
    const { error } = await supabase.from('forecast_rows').delete().eq('id', rowId);
    if (error) throw error;
  }

  async deleteManyForecastRows(_sheetId: string, rowIds: string[]): Promise<void> {
    const { error } = await supabase.from('forecast_rows').delete().in('id', rowIds);
    if (error) throw error;
  }

  // ---- ETC Details ----

  subscribeEtcDetails(projectId: string, callback: (details: EtcDetail[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('etc_details').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<EtcDetail>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`etc_details:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'etc_details', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listEtcDetails(projectId: string): Promise<EtcDetail[]> {
    const { data, error } = await supabase.from('etc_details').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<EtcDetail>(row));
  }

  async createEtcDetail(data: Omit<EtcDetail, 'id' | 'createdAt'>): Promise<EtcDetail> {
    const row = toRow<EtcDetailInsert>(data);
    const { data: inserted, error } = await supabase.from('etc_details').insert(row).select().single();
    if (error) throw error;
    return fromRow<EtcDetail>(inserted);
  }

  async updateEtcDetail(id: string, data: Partial<EtcDetail>): Promise<void> {
    const { error } = await supabase.from('etc_details').update(toRow<EtcDetailUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteEtcDetail(id: string): Promise<void> {
    const { error } = await supabase.from('etc_details').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteManyEtcDetails(ids: string[]): Promise<void> {
    const { error } = await supabase.from('etc_details').delete().in('id', ids);
    if (error) throw error;
  }

  async createManyEtcDetails(data: Array<Omit<EtcDetail, 'id' | 'createdAt'>>): Promise<void> {
    const rows = data.map((d) => toRow<EtcDetailInsert>(d));
    const { error } = await supabase.from('etc_details').insert(rows);
    if (error) throw error;
  }

  async updateManyEtcDetails(updates: Array<{ id: string; data: Partial<EtcDetail> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('etc_details').update(toRow<EtcDetailUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  // ---- Actual Costs ----

  subscribeActualCosts(projectId: string, callback: (records: ActualCostRecord[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('actual_costs').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<ActualCostRecord>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`actual_costs:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actual_costs', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listActualCosts(projectId: string): Promise<ActualCostRecord[]> {
    const { data, error } = await supabase.from('actual_costs').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ActualCostRecord>(row));
  }

  async createActualCost(data: Omit<ActualCostRecord, 'id' | 'createdAt'>): Promise<ActualCostRecord> {
    const row = toRow<ActualCostInsert>(data);
    const { data: inserted, error } = await supabase.from('actual_costs').insert(row).select().single();
    if (error) throw error;
    return fromRow<ActualCostRecord>(inserted);
  }

  async saveManyActualCosts(records: Array<Omit<ActualCostRecord, 'id' | 'createdAt'>>): Promise<void> {
    const rows = records.map((r) => toRow<ActualCostInsert>(r));
    const { error } = await supabase.from('actual_costs').insert(rows);
    if (error) throw error;
  }

  async updateActualCost(id: string, data: Partial<ActualCostRecord>): Promise<void> {
    const { error } = await supabase.from('actual_costs').update(toRow<ActualCostUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteActualCost(id: string): Promise<void> {
    const { error } = await supabase.from('actual_costs').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteManyActualCosts(ids: string[]): Promise<void> {
    const { error } = await supabase.from('actual_costs').delete().in('id', ids);
    if (error) throw error;
  }

  async updateManyActualCosts(updates: Array<{ id: string; data: Partial<ActualCostRecord> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('actual_costs').update(toRow<ActualCostUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  // ---- Baseline Budgets ----

  subscribeBaselineBudgets(projectId: string, callback: (records: BaselineBudgetRecord[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('baseline_budgets').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<BaselineBudgetRecord>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`baseline_budgets:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'baseline_budgets', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listBaselineBudgets(projectId: string): Promise<BaselineBudgetRecord[]> {
    const { data, error } = await supabase.from('baseline_budgets').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<BaselineBudgetRecord>(row));
  }

  async createBaselineBudget(data: Omit<BaselineBudgetRecord, 'id' | 'createdAt'>): Promise<BaselineBudgetRecord> {
    const row = toRow<BaselineBudgetInsert>(data);
    const { data: inserted, error } = await supabase.from('baseline_budgets').insert(row).select().single();
    if (error) throw error;
    return fromRow<BaselineBudgetRecord>(inserted);
  }

  async updateBaselineBudget(id: string, data: Partial<BaselineBudgetRecord>): Promise<void> {
    const { error } = await supabase.from('baseline_budgets').update(toRow<BaselineBudgetUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteBaselineBudget(id: string): Promise<void> {
    const { error } = await supabase.from('baseline_budgets').delete().eq('id', id);
    if (error) throw error;
  }

  async updateManyBaselineBudgets(updates: Array<{ id: string; data: Partial<BaselineBudgetRecord> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('baseline_budgets').update(toRow<BaselineBudgetUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  // ---- Cost Phasing ----

  subscribeCostPhasing(projectId: string, costCodeId: string, callback: (records: CostPhasingRecord[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('cost_phasing').select('*')
        .eq('project_id', projectId).eq('cost_code_id', costCodeId);
      callback((data ?? []).map((row) => fromRow<CostPhasingRecord>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`cost_phasing:${projectId}:${costCodeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_phasing', filter: `cost_code_id=eq.${costCodeId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listCostPhasing(projectId: string, costCodeId?: string): Promise<CostPhasingRecord[]> {
    let q = supabase.from('cost_phasing').select('*').eq('project_id', projectId);
    if (costCodeId) q = q.eq('cost_code_id', costCodeId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<CostPhasingRecord>(row));
  }

  async listAllCostPhasing(projectId: string): Promise<CostPhasingRecord[]> {
    return this.listCostPhasing(projectId);
  }

  async updateCostPhasing(id: string, data: Partial<CostPhasingRecord>): Promise<void> {
    const { error } = await supabase.from('cost_phasing').update(toRow<CostPhasingUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async updateManyPhasing(updates: Array<{ id: string; data: Partial<CostPhasingRecord> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('cost_phasing').update(toRow<CostPhasingUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async saveCostPhasing(records: Array<Omit<CostPhasingRecord, 'id' | 'createdAt'>>): Promise<void> {
    const rows = records.map((r) => toRow<CostPhasingInsert>(r));
    const { error } = await supabase.from('cost_phasing').insert(rows);
    if (error) throw error;
  }
}
