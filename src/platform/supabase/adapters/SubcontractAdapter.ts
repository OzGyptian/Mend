import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { Subcontract, SubcontractLineItem, Invoice } from '../../../domain/types';
import type { SubcontractRepository } from '../../ports/subcontract.port';
import type { Unsubscribe } from '../../ports/index';

type SubcontractInsert = Database['public']['Tables']['subcontracts']['Insert'];
type SubcontractUpdate = Database['public']['Tables']['subcontracts']['Update'];
type LineItemUpdate = Database['public']['Tables']['subcontract_line_items']['Update'];
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

const SUBCONTRACT_RENAMES = { order_id: 'order_code' };
const INVOICE_RENAMES = { invoice_id: 'invoice_code' };

export class PostgresSubcontractAdapter implements SubcontractRepository {
  subscribeSubcontracts(projectId: string, callback: (subcontracts: Subcontract[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('subcontracts').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<Subcontract>(row, SUBCONTRACT_RENAMES)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`subcontracts:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcontracts', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async getSubcontract(id: string): Promise<Subcontract | null> {
    const { data, error } = await supabase.from('subcontracts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow<Subcontract>(data, SUBCONTRACT_RENAMES) : null;
  }

  async listSubcontracts(projectId: string): Promise<Subcontract[]> {
    const { data, error } = await supabase.from('subcontracts').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<Subcontract>(row, SUBCONTRACT_RENAMES));
  }

  async createSubcontract(data: Omit<Subcontract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subcontract> {
    const { lineItems: _lineItems, ...rest } = data;
    const row = toRow<SubcontractInsert>(rest, SUBCONTRACT_RENAMES);
    const { data: inserted, error } = await supabase.from('subcontracts').insert(row).select().single();
    if (error) throw error;
    return { ...fromRow<Subcontract>(inserted, SUBCONTRACT_RENAMES), lineItems: [] };
  }

  async updateSubcontract(id: string, data: Partial<Subcontract>): Promise<void> {
    const { lineItems: _lineItems, ...rest } = data;
    const { error } = await supabase.from('subcontracts').update(toRow<SubcontractUpdate>(rest, SUBCONTRACT_RENAMES)).eq('id', id);
    if (error) throw error;
  }

  async updateManySubcontracts(updates: Array<{ id: string; data: Partial<Subcontract> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => {
        const { lineItems: _lineItems, ...rest } = data;
        return supabase.from('subcontracts').update(toRow<SubcontractUpdate>(rest, SUBCONTRACT_RENAMES)).eq('id', id);
      })
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteSubcontract(id: string): Promise<void> {
    const { error } = await supabase.from('subcontracts').delete().eq('id', id);
    if (error) throw error;
  }

  // Firestore stores line items as a subcollection (subcontracts/{id}/lineItems);
  // Postgres just needs the real FK already on subcontract_line_items.
  subscribeSubcontractLineItems(subcontractId: string, callback: (items: SubcontractLineItem[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('subcontract_line_items').select('*').eq('subcontract_id', subcontractId);
      callback((data ?? []).map((row) => fromRow<SubcontractLineItem>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`subcontract_line_items:${subcontractId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcontract_line_items', filter: `subcontract_id=eq.${subcontractId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listSubcontractLineItems(subcontractId: string): Promise<SubcontractLineItem[]> {
    const { data, error } = await supabase.from('subcontract_line_items').select('*').eq('subcontract_id', subcontractId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<SubcontractLineItem>(row));
  }

  async updateManySubcontractLineItems(updates: Array<{ id: string; data: Partial<SubcontractLineItem> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('subcontract_line_items').update(toRow<LineItemUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  subscribeInvoices(projectId: string, callback: (invoices: Invoice[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('invoices').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<Invoice>(row, INVOICE_RENAMES)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`invoices:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow<Invoice>(data, INVOICE_RENAMES) : null;
  }

  async listInvoices(projectId: string, subcontractId?: string): Promise<Invoice[]> {
    let q = supabase.from('invoices').select('*').eq('project_id', projectId);
    if (subcontractId) q = q.eq('subcontract_id', subcontractId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<Invoice>(row, INVOICE_RENAMES));
  }

  async createInvoice(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    const { items: _items, ...rest } = data;
    const row = toRow<InvoiceInsert>(rest, INVOICE_RENAMES);
    const { data: inserted, error } = await supabase.from('invoices').insert(row).select().single();
    if (error) throw error;
    return { ...fromRow<Invoice>(inserted, INVOICE_RENAMES), items: [] };
  }

  async createManyInvoices(invoices: Array<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const rows = invoices.map((inv) => {
      const { items: _items, ...rest } = inv;
      return toRow<InvoiceInsert>(rest, INVOICE_RENAMES);
    });
    const { error } = await supabase.from('invoices').insert(rows);
    if (error) throw error;
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
    const { items: _items, ...rest } = data;
    const { error } = await supabase.from('invoices').update(toRow<InvoiceUpdate>(rest, INVOICE_RENAMES)).eq('id', id);
    if (error) throw error;
  }

  async updateManyInvoices(updates: Array<{ id: string; data: Partial<Invoice> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => {
        const { items: _items, ...rest } = data;
        return supabase.from('invoices').update(toRow<InvoiceUpdate>(rest, INVOICE_RENAMES)).eq('id', id);
      })
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteInvoice(id: string): Promise<void> {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteManyInvoices(ids: string[]): Promise<void> {
    const { error } = await supabase.from('invoices').delete().in('id', ids);
    if (error) throw error;
  }
}
