import type { Change, ChangeRecord } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ChangeRepository {
  subscribeChanges(projectId: string, callback: (changes: Change[]) => void): Unsubscribe;
  getChange(id: string): Promise<Change | null>;
  createChange(data: Omit<Change, 'id' | 'createdAt' | 'updatedAt'>): Promise<Change>;
  updateChange(id: string, data: Partial<Change>): Promise<void>;
  deleteChange(id: string): Promise<void>;
  updateManyChanges(updates: Array<{ id: string; data: Partial<Change> }>): Promise<void>;

  subscribeChangeRecords(projectId: string, callback: (records: ChangeRecord[]) => void): Unsubscribe;
  listChangeRecords(projectId: string, changeId?: string): Promise<ChangeRecord[]>;
  createChangeRecord(data: Omit<ChangeRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChangeRecord>;
  updateChangeRecord(id: string, data: Partial<ChangeRecord>): Promise<void>;
  deleteChangeRecord(id: string): Promise<void>;
  updateManyChangeRecords(updates: Array<{ id: string; data: Partial<ChangeRecord> }>): Promise<void>;
  createManyChangeRecords(records: Array<Omit<ChangeRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void>;
  deleteManyChangeRecords(ids: string[]): Promise<void>;
}
