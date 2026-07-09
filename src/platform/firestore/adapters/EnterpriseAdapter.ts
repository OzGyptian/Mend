import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, onSnapshot, query, where, limit,
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
    const q = query(collection(db, 'enterprises'), where('adminUsers', 'array-contains', adminUserEmail));
    return onSnapshot(q, (snap) => { callback(snap.docs.map((d) => fromDoc<Enterprise>(d.id, d.data()))); });
  }

  subscribeByUserId(userId: string, callback: (enterprises: Enterprise[]) => void): Unsubscribe {
    const q = query(collection(db, 'enterprises'), where('adminUsers', 'array-contains', userId));
    return onSnapshot(q, (snap) => { callback(snap.docs.map((d) => fromDoc<Enterprise>(d.id, d.data()))); });
  }

  subscribeById(enterpriseId: string, callback: (enterprise: Enterprise | null) => void): Unsubscribe {
    const q = query(collection(db, 'enterprises'), where('__name__', '==', enterpriseId));
    return onSnapshot(q, (snap) => { callback(snap.empty ? null : fromDoc<Enterprise>(snap.docs[0].id, snap.docs[0].data())); });
  }

  async bootstrapIfEmpty(userId: string, name: string, role: string): Promise<void> {
    const snap = await getDocs(collection(db, 'enterprises'));
    if (snap.empty) {
      await addDoc(collection(db, 'enterprises'), { name, adminUsers: [userId], settings: { theme: 'dark' }, users: { [userId]: { name, role } } });
    }
  }

  async acceptInvitation(token: string, userId: string, userEmail: string, displayName: string): Promise<{ enterpriseName: string } | null> {
    const q = query(collection(db, 'invitations'), where('token', '==', token), where('status', '==', 'pending'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const inviteDoc = snap.docs[0];
    const invite = inviteDoc.data();
    if (invite.email && userEmail.toLowerCase() !== invite.email.toLowerCase()) throw new Error(`This invitation was sent to ${invite.email}.`);
    if (new Date(invite.expiresAt) < new Date()) throw new Error('This invitation has expired.');
    const enterpriseSnap = await getDoc(doc(db, 'enterprises', invite.enterpriseId));
    if (!enterpriseSnap.exists()) return null;
    const entData = enterpriseSnap.data();
    if (!entData.users?.[userId]) {
      await updateDoc(doc(db, 'enterprises', invite.enterpriseId), { [`users.${userId}`]: { name: displayName, email: userEmail, role: 'Enterprise User', joinedAt: new Date().toISOString() }, adminUsers: [...(entData.adminUsers || []), userId] });
    }
    await updateDoc(inviteDoc.ref, { status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: userId });
    window.history.replaceState({}, document.title, window.location.pathname);
    return { enterpriseName: entData.name };
  }

  async update(enterpriseId: string, data: Partial<Enterprise>): Promise<void> {
    await updateDoc(doc(db, 'enterprises', enterpriseId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  subscribeAll(callback: (enterprises: Enterprise[]) => void): () => void {
    return onSnapshot(collection(db, 'enterprises'), (snap) => {
      callback(snap.docs.map(d => fromDoc<Enterprise>(d.id, d.data())));
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'enterprises', id));
  }

  async deleteMany(ids: string[]): Promise<void> {
    const batch = writeBatch(db);
    for (const id of ids) batch.delete(doc(db, 'enterprises', id));
    await batch.commit();
  }

  async createMany(records: Array<Omit<Enterprise, 'id'>>): Promise<void> {
    const batch = writeBatch(db);
    for (const record of records) batch.set(doc(collection(db, 'enterprises')), record);
    await batch.commit();
  }

  async create(data: Omit<Enterprise, 'id'>): Promise<Enterprise> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'enterprises'), payload);
    return { id: ref.id, ...payload };
  }
}
