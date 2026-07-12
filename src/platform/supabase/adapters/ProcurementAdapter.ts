import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { ProcurementItem, ProcurementStepDefinition } from '../../../domain/types';
import type { ProcurementRepository } from '../../ports/procurement.port';
import type { Unsubscribe } from '../../ports/index';

type ProcurementItemInsert = Database['public']['Tables']['procurement_items']['Insert'];
type ProcurementItemUpdate = Database['public']['Tables']['procurement_items']['Update'];
type StepDefInsert = Database['public']['Tables']['procurement_step_definitions']['Insert'];
type StepDefUpdate = Database['public']['Tables']['procurement_step_definitions']['Update'];

export class PostgresProcurementAdapter implements ProcurementRepository {
  subscribeProcurementItems(projectId: string, callback: (items: ProcurementItem[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('procurement_items').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<ProcurementItem>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`procurement_items:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procurement_items', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listProcurementItems(projectId: string): Promise<ProcurementItem[]> {
    const { data, error } = await supabase.from('procurement_items').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ProcurementItem>(row));
  }

  async createProcurementItem(data: Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementItem> {
    const row = toRow<ProcurementItemInsert>(data);
    const { data: inserted, error } = await supabase.from('procurement_items').insert(row).select().single();
    if (error) throw error;
    return fromRow<ProcurementItem>(inserted);
  }

  async createManyProcurementItems(data: Array<Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const rows = data.map((d) => toRow<ProcurementItemInsert>(d));
    const { error } = await supabase.from('procurement_items').insert(rows);
    if (error) throw error;
  }

  async updateProcurementItem(id: string, data: Partial<ProcurementItem>): Promise<void> {
    const { error } = await supabase.from('procurement_items').update(toRow<ProcurementItemUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async updateManyProcurementItems(updates: Array<{ id: string; data: Partial<ProcurementItem> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('procurement_items').update(toRow<ProcurementItemUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteProcurementItem(id: string): Promise<void> {
    const { error } = await supabase.from('procurement_items').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteManyProcurementItems(ids: string[]): Promise<void> {
    const { error } = await supabase.from('procurement_items').delete().in('id', ids);
    if (error) throw error;
  }

  subscribeProjectStepDefinitions(projectId: string, callback: (steps: ProcurementStepDefinition[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('procurement_step_definitions').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<ProcurementStepDefinition>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`step_defs_project:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procurement_step_definitions', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  subscribeEnterpriseStepDefinitions(enterpriseId: string, callback: (steps: ProcurementStepDefinition[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('procurement_step_definitions').select('*').eq('enterprise_id', enterpriseId);
      callback((data ?? []).map((row) => fromRow<ProcurementStepDefinition>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`step_defs_enterprise:${enterpriseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procurement_step_definitions', filter: `enterprise_id=eq.${enterpriseId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listProjectStepDefinitions(projectId: string): Promise<ProcurementStepDefinition[]> {
    const { data, error } = await supabase.from('procurement_step_definitions').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ProcurementStepDefinition>(row));
  }

  async listEnterpriseStepDefinitions(enterpriseId: string): Promise<ProcurementStepDefinition[]> {
    const { data, error } = await supabase.from('procurement_step_definitions').select('*').eq('enterprise_id', enterpriseId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ProcurementStepDefinition>(row));
  }

  async createStepDefinition(data: Omit<ProcurementStepDefinition, 'id'>): Promise<ProcurementStepDefinition> {
    const row = toRow<StepDefInsert>(data);
    const { data: inserted, error } = await supabase.from('procurement_step_definitions').insert(row).select().single();
    if (error) throw error;
    return fromRow<ProcurementStepDefinition>(inserted);
  }

  async updateStepDefinition(id: string, data: Partial<ProcurementStepDefinition>): Promise<void> {
    const { error } = await supabase.from('procurement_step_definitions').update(toRow<StepDefUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteStepDefinition(id: string): Promise<void> {
    const { error } = await supabase.from('procurement_step_definitions').delete().eq('id', id);
    if (error) throw error;
  }
}
