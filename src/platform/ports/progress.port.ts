import type {
  ProgressPackage, ProgressItem, ProgressReportingPeriod, RuleOfCredit,
} from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ProgressRepository {
  subscribeProgressPackages(projectId: string, callback: (packages: ProgressPackage[]) => void): Unsubscribe;
  listProgressPackages(projectId: string): Promise<ProgressPackage[]>;
  createProgressPackage(data: Omit<ProgressPackage, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressPackage>;
  updateProgressPackage(id: string, data: Partial<ProgressPackage>): Promise<void>;
  deleteProgressPackage(id: string): Promise<void>;
  updateManyProgressPackages(updates: Array<{ id: string; data: Partial<ProgressPackage> }>): Promise<void>;

  subscribeProgressItems(projectId: string, callback: (items: ProgressItem[]) => void): Unsubscribe;
  listProgressItems(projectId: string, packageId?: string): Promise<ProgressItem[]>;
  createProgressItem(data: Omit<ProgressItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressItem>;
  updateProgressItem(id: string, data: Partial<ProgressItem>): Promise<void>;
  deleteProgressItem(id: string): Promise<void>;
  updateManyProgressItems(updates: Array<{ id: string; data: Partial<ProgressItem> }>): Promise<void>;

  subscribeRulesOfCredit(projectId: string, callback: (rules: RuleOfCredit[]) => void): Unsubscribe;
  listRulesOfCredit(projectId: string): Promise<RuleOfCredit[]>;
  createRuleOfCredit(data: Omit<RuleOfCredit, 'id' | 'createdAt'>): Promise<RuleOfCredit>;
  updateRuleOfCredit(id: string, data: Partial<RuleOfCredit>): Promise<void>;
  deleteRuleOfCredit(id: string): Promise<void>;
  updateManyRulesOfCredit(updates: Array<{ id: string; data: Partial<RuleOfCredit> }>): Promise<void>;

  subscribeReportingPeriods(projectId: string, callback: (periods: ProgressReportingPeriod[]) => void): Unsubscribe;
  listReportingPeriods(projectId: string): Promise<ProgressReportingPeriod[]>;
}
