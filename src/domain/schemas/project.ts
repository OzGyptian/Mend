import { z } from 'zod';
import type {
  ForecastMethod,
  DistributionMethod,
  ProjectStatus,
  ProjectCostElement,
  Project,
  Sheet,
  ForecastRow,
  SavedView,
  UserProfile,
} from '../types';
import { ProjectAttributeSchema, ResourceRateSchema } from './enterprise';

export const ForecastMethodSchema = z.enum(['commitment', 'time-based']);

export const DistributionMethodSchema = z.enum([
  'manual',
  'even',
  'front',
  'back',
  'bell',
]);

export const ProjectStatusSchema = z.enum([
  'Active',
  'On Hold',
  'Closed',
  'Archived',
]);

export const ProjectCostElementSchema = z.object({
  id: z.string(),
  description: z.string(),
  sortCode: z.string(),
  enterpriseCostElementId: z.string().optional(),
});

const ProjectPeriodEntrySchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  name: z.string(),
  status: z.enum(['open', 'closed']),
});

const ProjectPeriodsConfigSchema = z.object({
  baseDate: z.string(),
  duration: z.enum(['week', 'month']),
  numberOfPeriods: z.number(),
  periods: z.array(ProjectPeriodEntrySchema),
  currentPeriodId: z.string().optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  enterpriseId: z.string(),
  projectName: z.string(),
  projectCode: z.string(),
  status: ProjectStatusSchema.optional(),
  projectBudget: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  cutoffDate: z.string(),
  users: z.record(z.string(), z.enum(['Project Admin', 'Project User'])),
  attributes: z.record(z.string(), z.string()).optional(),
  photoURL: z.string().optional(),
  scopeDescription: z.string().optional(),
  clientName: z.string().optional(),
  projectManagerName: z.string().optional(),
  dateCreated: z.string(),
  dateLastModified: z.string(),
  createdBy: z.string().optional(),
  createdByEmail: z.string().optional(),
  modifiedBy: z.string().optional(),
  modifiedByEmail: z.string().optional(),
  categories: z.array(z.string()).optional(),
  controlAccounts: z.array(z.string()).optional(),
  orderNumbers: z.array(z.string()).optional(),
  costElements: z.array(ProjectCostElementSchema).optional(),
  costCodeAttributes: z.array(ProjectAttributeSchema).optional(),
  subcontractAttributes: z.array(ProjectAttributeSchema).optional(),
  changeAttributes: z.array(ProjectAttributeSchema).optional(),
  riskAttributes: z.array(ProjectAttributeSchema).optional(),
  procurementAttributes: z.array(ProjectAttributeSchema).optional(),
  progressAttributes: z.array(ProjectAttributeSchema).optional(),
  procurementDefaults: z
    .object({
      calendarId: z.string().optional(),
      stepDurations: z.record(z.string(), z.number()).optional(),
      attributeValues: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  changeTypes: z.array(z.string()).optional(),
  riskTypes: z.array(z.string()).optional(),
  lineItemAttributes: z.array(ProjectAttributeSchema).optional(),
  resourceRates: z.array(ResourceRateSchema).optional(),
  reportingPeriods: ProjectPeriodsConfigSchema.optional(),
  progressPeriods: ProjectPeriodsConfigSchema.optional(),
  firstCostReportingMonth: z.string().optional(),
  currentReportingMonth: z.string().optional(),
  lastReportingMonth: z.string().optional(),
});

export const SheetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sheetName: z.string(),
  forecastMethod: ForecastMethodSchema,
  version: z.string(),
  lockedStatus: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  users: z.array(z.string()).optional(),
});

export const ForecastRowSchema = z.object({
  id: z.string(),
  sheetId: z.string(),
  costCode: z.string(),
  description: z.string(),
  vendor: z.string(),
  qty: z.number().optional(),
  rate: z.number().optional(),
  budget: z.number(),
  committedCost: z.number(),
  actualCostToDate: z.number(),
  costToGo: z.number(),
  eac: z.number(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timePhasing: z.record(z.string(), z.number()),
  distributionMethod: DistributionMethodSchema,
  enterpriseCostCodeAttributes: z.record(z.string(), z.string()).optional(),
  enterpriseLineItemAttributes: z.record(z.string(), z.string()).optional(),
  enterpriseSubcontractAttributes: z.record(z.string(), z.string()).optional(),
  enterpriseChangeAttributes: z.record(z.string(), z.string()).optional(),
  projectAttributes: z.record(z.string(), z.string()).optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export const SavedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  tableId: z.string(),
  columns: z.array(z.string()),
  gridState: z.any().optional(),
  userId: z.string(),
  createdAt: z.string(),
});

export const UserProfileSchema = z.object({
  uid: z.string(),
  email: z.string(),
  displayName: z.string(),
  photoURL: z.string().optional(),
});
