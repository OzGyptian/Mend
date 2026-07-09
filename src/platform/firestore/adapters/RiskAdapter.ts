import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { Risk, RiskRecord } from '../../../domain/types';
import type { RiskRepository } from '../../ports/risk.port';
import type { Unsubscribe } from '../../ports/index';

export class RiskAdapter implements RiskRepository {
  subscribeRisks(projectId: string, callback: (risks: Risk[]) => void): Unsubscribe {
    const q = query(collection(db, 'risks'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Risk>(d.id, d.data())));
    });
  }

  async listRisks(projectId: string): Promise<Risk[]> {
    const snap = await getDocs(query(collection(db, 'risks'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<Risk>(d.id, d.data()));
  }

  async createRisk(data: Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Risk> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'risks'), payload);
    return { id: ref.id, ...payload };
  }

  async updateRisk(id: string, data: Partial<Risk>): Promise<void> {
    await updateDoc(doc(db, 'risks', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async updateManyRisks(updates: Array<{ id: string; data: Partial<Risk> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'risks', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  async deleteRisk(id: string): Promise<void> {
    await deleteDoc(doc(db, 'risks', id));
  }

  async deleteManyRisks(ids: string[]): Promise<void> {
    const batch = writeBatch(db);
    for (const id of ids) batch.delete(doc(db, 'risks', id));
    await batch.commit();
  }

  async createManyRisks(records: Array<Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>>): Promise<string[]> {
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    const refs = records.map(() => doc(collection(db, 'risks')));
    records.forEach((record, i) => batch.set(refs[i], { ...record, createdAt: now, updatedAt: now }));
    await batch.commit();
    return refs.map(r => r.id);
  }

  subscribeRiskRecords(projectId: string, callback: (records: RiskRecord[]) => void): Unsubscribe {
    const q = query(collection(db, 'riskRecords'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<RiskRecord>(d.id, d.data())));
    });
  }

  async listRiskRecords(projectId: string, riskId?: string): Promise<RiskRecord[]> {
    const constraints = [where('projectId', '==', projectId)];
    if (riskId) constraints.push(where('riskId', '==', riskId));
    const snap = await getDocs(query(collection(db, 'riskRecords'), ...constraints));
    return snap.docs.map((d) => fromDoc<RiskRecord>(d.id, d.data()));
  }

  async createRiskRecord(data: Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RiskRecord> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'riskRecords'), payload);
    return { id: ref.id, ...payload };
  }

  async updateRiskRecord(id: string, data: Partial<RiskRecord>): Promise<void> {
    await updateDoc(doc(db, 'riskRecords', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteRiskRecord(id: string): Promise<void> {
    await deleteDoc(doc(db, 'riskRecords', id));
  }

  async deleteManyRiskRecords(ids: string[]): Promise<void> {
    const batch = writeBatch(db);
    for (const id of ids) batch.delete(doc(db, 'riskRecords', id));
    await batch.commit();
  }

  async createManyRiskRecords(records: Array<Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    for (const record of records) batch.set(doc(collection(db, 'riskRecords')), { ...record, createdAt: now, updatedAt: now });
    await batch.commit();
  }

  async updateManyRiskRecords(updates: Array<{ id: string; data: Partial<RiskRecord> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'riskRecords', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }
}
