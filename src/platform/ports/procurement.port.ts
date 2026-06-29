import type { ProcurementItem, ProcurementStepDefinition } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ProcurementRepository {
  subscribeItems(projectId: string, callback: (items: ProcurementItem[]) => void): Unsubscribe;
  listItems(projectId: string): Promise<ProcurementItem[]>;
  createItem(data: Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementItem>;
  updateItem(id: string, data: Partial<ProcurementItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  batchUpdateItems(updates: Array<{ id: string; data: Partial<ProcurementItem> }>): Promise<void>;

  subscribeStepDefinitions(
    scope: { projectId?: string; enterpriseId?: string },
    callback: (steps: ProcurementStepDefinition[]) => void
  ): Unsubscribe;
  listStepDefinitions(scope: { projectId?: string; enterpriseId?: string }): Promise<ProcurementStepDefinition[]>;
  createStepDefinition(data: Omit<ProcurementStepDefinition, 'id'>): Promise<ProcurementStepDefinition>;
  updateStepDefinition(id: string, data: Partial<ProcurementStepDefinition>): Promise<void>;
  deleteStepDefinition(id: string): Promise<void>;
}
