import type { ProcurementItem, ProcurementStepDefinition } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ProcurementRepository {
  subscribeProcurementItems(projectId: string, callback: (items: ProcurementItem[]) => void): Unsubscribe;
  listProcurementItems(projectId: string): Promise<ProcurementItem[]>;
  createProcurementItem(data: Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementItem>;
  updateProcurementItem(id: string, data: Partial<ProcurementItem>): Promise<void>;
  deleteProcurementItem(id: string): Promise<void>;
  deleteManyProcurementItems(ids: string[]): Promise<void>;
  updateManyProcurementItems(updates: Array<{ id: string; data: Partial<ProcurementItem> }>): Promise<void>;
  createManyProcurementItems(data: Array<Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void>;

  subscribeProjectStepDefinitions(projectId: string, callback: (steps: ProcurementStepDefinition[]) => void): Unsubscribe;
  subscribeEnterpriseStepDefinitions(enterpriseId: string, callback: (steps: ProcurementStepDefinition[]) => void): Unsubscribe;
  listProjectStepDefinitions(projectId: string): Promise<ProcurementStepDefinition[]>;
  listEnterpriseStepDefinitions(enterpriseId: string): Promise<ProcurementStepDefinition[]>;
  createStepDefinition(data: Omit<ProcurementStepDefinition, 'id'>): Promise<ProcurementStepDefinition>;
  updateStepDefinition(id: string, data: Partial<ProcurementStepDefinition>): Promise<void>;
  deleteStepDefinition(id: string): Promise<void>;
}
