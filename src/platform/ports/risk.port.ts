import type { Risk, RiskRecord } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface RiskRepository {
  subscribeRisks(projectId: string, callback: (risks: Risk[]) => void): Unsubscribe;
  listRisks(projectId: string): Promise<Risk[]>;
  createRisk(data: Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Risk>;
  updateRisk(id: string, data: Partial<Risk>): Promise<void>;
  deleteRisk(id: string): Promise<void>;

  subscribeRiskRecords(projectId: string, callback: (records: RiskRecord[]) => void): Unsubscribe;
  listRiskRecords(projectId: string, riskId?: string): Promise<RiskRecord[]>;
  createRiskRecord(data: Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RiskRecord>;
  updateRiskRecord(id: string, data: Partial<RiskRecord>): Promise<void>;
  deleteRiskRecord(id: string): Promise<void>;
  updateManyRiskRecords(updates: Array<{ id: string; data: Partial<RiskRecord> }>): Promise<void>;
}
