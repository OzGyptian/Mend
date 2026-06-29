import type {
  CostCode, Sheet, ForecastRow, EtcDetail,
  ActualCostRecord, BaselineBudgetRecord, CostPhasingRecord,
} from '../../domain/types';
import type { Unsubscribe } from './index';

export interface CostRepository {
  // Cost Codes
  subscribeCostCodes(projectId: string, callback: (codes: CostCode[]) => void): Unsubscribe;
  getCostCode(id: string): Promise<CostCode | null>;
  listCostCodes(projectId: string): Promise<CostCode[]>;
  createCostCode(data: Omit<CostCode, 'id'>): Promise<CostCode>;
  updateCostCode(id: string, data: Partial<CostCode>): Promise<void>;
  deleteCostCode(id: string): Promise<void>;

  // Sheets
  subscribeSheets(projectId: string, callback: (sheets: Sheet[]) => void): Unsubscribe;
  getSheet(id: string): Promise<Sheet | null>;
  createSheet(data: Omit<Sheet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sheet>;
  updateSheet(id: string, data: Partial<Sheet>): Promise<void>;
  deleteSheet(id: string): Promise<void>;

  // Forecast Rows (subcollection of Sheet — all mutations require sheetId for the path)
  subscribeForecastRows(sheetId: string, callback: (rows: ForecastRow[]) => void): Unsubscribe;
  listForecastRows(sheetId: string): Promise<ForecastRow[]>;
  createForecastRow(data: Omit<ForecastRow, 'id'>): Promise<ForecastRow>;
  createManyForecastRows(rows: Array<Omit<ForecastRow, 'id'>>): Promise<void>;
  updateForecastRow(sheetId: string, rowId: string, data: Partial<ForecastRow>): Promise<void>;
  deleteForecastRow(sheetId: string, rowId: string): Promise<void>;
  updateManyForecastRows(sheetId: string, updates: Array<{ id: string; data: Partial<ForecastRow> }>): Promise<void>;
  deleteManyForecastRows(sheetId: string, rowIds: string[]): Promise<void>;

  // ETC Details
  subscribeEtcDetails(projectId: string, callback: (details: EtcDetail[]) => void): Unsubscribe;
  listEtcDetails(projectId: string): Promise<EtcDetail[]>;
  createEtcDetail(data: Omit<EtcDetail, 'id' | 'createdAt'>): Promise<EtcDetail>;
  updateEtcDetail(id: string, data: Partial<EtcDetail>): Promise<void>;
  deleteEtcDetail(id: string): Promise<void>;
  updateManyEtcDetails(updates: Array<{ id: string; data: Partial<EtcDetail> }>): Promise<void>;

  // Actual Costs
  subscribeActualCosts(projectId: string, callback: (records: ActualCostRecord[]) => void): Unsubscribe;
  createActualCost(data: Omit<ActualCostRecord, 'id' | 'createdAt'>): Promise<ActualCostRecord>;
  updateActualCost(id: string, data: Partial<ActualCostRecord>): Promise<void>;
  deleteActualCost(id: string): Promise<void>;
  updateManyActualCosts(updates: Array<{ id: string; data: Partial<ActualCostRecord> }>): Promise<void>;

  // Baseline Budgets
  subscribeBaselineBudgets(projectId: string, callback: (records: BaselineBudgetRecord[]) => void): Unsubscribe;
  createBaselineBudget(data: Omit<BaselineBudgetRecord, 'id' | 'createdAt'>): Promise<BaselineBudgetRecord>;
  updateBaselineBudget(id: string, data: Partial<BaselineBudgetRecord>): Promise<void>;
  deleteBaselineBudget(id: string): Promise<void>;
  updateManyBaselineBudgets(updates: Array<{ id: string; data: Partial<BaselineBudgetRecord> }>): Promise<void>;

  // Cost Phasing
  subscribeCostPhasing(projectId: string, costCodeId: string, callback: (records: CostPhasingRecord[]) => void): Unsubscribe;
  listCostPhasing(projectId: string, costCodeId?: string): Promise<CostPhasingRecord[]>;
  saveCostPhasing(records: Array<Omit<CostPhasingRecord, 'id' | 'createdAt'>>): Promise<void>;
}
