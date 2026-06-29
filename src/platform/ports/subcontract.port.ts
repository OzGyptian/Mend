import type { Subcontract, SubcontractLineItem, Invoice } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface SubcontractRepository {
  subscribeSubcontracts(projectId: string, callback: (subcontracts: Subcontract[]) => void): Unsubscribe;
  getSubcontract(id: string): Promise<Subcontract | null>;
  listSubcontracts(projectId: string): Promise<Subcontract[]>;
  createSubcontract(data: Omit<Subcontract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subcontract>;
  updateSubcontract(id: string, data: Partial<Subcontract>): Promise<void>;
  deleteSubcontract(id: string): Promise<void>;

  subscribeSubcontractItems(subcontractId: string, callback: (items: SubcontractLineItem[]) => void): Unsubscribe;
  listSubcontractItems(subcontractId: string): Promise<SubcontractLineItem[]>;
  batchUpdateSubcontractItems(updates: Array<{ id: string; data: Partial<SubcontractLineItem> }>): Promise<void>;

  subscribeInvoices(projectId: string, callback: (invoices: Invoice[]) => void): Unsubscribe;
  getInvoice(id: string): Promise<Invoice | null>;
  listInvoices(projectId: string, subcontractId?: string): Promise<Invoice[]>;
  createInvoice(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<Invoice>): Promise<void>;
  deleteInvoice(id: string): Promise<void>;
  batchUpdateInvoices(updates: Array<{ id: string; data: Partial<Invoice> }>): Promise<void>;
}
