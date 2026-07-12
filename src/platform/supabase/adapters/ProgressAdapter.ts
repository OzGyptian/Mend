import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type {
  ProgressPackage, ProgressItem, ProgressReportingPeriod, RuleOfCredit,
} from '../../../domain/types';
import type { ProgressRepository } from '../../ports/progress.port';
import type { Unsubscribe } from '../../ports/index';

type ProgressPackageInsert = Database['public']['Tables']['progress_packages']['Insert'];
type ProgressPackageUpdate = Database['public']['Tables']['progress_packages']['Update'];
type ProgressItemInsert = Database['public']['Tables']['progress_items']['Insert'];
type ProgressItemUpdate = Database['public']['Tables']['progress_items']['Update'];
type RuleOfCreditInsert = Database['public']['Tables']['rules_of_credit']['Insert'];
type RuleOfCreditUpdate = Database['public']['Tables']['rules_of_credit']['Update'];

const PACKAGE_RENAMES = { package_id: 'package_code' };

// ProgressItem.packageId (human-facing, denormalized in Firestore since it
// can't easily join) is derived here from a real join against
// progress_packages.package_code instead of being stored redundantly.
// ProgressItem.packageDocId is the actual FK (progress_items.package_id).
function rowToProgressItem(row: Record<string, unknown> & { progress_packages?: { package_code: string } | null }): ProgressItem {
  const { progress_packages, ...rest } = row;
  const item = fromRow<ProgressItem>(rest);
  return {
    ...item,
    packageDocId: rest.package_id as string,
    packageId: progress_packages?.package_code ?? '',
  };
}

function progressItemToRow<T>(data: Record<string, unknown>): T {
  const { packageId: _packageId, packageDocId, ...rest } = data;
  const row = toRow<Record<string, unknown>>(rest);
  if (packageDocId !== undefined) row.package_id = packageDocId;
  return row as T;
}

export class PostgresProgressAdapter implements ProgressRepository {
  subscribeProgressPackages(projectId: string, callback: (packages: ProgressPackage[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('progress_packages').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<ProgressPackage>(row, PACKAGE_RENAMES)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`progress_packages:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress_packages', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listProgressPackages(projectId: string): Promise<ProgressPackage[]> {
    const { data, error } = await supabase.from('progress_packages').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ProgressPackage>(row, PACKAGE_RENAMES));
  }

  async createProgressPackage(data: Omit<ProgressPackage, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressPackage> {
    const row = toRow<ProgressPackageInsert>(data, PACKAGE_RENAMES);
    const { data: inserted, error } = await supabase.from('progress_packages').insert(row).select().single();
    if (error) throw error;
    return fromRow<ProgressPackage>(inserted, PACKAGE_RENAMES);
  }

  async updateProgressPackage(id: string, data: Partial<ProgressPackage>): Promise<void> {
    const { error } = await supabase.from('progress_packages').update(toRow<ProgressPackageUpdate>(data, PACKAGE_RENAMES)).eq('id', id);
    if (error) throw error;
  }

  async deleteProgressPackage(id: string): Promise<void> {
    const { error } = await supabase.from('progress_packages').delete().eq('id', id);
    if (error) throw error;
  }

  async updateManyProgressPackages(updates: Array<{ id: string; data: Partial<ProgressPackage> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) =>
        supabase.from('progress_packages').update(toRow<ProgressPackageUpdate>(data, PACKAGE_RENAMES)).eq('id', id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  subscribeProgressItems(projectId: string, callback: (items: ProgressItem[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('progress_items').select('*, progress_packages(package_code)').eq('project_id', projectId);
      callback((data ?? []).map(rowToProgressItem));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`progress_items:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress_items', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listProgressItems(projectId: string, packageId?: string): Promise<ProgressItem[]> {
    let q = supabase.from('progress_items').select('*, progress_packages(package_code)').eq('project_id', projectId);
    if (packageId) q = q.eq('package_id', packageId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(rowToProgressItem);
  }

  async createProgressItem(data: Omit<ProgressItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressItem> {
    const row = progressItemToRow<ProgressItemInsert>(data);
    const { data: inserted, error } = await supabase
      .from('progress_items').insert(row).select('*, progress_packages(package_code)').single();
    if (error) throw error;
    return rowToProgressItem(inserted);
  }

  async updateProgressItem(id: string, data: Partial<ProgressItem>): Promise<void> {
    const row = progressItemToRow<ProgressItemUpdate>(data);
    const { error } = await supabase.from('progress_items').update(row).eq('id', id);
    if (error) throw error;
  }

  async deleteProgressItem(id: string): Promise<void> {
    const { error } = await supabase.from('progress_items').delete().eq('id', id);
    if (error) throw error;
  }

  async updateManyProgressItems(updates: Array<{ id: string; data: Partial<ProgressItem> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('progress_items').update(progressItemToRow<ProgressItemUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  subscribeRulesOfCredit(projectId: string, callback: (rules: RuleOfCredit[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('rules_of_credit').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<RuleOfCredit>(row, { rule_id: 'rule_code' })));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`rules_of_credit:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rules_of_credit', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listRulesOfCredit(projectId: string): Promise<RuleOfCredit[]> {
    const { data, error } = await supabase.from('rules_of_credit').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<RuleOfCredit>(row, { rule_id: 'rule_code' }));
  }

  async createRuleOfCredit(data: Omit<RuleOfCredit, 'id' | 'createdAt'>): Promise<RuleOfCredit> {
    const row = toRow<RuleOfCreditInsert>(data, { rule_id: 'rule_code' });
    const { data: inserted, error } = await supabase.from('rules_of_credit').insert(row).select().single();
    if (error) throw error;
    return fromRow<RuleOfCredit>(inserted, { rule_id: 'rule_code' });
  }

  async updateRuleOfCredit(id: string, data: Partial<RuleOfCredit>): Promise<void> {
    const { error } = await supabase.from('rules_of_credit').update(toRow<RuleOfCreditUpdate>(data, { rule_id: 'rule_code' })).eq('id', id);
    if (error) throw error;
  }

  async deleteRuleOfCredit(id: string): Promise<void> {
    const { error } = await supabase.from('rules_of_credit').delete().eq('id', id);
    if (error) throw error;
  }

  async updateManyRulesOfCredit(updates: Array<{ id: string; data: Partial<RuleOfCredit> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) =>
        supabase.from('rules_of_credit').update(toRow<RuleOfCreditUpdate>(data, { rule_id: 'rule_code' })).eq('id', id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  subscribeReportingPeriods(projectId: string, callback: (periods: ProgressReportingPeriod[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('progress_reporting_periods').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<ProgressReportingPeriod>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`progress_reporting_periods:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress_reporting_periods', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listReportingPeriods(projectId: string): Promise<ProgressReportingPeriod[]> {
    const { data, error } = await supabase.from('progress_reporting_periods').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ProgressReportingPeriod>(row));
  }
}
