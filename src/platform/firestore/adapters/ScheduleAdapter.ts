import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { ScheduleItem, Calendar } from '../../../domain/types';
import type { ScheduleRepository } from '../../ports/schedule.port';
import type { Unsubscribe } from '../../ports/index';

export class ScheduleAdapter implements ScheduleRepository {
  subscribeScheduleItems(projectId: string, callback: (items: ScheduleItem[]) => void): Unsubscribe {
    const q = query(collection(db, 'scheduleItems'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ScheduleItem>(d.id, d.data())));
    });
  }

  async listScheduleItems(projectId: string): Promise<ScheduleItem[]> {
    const snap = await getDocs(query(collection(db, 'scheduleItems'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<ScheduleItem>(d.id, d.data()));
  }

  async createScheduleItem(data: Omit<ScheduleItem, 'id' | 'updatedAt'>): Promise<ScheduleItem> {
    const payload = { ...data, updatedAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'scheduleItems'), payload);
    return { id: ref.id, ...payload };
  }

  async updateScheduleItem(id: string, data: Partial<ScheduleItem>): Promise<void> {
    await updateDoc(doc(db, 'scheduleItems', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteScheduleItem(id: string): Promise<void> {
    await deleteDoc(doc(db, 'scheduleItems', id));
  }

  async updateManyScheduleItems(updates: Array<{ id: string; data: Partial<ScheduleItem> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'scheduleItems', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  subscribeProjectCalendars(projectId: string, callback: (calendars: Calendar[]) => void): Unsubscribe {
    const q = query(collection(db, 'calendars'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Calendar>(d.id, d.data())));
    });
  }

  subscribeEnterpriseCalendars(enterpriseId: string, callback: (calendars: Calendar[]) => void): Unsubscribe {
    const q = query(collection(db, 'calendars'), where('enterpriseId', '==', enterpriseId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Calendar>(d.id, d.data())));
    });
  }

  async listProjectCalendars(projectId: string): Promise<Calendar[]> {
    const snap = await getDocs(query(collection(db, 'calendars'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<Calendar>(d.id, d.data()));
  }

  async listEnterpriseCalendars(enterpriseId: string): Promise<Calendar[]> {
    const snap = await getDocs(query(collection(db, 'calendars'), where('enterpriseId', '==', enterpriseId)));
    return snap.docs.map((d) => fromDoc<Calendar>(d.id, d.data()));
  }

  async getCalendar(id: string): Promise<Calendar | null> {
    const snap = await getDoc(doc(db, 'calendars', id));
    return snap.exists() ? fromDoc<Calendar>(snap.id, snap.data()) : null;
  }

  async createCalendar(data: Omit<Calendar, 'id' | 'createdAt'>): Promise<Calendar> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'calendars'), payload);
    return { id: ref.id, ...payload };
  }

  async updateCalendar(id: string, data: Partial<Calendar>): Promise<void> {
    await updateDoc(doc(db, 'calendars', id), data);
  }

  async deleteCalendar(id: string): Promise<void> {
    await deleteDoc(doc(db, 'calendars', id));
  }
}
