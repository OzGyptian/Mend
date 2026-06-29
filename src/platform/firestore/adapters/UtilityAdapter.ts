import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { SavedView, PeriodSnapshot } from '../../../domain/types';
import type { UtilityRepository } from '../../ports/utility.port';
import type { Unsubscribe } from '../../ports/index';

export class UtilityAdapter implements UtilityRepository {
  subscribeSavedViews(userId: string, tableId: string, callback: (views: SavedView[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'savedViews'),
      where('userId', '==', userId),
      where('tableId', '==', tableId),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<SavedView>(d.id, d.data())));
    });
  }

  async createSavedView(data: Omit<SavedView, 'id' | 'createdAt'>): Promise<SavedView> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'savedViews'), payload);
    return { id: ref.id, ...payload };
  }

  async updateSavedView(id: string, data: Partial<SavedView>): Promise<void> {
    await updateDoc(doc(db, 'savedViews', id), data);
  }

  async deleteSavedView(id: string): Promise<void> {
    await deleteDoc(doc(db, 'savedViews', id));
  }

  async savePeriodSnapshot(data: Omit<PeriodSnapshot, 'id' | 'createdAt'>): Promise<void> {
    await addDoc(collection(db, 'periodSnapshots'), {
      ...data,
      createdAt: new Date().toISOString(),
    });
  }

  async savePeriodSnapshots(records: Array<Omit<PeriodSnapshot, 'id' | 'createdAt'>>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const record of records) {
      batch.set(doc(collection(db, 'periodSnapshots')), { ...record, createdAt: now });
    }
    await batch.commit();
  }

  async createInvitation(data: {
    email: string;
    enterpriseId: string;
    enterpriseName: string;
    invitedBy: string;
    status: 'pending';
    createdAt: string;
  }): Promise<{ id: string }> {
    const ref = await addDoc(collection(db, 'invitations'), data);
    return { id: ref.id };
  }

  async recordAuditEvent(data: {
    enterpriseId: string;
    projectId: string | null;
    userId: string;
    userEmail: string;
    action: string;
    occurredAt: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await addDoc(collection(db, 'auditLogs'), data);
  }
}
