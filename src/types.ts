export type ForecastMethod = 'commitment' | 'time-based';
export type DistributionMethod = 'manual' | 'even' | 'front' | 'back' | 'bell';

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

export interface Enterprise {
  id: string;
  enterpriseId: string;
  name: string;
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
  resourceRates?: ResourceRate[];
  categories?: string[];
  controlAccounts?: string[];
  orderNumbers?: string[];
}

export interface Project {
  id: string;
  enterpriseId: string;
  projectName: string;
  projectCode: string;
  projectBudget: number;
  startDate: string;
  endDate: string;
  cutoffDate: string;
  users: Record<string, 'Project Admin' | 'Project User'>;
  attributes?: Record<string, string>;
  photoURL?: string;
  dateCreated: string;
  dateLastModified: string;
  categories?: string[];
  controlAccounts?: string[];
  orderNumbers?: string[];
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

export interface SavedView {
  id: string;
  name: string;
  tableId: string;
  columns: string[];
  userId: string;
  createdAt: string;
}
