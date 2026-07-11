import { z } from 'zod';
import type {
  ProgressPackage,
  ProgressItem,
  ProgressReportingPeriod,
  ProgressAttribute,
  RuleOfCredit,
  RuleOfCreditStep,
} from '../types';

const PhasingCurveSchema = z.enum(['Scurve', 'Bell', 'front load', 'back load', 'even']);

export const RuleOfCreditStepSchema = z.object({
  id: z.string(),
  orderNo: z.number(),
  description: z.string(),
  weight: z.number(),
});

export const RuleOfCreditSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  ruleId: z.string(),
  description: z.string(),
  packageId: z.string().optional(),
  userField1: z.string().optional(),
  userField2: z.string().optional(),
  userField3: z.string().optional(),
  userField4: z.string().optional(),
  userField5: z.string().optional(),
  steps: z.array(RuleOfCreditStepSchema).optional(),
  createdAt: z.string(),
});

export const ProgressPackageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  packageId: z.string(),
  description: z.string(),
  ruleOfCreditId: z.string().optional(),
  unit: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  defaultStartDate: z.string().optional(),
  defaultEndDate: z.string().optional(),
  defaultPhasingMethod: z.enum(['Auto', 'Manual']).optional(),
  defaultPhasingCurve: PhasingCurveSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProgressItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  packageId: z.string(),
  packageDocId: z.string(),
  itemId: z.string(),
  activityId: z.string().optional(),
  description: z.string(),
  costCodeId: z.string(),
  totalQty: z.number(),
  totalQtyPrevious: z.number().optional(),
  earnedQtyPrevious: z.number().optional(),
  plannedStartDate: z.string(),
  plannedEndDate: z.string(),
  phasingMethod: z.enum(['Auto', 'Manual']),
  phasingCurve: PhasingCurveSchema,
  projectAttributes: z.record(z.string(), z.string()).optional(),
  enterpriseAttributes: z.record(z.string(), z.string()).optional(),
  ruleOfCreditId: z.string().optional(),
  ruleOfCreditProgress: z.record(z.string(), z.number()).optional(),
  periodValues: z.record(z.string(), z.number()).optional(),
  currentStartDate: z.string().optional(),
  currentEndDate: z.string().optional(),
  currentPhasingMethod: z.enum(['Auto', 'Manual']).optional(),
  currentPhasingCurve: PhasingCurveSchema.optional(),
  currentPeriodValues: z.record(z.string(), z.number()).optional(),
  actualPeriodValues: z.record(z.string(), z.number()).optional(),
  sortOrder: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProgressReportingPeriodSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  periodName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['Open', 'Closed']),
  createdAt: z.string(),
});

const ProgressAttributeValueSchema = z.object({
  id: z.string(),
  description: z.string(),
});

export const ProgressAttributeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  type: z.enum(['text', 'dropdown', 'date', 'number']),
  values: z.array(ProgressAttributeValueSchema).optional(),
});
