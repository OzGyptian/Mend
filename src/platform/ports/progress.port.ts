import type {
  ProgressPackage, ProgressItem, ProgressReportingPeriod, RuleOfCredit,
} from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ProgressRepository {
  subscribePackages(projectId: string, callback: (packages: ProgressPackage[]) => void): Unsubscribe;
  listPackages(projectId: string): Promise<ProgressPackage[]>;
  createPackage(data: Omit<ProgressPackage, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressPackage>;
  updatePackage(id: string, data: Partial<ProgressPackage>): Promise<void>;
  deletePackage(id: string): Promise<void>;

  subscribeItems(projectId: string, callback: (items: ProgressItem[]) => void): Unsubscribe;
  listItems(projectId: string, packageDocId?: string): Promise<ProgressItem[]>;
  createItem(data: Omit<ProgressItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressItem>;
  updateItem(id: string, data: Partial<ProgressItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  batchUpdateItems(updates: Array<{ id: string; data: Partial<ProgressItem> }>): Promise<void>;

  subscribeRulesOfCredit(projectId: string, callback: (rules: RuleOfCredit[]) => void): Unsubscribe;
  listRulesOfCredit(projectId: string): Promise<RuleOfCredit[]>;
  createRuleOfCredit(data: Omit<RuleOfCredit, 'id' | 'createdAt'>): Promise<RuleOfCredit>;
  updateRuleOfCredit(id: string, data: Partial<RuleOfCredit>): Promise<void>;
  deleteRuleOfCredit(id: string): Promise<void>;
  batchUpdateRulesOfCredit(updates: Array<{ id: string; data: Partial<RuleOfCredit> }>): Promise<void>;

  subscribeReportingPeriods(projectId: string, callback: (periods: ProgressReportingPeriod[]) => void): Unsubscribe;
  listReportingPeriods(projectId: string): Promise<ProgressReportingPeriod[]>;
}
