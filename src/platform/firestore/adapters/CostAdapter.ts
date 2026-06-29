import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromDoc } from '../converters';
import type {
  CostCode, Sheet, ForecastRow, EtcDetail,
  ActualCostRecord, BaselineBudgetRecord, CostPhasingRecord,
} from '../../../domain/types';
import type { CostRepository } from '../../ports/cost.port';
import type { Unsubscribe } from '../../ports/index';

export class CostAdapter implements CostRepository {
  // ── Cost Codes ────────────────────────────────────────────────────────────

  subscribeCostCodes(projectId: string, callback: (codes: CostCode[]) => void): Unsubscribe {
    const q = query(collection(db, 'costCodes'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<CostCode>(d.id, d.data())));
    });
  }

  async getCostCode(id: string): Promise<CostCode | null> {
    const snap = await getDoc(doc(db, 'costCodes', id));
    return snap.exists() ? fromDoc<CostCode>(snap.id, snap.data()) : null;
  }

  async listCostCodes(projectId: string): Promise<CostCode[]> {
    const snap = await getDocs(query(collection(db, 'costCodes'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<CostCode>(d.id, d.data()));
  }

  async createCostCode(data: Omit<CostCode, 'id'>): Promise<CostCode> {
    const ref = await addDoc(collection(db, 'costCodes'), data);
    return { id: ref.id, ...data };
  }

  async updateCostCode(id: string, data: Partial<CostCode>): Promise<void> {
    await updateDoc(doc(db, 'costCodes', id), data);
  }

  async deleteCostCode(id: string): Promise<void> {
    await deleteDoc(doc(db, 'costCodes', id));
  }

  async updateManyCostCodes(updates: Array<{ id: string; data: Partial<CostCode> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'costCodes', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  // ── Sheets ────────────────────────────────────────────────────────────────

  subscribeSheets(projectId: string, callback: (sheets: Sheet[]) => void): Unsubscribe {
    const q = query(collection(db, 'sheets'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<Sheet>(d.id, d.data())));
    });
  }

  async getSheet(id: string): Promise<Sheet | null> {
    const snap = await getDoc(doc(db, 'sheets', id));
    return snap.exists() ? fromDoc<Sheet>(snap.id, snap.data()) : null;
  }

  async createSheet(data: Omit<Sheet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sheet> {
    const now = new Date().toISOString();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const ref = await addDoc(collection(db, 'sheets'), payload);
    return { id: ref.id, ...payload };
  }

  async updateSheet(id: string, data: Partial<Sheet>): Promise<void> {
    await updateDoc(doc(db, 'sheets', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteSheet(id: string): Promise<void> {
    await deleteDoc(doc(db, 'sheets', id));
  }

  // ── Forecast Rows ─────────────────────────────────────────────────────────

  subscribeForecastRows(sheetId: string, callback: (rows: ForecastRow[]) => void): Unsubscribe {
    const q = query(collection(db, 'sheets', sheetId, 'rows'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ForecastRow>(d.id, d.data())));
    });
  }

  async listForecastRows(sheetId: string): Promise<ForecastRow[]> {
    const snap = await getDocs(collection(db, 'sheets', sheetId, 'rows'));
    return snap.docs.map((d) => fromDoc<ForecastRow>(d.id, d.data()));
  }

  async createForecastRow(data: Omit<ForecastRow, 'id'>): Promise<ForecastRow> {
    const ref = await addDoc(collection(db, 'sheets', data.sheetId, 'rows'), data);
    return { id: ref.id, ...data };
  }

  async createManyForecastRows(rows: Array<Omit<ForecastRow, 'id'>>): Promise<void> {
    const batch = writeBatch(db);
    for (const row of rows) {
      batch.set(doc(collection(db, 'sheets', row.sheetId, 'rows')), row);
    }
    await batch.commit();
  }

  async updateForecastRow(sheetId: string, rowId: string, data: Partial<ForecastRow>): Promise<void> {
    await updateDoc(doc(db, 'sheets', sheetId, 'rows', rowId), data);
  }

  async deleteForecastRow(sheetId: string, rowId: string): Promise<void> {
    await deleteDoc(doc(db, 'sheets', sheetId, 'rows', rowId));
  }

  async updateManyForecastRows(
    sheetId: string,
    updates: Array<{ id: string; data: Partial<ForecastRow> }>,
  ): Promise<void> {
    const batch = writeBatch(db);
    for (const { id, data } of updates) {
      batch.set(doc(db, 'sheets', sheetId, 'rows', id), data, { merge: true });
    }
    await batch.commit();
  }

  async deleteManyForecastRows(sheetId: string, rowIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    for (const rowId of rowIds) {
      batch.delete(doc(db, 'sheets', sheetId, 'rows', rowId));
    }
    await batch.commit();
  }

  // ── ETC Details ───────────────────────────────────────────────────────────

  subscribeEtcDetails(projectId: string, callback: (details: EtcDetail[]) => void): Unsubscribe {
    const q = query(collection(db, 'etcDetails'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<EtcDetail>(d.id, d.data())));
    });
  }

  async listEtcDetails(projectId: string): Promise<EtcDetail[]> {
    const snap = await getDocs(query(collection(db, 'etcDetails'), where('projectId', '==', projectId)));
    return snap.docs.map((d) => fromDoc<EtcDetail>(d.id, d.data()));
  }

  async createEtcDetail(data: Omit<EtcDetail, 'id' | 'createdAt'>): Promise<EtcDetail> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'etcDetails'), payload);
    return { id: ref.id, ...payload };
  }

  async updateEtcDetail(id: string, data: Partial<EtcDetail>): Promise<void> {
    await updateDoc(doc(db, 'etcDetails', id), data);
  }

  async deleteEtcDetail(id: string): Promise<void> {
    await deleteDoc(doc(db, 'etcDetails', id));
  }

  async updateManyEtcDetails(updates: Array<{ id: string; data: Partial<EtcDetail> }>): Promise<void> {
    const batch = writeBatch(db);
    for (const { id, data } of updates) {
      batch.update(doc(db, 'etcDetails', id), data);
    }
    await batch.commit();
  }

  // ── Actual Costs ──────────────────────────────────────────────────────────

  subscribeActualCosts(projectId: string, callback: (records: ActualCostRecord[]) => void): Unsubscribe {
    const q = query(collection(db, 'actualCosts'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<ActualCostRecord>(d.id, d.data())));
    });
  }

  async listActualCosts(projectId: string): Promise<ActualCostRecord[]> {
    const snap = await getDocs(query(collection(db, 'actualCosts'), where('projectId', '==', projectId)));
    return snap.docs.map(d => fromDoc<ActualCostRecord>(d.id, d.data()));
  }

  async createActualCost(data: Omit<ActualCostRecord, 'id' | 'createdAt'>): Promise<ActualCostRecord> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'actualCosts'), payload);
    return { id: ref.id, ...payload };
  }

  async saveManyActualCosts(records: Array<Omit<ActualCostRecord, 'id' | 'createdAt'>>): Promise<void> {
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    for (const record of records) {
      batch.set(doc(collection(db, 'actualCosts')), { ...record, createdAt: now });
    }
    await batch.commit();
  }

  async updateActualCost(id: string, data: Partial<ActualCostRecord>): Promise<void> {
    await updateDoc(doc(db, 'actualCosts', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteActualCost(id: string): Promise<void> {
    await deleteDoc(doc(db, 'actualCosts', id));
  }

  async updateManyActualCosts(updates: Array<{ id: string; data: Partial<ActualCostRecord> }>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'actualCosts', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  // ── Baseline Budgets ──────────────────────────────────────────────────────

  subscribeBaselineBudgets(
    projectId: string,
    callback: (records: BaselineBudgetRecord[]) => void,
  ): Unsubscribe {
    const q = query(collection(db, 'baselineBudgets'), where('projectId', '==', projectId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<BaselineBudgetRecord>(d.id, d.data())));
    });
  }

  async createBaselineBudget(
    data: Omit<BaselineBudgetRecord, 'id' | 'createdAt'>,
  ): Promise<BaselineBudgetRecord> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'baselineBudgets'), payload);
    return { id: ref.id, ...payload };
  }

  async updateBaselineBudget(id: string, data: Partial<BaselineBudgetRecord>): Promise<void> {
    await updateDoc(doc(db, 'baselineBudgets', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteBaselineBudget(id: string): Promise<void> {
    await deleteDoc(doc(db, 'baselineBudgets', id));
  }

  async updateManyBaselineBudgets(
    updates: Array<{ id: string; data: Partial<BaselineBudgetRecord> }>,
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const { id, data } of updates) {
      batch.update(doc(db, 'baselineBudgets', id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }

  // ── Cost Phasing ──────────────────────────────────────────────────────────

  subscribeCostPhasing(
    projectId: string,
    costCodeId: string,
    callback: (records: CostPhasingRecord[]) => void,
  ): Unsubscribe {
    const q = query(
      collection(db, 'costPhasing'),
      where('projectId', '==', projectId),
      where('costCodeId', '==', costCodeId),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => fromDoc<CostPhasingRecord>(d.id, d.data())));
    });
  }

  async listCostPhasing(projectId: string, costCodeId?: string): Promise<CostPhasingRecord[]> {
    const constraints = [where('projectId', '==', projectId)];
    if (costCodeId) constraints.push(where('costCodeId', '==', costCodeId));
    const snap = await getDocs(query(collection(db, 'costPhasing'), ...constraints));
    return snap.docs.map((d) => fromDoc<CostPhasingRecord>(d.id, d.data()));
  }

  async updateCostPhasing(id: string, data: Partial<CostPhasingRecord>): Promise<void> {
    await updateDoc(doc(db, 'costPhasing', id), { ...data, updatedAt: new Date().toISOString() });
  }

  async saveCostPhasing(records: Array<Omit<CostPhasingRecord, 'id' | 'createdAt'>>): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const record of records) {
      batch.set(doc(collection(db, 'costPhasing')), { ...record, createdAt: now });
    }
    await batch.commit();
  }
}
