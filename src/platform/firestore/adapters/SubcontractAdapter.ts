import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { Subcontract, SubcontractLineItem, Invoice } from '../../../domain/types';
import type { SubcontractRepository } from '../../ports/subcontract.port';
import type { Unsubscribe } from '../../ports/index';

export class SubcontractAdapter implements SubcontractRepository {
  subscribeSubcontracts(projectId: string, callback: (subcontracts: Subcontract[]) => void): Unsubscribe {
    const q = query(collection(db, 'subcontracts'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Subcontract>(d.id, d.data())));
    });
  }

  async getSubcontract(id: string): Promise<Subcontract | null> {
    const snap = await getDoc(doc(db, 'subcontracts', id));
    return snap.exists() ? fromDoc<Subcontract>(snap.id, snap.data()) : null;
  }

  async listSubcontracts(projectId: string): Promise<Subcontract[]> {
    const snap = await getDocs(query(collection(db, 'subcontracts'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<Subcontract>(d.id, d.data()));
  }

  async createSubcontract(data: Omit<Subcontract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subcontract> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'subcontracts'), payload);
    return { id: ref.id, ...payload };
  }

  async updateSubcontract(id: string, data: Partial<Subcontract>): Promise<void> {
    await updateDoc(doc(db, 'subcontracts', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteSubcontract(id: string): Promise<void> {
    await deleteDoc(doc(db, 'subcontracts', id));
  }

  subscribeSubcontractLineItems(
    subcontractId: string,
    callback: (items: SubcontractLineItem[]) => void,
  ): Unsubscribe {
    const q = query(collection(db, 'subcontracts', subcontractId, 'lineItems'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<SubcontractLineItem>(d.id, d.data())));
    });
  }

  async listSubcontractLineItems(subcontractId: string): Promise<SubcontractLineItem[]> {
    const snap = await getDocs(collection(db, 'subcontracts', subcontractId, 'lineItems'));
    return snap.docs.map((d) => fromDoc<SubcontractLineItem>(d.id, d.data()));
  }

  async updateManySubcontractLineItems(
    updates: Array<{ id: string; data: Partial<SubcontractLineItem> }>,
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'subcontracts', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  subscribeInvoices(projectId: string, callback: (invoices: Invoice[]) => void): Unsubscribe {
    const q = query(collection(db, 'invoices'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Invoice>(d.id, d.data())));
    });
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const snap = await getDoc(doc(db, 'invoices', id));
    return snap.exists() ? fromDoc<Invoice>(snap.id, snap.data()) : null;
  }

  async listInvoices(projectId: string, subcontractId?: string): Promise<Invoice[]> {
    const constraints = [where('projectId', '==', projectId)];
    if (subcontractId) constraints.push(where('subcontractId', '==', subcontractId));
    const snap = await getDocs(query(collection(db, 'invoices'), ...constraints));
    return snap.docs.map((d) => fromDoc<Invoice>(d.id, d.data()));
  }

  async createInvoice(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'invoices'), payload);
    return { id: ref.id, ...payload };
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
    await updateDoc(doc(db, 'invoices', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteInvoice(id: string): Promise<void> {
    await deleteDoc(doc(db, 'invoices', id));
  }

  async updateManyInvoices(updates: Array<{ id: string; data: Partial<Invoice> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'invoices', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  async deleteManyInvoices(ids: string[]): Promise<void> {
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.delete(doc(db, 'invoices', id));
    }
    await batch.commit();
  }

  async createManyInvoices(invoices: Array<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    for (const inv of invoices) {
      batch.set(doc(collection(db, 'invoices')), { ...inv, createdAt: now, updatedAt: now });
    }
    await batch.commit();
  }
}
