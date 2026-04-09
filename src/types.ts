export type ForecastMethod = 'commitment' | 'time-based';
export type DistributionMethod = 'manual' | 'even' | 'front' | 'back' | 'bell';

export type ProjectStatus = 'Active' | 'On Hold' | 'Closed' | 'Archived';

export interface ProjectAttributeValue {
  id: string;
  description: string;
  sortOrder: number;
}

export interface ProjectAttribute {
  id: string; // "01" to "10"
  title: string;
  values: ProjectAttributeValue[];
}

export interface ResourceRate {
  id: string;
  name: string;
  unit: string;
  rate?: number;
  category?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
}

export interface CostElement {
  id: string;
  description: string;
  sortCode: string;
}

export interface Enterprise {
  id: string;
  enterpriseId: string;
  name: string;
  logoURL?: string;
  adminUsers: string[];
  createdAt: string;
  theme?: 'light' | 'dark';
  users?: Record<string, { 
    email: string; 
    name?: string;
    displayName?: string;
    photoURL?: string;
    joinedDate?: string;
    joinedAt?: string;
    role: 'Enterprise System Admin' | 'Enterprise User' 
  }>;
  projectAttributes?: ProjectAttribute[];
  lineItemAttributes?: ProjectAttribute[];
  costCodeAttributes?: ProjectAttribute[];
  resourceRates?: ResourceRate[];
  costElements?: CostElement[];
  categories?: string[];
  controlAccounts?: string[];
  orderNumbers?: string[];
}

export interface ProjectCostElement {
  id: string;
  description: string;
  sortCode: string;
  enterpriseCostElementId?: string;
}

export interface Project {
  id: string;
  enterpriseId: string;
  projectName: string;
  projectCode: string;
  status?: ProjectStatus;
  projectBudget: number;
  startDate: string;
  endDate: string;
  cutoffDate: string;
  users: Record<string, 'Project Admin' | 'Project User'>;
  attributes?: Record<string, string>;
  photoURL?: string;
  scopeDescription?: string;
  clientName?: string;
  projectManagerName?: string;
  dateCreated: string;
  dateLastModified: string;
  categories?: string[];
  controlAccounts?: string[];
  orderNumbers?: string[];
  costElements?: ProjectCostElement[];
  costCodeAttributes?: ProjectAttribute[];
  lineItemAttributes?: ProjectAttribute[];
  resourceRates?: ResourceRate[];
  reportingPeriods?: {
    baseDate: string;
    duration: 'week' | 'month';
    numberOfPeriods: number;
    periods: { id: string; startDate: string; endDate: string; name: string; status: 'open' | 'closed' }[];
    currentPeriodId?: string;
  };
}

export interface Sheet {
  id: string;
  projectId: string;
  sheetName: string;
  forecastMethod: ForecastMethod;
  version: string;
  lockedStatus: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  users?: string[]; // UIDs
}

export interface ForecastRow {
  id: string;
  sheetId: string;
  costCode: string;
  description: string;
  vendor: string;
  qty?: number;
  rate?: number;
  budget: number;
  committedCost: number;
  actualCostToDate: number;
  costToGo: number;
  eac: number;
  startDate?: string;
  endDate?: string;
  timePhasing: Record<string, number>;
  distributionMethod: DistributionMethod;
  attributes?: Record<string, any>;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface CostCode {
  id: string; // Firestore Document ID
  code: string; // User-facing Cost Code ID
  projectId: string;
  name: string;
  enterpriseAttributes: Record<string, string>;
  projectAttributes: Record<string, string>;
  eacMethod: 'Manual' | 'Change Management' | 'ETC Details' | 'Sub-Contract Management';
  sortOrder: number;

  // Budget Fields
  baselineBudget: number;
  budgetChanges: number;
  approvedBudget: number;
  approvedBudgetPrevious: number;
  approvedBudgetMovement: number;

  // Actual Cost Fields
  actualCostThisPeriod: number;
  actualCostToDate: number;

  // EAC & ETC Fields
  estimateToComplete: number;
  estimateAtCompletion: number;
  estimateAtCompletionPrevious: number;
  estimateAtCompletionMovement: number;

  // Variance Fields
  costVariance: number;
  costVariancePrevious: number;
  costVarianceMovement: number;

  // Access Control
  assignedUsers?: string[]; // Array of user UIDs
}

export interface SavedView {
  id: string;
  name: string;
  tableId: string;
  columns: string[];
  gridState?: any; // For AG-Grid state
  userId: string;
  createdAt: string;
}

export interface EtcDetail {
  id: string;
  projectId: string;
  costCode: string;
  calendarId?: string;
  category?: string;
  item: string;
  description: string;
  orderNumber: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  qty: number;
  unit: string;
  rate: number;
  phasingMethod: 'Manual' | 'Auto-Phase';
  phasingStartDate: string;
  phasingEndDate: string;
  phasingUnit: 'Daily' | 'Weekly' | 'Monthly' | 'Total';
  phasingQty: number;
  enterpriseAttributes?: Record<string, string>;
  projectAttributes?: Record<string, string>;
  periodValues: Record<string, number>;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
  isEnterpriseResource?: boolean;
  resourceId?: string;
}

export interface Calendar {
  id: string;
  projectId?: string;
  enterpriseId?: string;
  name: string;
  weekends: number[];
  holidays: string[];
  createdAt: string;
}
