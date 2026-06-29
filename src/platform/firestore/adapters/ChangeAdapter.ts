import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { Change, ChangeRecord } from '../../../domain/types';
import type { ChangeRepository } from '../../ports/change.port';
import type { Unsubscribe } from '../../ports/index';

export class ChangeAdapter implements ChangeRepository {
  subscribeChanges(projectId: string, callback: (changes: Change[]) => void): Unsubscribe {
    const q = query(collection(db, 'changes'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Change>(d.id, d.data())));
    });
  }

  async getChange(id: string): Promise<Change | null> {
    const snap = await getDoc(doc(db, 'changes', id));
    return snap.exists() ? fromDoc<Change>(snap.id, snap.data()) : null;
  }

  async createChange(data: Omit<Change, 'id' | 'createdAt' | 'updatedAt'>): Promise<Change> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'changes'), payload);
    return { id: ref.id, ...payload };
  }

  async updateChange(id: string, data: Partial<Change>): Promise<void> {
    await updateDoc(doc(db, 'changes', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteChange(id: string): Promise<void> {
    await deleteDoc(doc(db, 'changes', id));
  }

  subscribeChangeRecords(projectId: string, callback: (records: ChangeRecord[]) => void): Unsubscribe {
    const q = query(collection(db, 'changeRecords'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ChangeRecord>(d.id, d.data())));
    });
  }

  async listChangeRecords(projectId: string, changeId?: string): Promise<ChangeRecord[]> {
    const constraints = [where('projectId', '==', projectId)];
    if (changeId) constraints.push(where('changeId', '==', changeId));
    const snap = await getDocs(query(collection(db, 'changeRecords'), ...constraints));
    return snap.docs.map((d) => fromDoc<ChangeRecord>(d.id, d.data()));
  }

  async createChangeRecord(data: Omit<ChangeRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChangeRecord> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'changeRecords'), payload);
    return { id: ref.id, ...payload };
  }

  async updateChangeRecord(id: string, data: Partial<ChangeRecord>): Promise<void> {
    await updateDoc(doc(db, 'changeRecords', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteChangeRecord(id: string): Promise<void> {
    await deleteDoc(doc(db, 'changeRecords', id));
  }

  async updateManyChangeRecords(updates: Array<{ id: string; data: Partial<ChangeRecord> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'changeRecords', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  async createManyChangeRecords(records: Array<Omit<ChangeRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    for (const record of records) {
      batch.set(doc(collection(db, 'changeRecords')), { ...record, createdAt: now, updatedAt: now });
    }
    await batch.commit();
  }

  async deleteManyChangeRecords(ids: string[]): Promise<void> {
    const batch = writeBatch(db);
    for (const id of ids) batch.delete(doc(db, 'changeRecords', id));
    await batch.commit();
  }
}
