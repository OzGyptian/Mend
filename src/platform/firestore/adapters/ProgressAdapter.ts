import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type {
  ProgressPackage, ProgressItem, ProgressReportingPeriod, RuleOfCredit,
} from '../../../domain/types';
import type { ProgressRepository } from '../../ports/progress.port';
import type { Unsubscribe } from '../../ports/index';

export class ProgressAdapter implements ProgressRepository {
  subscribeProgressPackages(projectId: string, callback: (packages: ProgressPackage[]) => void): Unsubscribe {
    const q = query(collection(db, 'progressPackages'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ProgressPackage>(d.id, d.data())));
    });
  }

  async listProgressPackages(projectId: string): Promise<ProgressPackage[]> {
    const snap = await getDocs(query(collection(db, 'progressPackages'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<ProgressPackage>(d.id, d.data()));
  }

  async createProgressPackage(data: Omit<ProgressPackage, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressPackage> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'progressPackages'), payload);
    return { id: ref.id, ...payload };
  }

  async updateProgressPackage(id: string, data: Partial<ProgressPackage>): Promise<void> {
    await updateDoc(doc(db, 'progressPackages', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteProgressPackage(id: string): Promise<void> {
    await deleteDoc(doc(db, 'progressPackages', id));
  }

  subscribeProgressItems(projectId: string, callback: (items: ProgressItem[]) => void): Unsubscribe {
    const q = query(collection(db, 'progressItems'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ProgressItem>(d.id, d.data())));
    });
  }

  async listProgressItems(projectId: string, packageId?: string): Promise<ProgressItem[]> {
    const constraints = [where('projectId', '==', projectId)];
    if (packageId) constraints.push(where('packageDocId', '==', packageId));
    const snap = await getDocs(query(collection(db, 'progressItems'), ...constraints));
    return snap.docs.map((d) => fromDoc<ProgressItem>(d.id, d.data()));
  }

  async createProgressItem(data: Omit<ProgressItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressItem> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'progressItems'), payload);
    return { id: ref.id, ...payload };
  }

  async updateProgressItem(id: string, data: Partial<ProgressItem>): Promise<void> {
    await updateDoc(doc(db, 'progressItems', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteProgressItem(id: string): Promise<void> {
    await deleteDoc(doc(db, 'progressItems', id));
  }

  async updateManyProgressItems(updates: Array<{ id: string; data: Partial<ProgressItem> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'progressItems', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  subscribeRulesOfCredit(projectId: string, callback: (rules: RuleOfCredit[]) => void): Unsubscribe {
    const q = query(collection(db, 'rulesOfCredit'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<RuleOfCredit>(d.id, d.data())));
    });
  }

  async listRulesOfCredit(projectId: string): Promise<RuleOfCredit[]> {
    const snap = await getDocs(query(collection(db, 'rulesOfCredit'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<RuleOfCredit>(d.id, d.data()));
  }

  async createRuleOfCredit(data: Omit<RuleOfCredit, 'id' | 'createdAt'>): Promise<RuleOfCredit> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'rulesOfCredit'), payload);
    return { id: ref.id, ...payload };
  }

  async updateRuleOfCredit(id: string, data: Partial<RuleOfCredit>): Promise<void> {
    await updateDoc(doc(db, 'rulesOfCredit', id), data);
  }

  async deleteRuleOfCredit(id: string): Promise<void> {
    await deleteDoc(doc(db, 'rulesOfCredit', id));
  }

  async updateManyRulesOfCredit(updates: Array<{ id: string; data: Partial<RuleOfCredit> }>): Promise<void> {
    const batch = writeBatch(db);
    for (const { id, data } of updates) {
      batch.update(doc(db, 'rulesOfCredit', id), data);
    }
    await batch.commit();
  }

  subscribeReportingPeriods(
    projectId: string,
    callback: (periods: ProgressReportingPeriod[]) => void,
  ): Unsubscribe {
    const q = query(collection(db, 'progressReportingPeriods'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ProgressReportingPeriod>(d.id, d.data())));
    });
  }

  async listReportingPeriods(projectId: string): Promise<ProgressReportingPeriod[]> {
    const snap = await getDocs(
      query(collection(db, 'progressReportingPeriods'), where('projectId', '==', projectId)),
    );
    return snap.docs.map((d) => fromDoc<ProgressReportingPeriod>(d.id, d.data()));
  }
}
