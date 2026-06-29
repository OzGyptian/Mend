import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, limit, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type { Project } from '../../../domain/types';
import type { ProjectRepository } from '../../ports/project.port';
import type { Unsubscribe } from '../../ports/index';

export class ProjectAdapter implements ProjectRepository {
  async get(projectId: string): Promise<Project | null> {
    const snap = await getDoc(doc(db, 'projects', projectId));
    return snap.exists() ? fromDoc<Project>(snap.id, snap.data()) : null;
  }

  async list(enterpriseId: string, userEmail: string): Promise<Project[]> {
    const q = query(
      collection(db, 'projects'),
      where('enterpriseId', '==', enterpriseId),
      where('members', 'array-contains', userEmail),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc<Project>(d.id, d.data()));
  }

  subscribe(projectId: string, callback: (project: Project | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'projects', projectId), (snap) => {
      callback(snap.exists() ? fromDoc<Project>(snap.id, snap.data()) : null);
    });
  }

  subscribeByEnterprise(
    enterpriseId: string,
    userEmail: string,
    callback: (projects: Project[]) => void,
  ): Unsubscribe {
    const q = query(
      collection(db, 'projects'),
      where('enterpriseId', '==', enterpriseId),
      where('members', 'array-contains', userEmail),
      limit(100),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Project>(d.id, d.data())));
    });
  }

  async create(data: Omit<Project, 'id' | 'dateCreated' | 'dateLastModified'>): Promise<Project> {
    const now = new Date().toISOString();
    const payload = { ...data, dateCreated: now, dateLastModified: now };
    const ref = await addDoc(collection(db, 'projects'), payload);
    return { id: ref.id, ...payload };
  }

  async update(projectId: string, data: Partial<Project>): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId), {
      ...data,
      dateLastModified: new Date().toISOString(),
    });
  }

  async delete(projectId: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', projectId));
  }

  async deleteProjectWithSheets(projectId: string): Promise<void> {
    const sheetsSnap = await getDocs(query(collection(db, 'sheets'), where('projectId', '==', projectId)));
    const batch = writeBatch(db);
    for (const sheetDoc of sheetsSnap.docs) {
      const rowsSnap = await getDocs(collection(db, `sheets/${sheetDoc.id}/rows`));
      rowsSnap.docs.forEach(rowDoc => batch.delete(rowDoc.ref));
      batch.delete(sheetDoc.ref);
    }
    batch.delete(doc(db, 'projects', projectId));
    await batch.commit();
  }

  async findSheetsByName(projectId: string, sheetName: string): Promise<Array<{ id: string }>> {
    const snap = await getDocs(query(collection(db, 'sheets'), where('projectId', '==', projectId), where('sheetName', '==', sheetName)));
    return snap.docs.map(d => ({ id: d.id }));
  }

  async createSheet(data: Record<string, unknown>): Promise<{ id: string }> {
    const ref = await addDoc(collection(db, 'sheets'), { ...data, createdAt: new Date().toISOString() });
    return { id: ref.id };
  }

  async createSheetRow(sheetId: string, data: Record<string, unknown>): Promise<void> {
    await addDoc(collection(db, `sheets/${sheetId}/rows`), { ...data, createdAt: new Date().toISOString() });
  }

  async checkProjectCodeExists(enterpriseId: string, projectCode: string): Promise<boolean> {
    const snap = await getDocs(query(collection(db, 'projects'), where('enterpriseId', '==', enterpriseId), where('projectCode', '==', projectCode)));
    return !snap.empty;
  }
}
