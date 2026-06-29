import {
  collection, doc, getDoc, addDoc, updateDoc, onSnapshot, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { Enterprise } from '../../../domain/types';
import type { EnterpriseRepository } from '../../ports/enterprise.port';
import type { Unsubscribe } from '../../ports/index';

export class EnterpriseAdapter implements EnterpriseRepository {
  async get(enterpriseId: string): Promise<Enterprise | null> {
    const snap = await getDoc(doc(db, 'enterprises', enterpriseId));
    return snap.exists() ? fromDoc<Enterprise>(snap.id, snap.data()) : null;
  }

  subscribe(enterpriseId: string, callback: (enterprise: Enterprise | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'enterprises', enterpriseId), (snap) => {
      callback(snap.exists() ? fromDoc<Enterprise>(snap.id, snap.data()) : null);
    });
  }

  subscribeByAdmin(adminUserEmail: string, callback: (enterprises: Enterprise[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'enterprises'),
      where('adminUsers', 'array-contains', adminUserEmail),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Enterprise>(d.id, d.data())));
    });
  }

  async update(enterpriseId: string, data: Partial<Enterprise>): Promise<void> {
    await updateDoc(doc(db, 'enterprises', enterpriseId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async create(data: Omit<Enterprise, 'id'>): Promise<Enterprise> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'enterprises'), payload);
    return { id: ref.id, ...payload };
  }
}
