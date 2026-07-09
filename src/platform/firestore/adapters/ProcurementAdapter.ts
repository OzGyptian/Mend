import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { ProcurementItem, ProcurementStepDefinition } from '../../../domain/types';
import type { ProcurementRepository } from '../../ports/procurement.port';
import type { Unsubscribe } from '../../ports/index';

export class ProcurementAdapter implements ProcurementRepository {
  subscribeProcurementItems(projectId: string, callback: (items: ProcurementItem[]) => void): Unsubscribe {
    const q = query(collection(db, 'procurementItems'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ProcurementItem>(d.id, d.data())));
    });
  }

  async listProcurementItems(projectId: string): Promise<ProcurementItem[]> {
    const snap = await getDocs(query(collection(db, 'procurementItems'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<ProcurementItem>(d.id, d.data()));
  }

  async createProcurementItem(
    data: Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ProcurementItem> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'procurementItems'), payload);
    return { id: ref.id, ...payload };
  }

  async updateProcurementItem(id: string, data: Partial<ProcurementItem>): Promise<void> {
    await updateDoc(doc(db, 'procurementItems', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteProcurementItem(id: string): Promise<void> {
    await deleteDoc(doc(db, 'procurementItems', id));
  }

  async updateManyProcurementItems(
    updates: Array<{ id: string; data: Partial<ProcurementItem> }>,
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'procurementItems', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  subscribeProjectStepDefinitions(
    projectId: string,
    callback: (steps: ProcurementStepDefinition[]) => void,
  ): Unsubscribe {
    const q = query(collection(db, 'procurementStepDefinitions'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ProcurementStepDefinition>(d.id, d.data())));
    });
  }

  subscribeEnterpriseStepDefinitions(
    enterpriseId: string,
    callback: (steps: ProcurementStepDefinition[]) => void,
  ): Unsubscribe {
    const q = query(
      collection(db, 'procurementStepDefinitions'),
      where('enterpriseId', '==', enterpriseId),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ProcurementStepDefinition>(d.id, d.data())));
    });
  }

  async listProjectStepDefinitions(projectId: string): Promise<ProcurementStepDefinition[]> {
    const snap = await getDocs(
      query(collection(db, 'procurementStepDefinitions'), where('projectId', '==', projectId)),
    );
    return snap.docs.map((d) => fromDoc<ProcurementStepDefinition>(d.id, d.data()));
  }

  async listEnterpriseStepDefinitions(enterpriseId: string): Promise<ProcurementStepDefinition[]> {
    const snap = await getDocs(
      query(collection(db, 'procurementStepDefinitions'), where('enterpriseId', '==', enterpriseId)),
    );
    return snap.docs.map((d) => fromDoc<ProcurementStepDefinition>(d.id, d.data()));
  }

  async createStepDefinition(data: Omit<ProcurementStepDefinition, 'id'>): Promise<ProcurementStepDefinition> {
    const ref = await addDoc(collection(db, 'procurementStepDefinitions'), data);
    return { id: ref.id, ...data };
  }

  async updateStepDefinition(id: string, data: Partial<ProcurementStepDefinition>): Promise<void> {
    await updateDoc(doc(db, 'procurementStepDefinitions', id), data);
  }

  async deleteStepDefinition(id: string): Promise<void> {
    await deleteDoc(doc(db, 'procurementStepDefinitions', id));
  }

  async deleteManyProcurementItems(ids: string[]): Promise<void> {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, 'procurementItems', id)));
    await batch.commit();
  }

  async createManyProcurementItems(data: Array<Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const now = new Date().toISOString();
    const chunks: typeof data[] = [];
    for (let i = 0; i < data.length; i += 400) chunks.push(data.slice(i, i + 400));
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        const ref = doc(collection(db, 'procurementItems'));
        batch.set(ref, { ...item, createdAt: now, updatedAt: now });
      });
      await batch.commit();
    }
  }
}
