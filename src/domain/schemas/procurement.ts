import { z } from 'zod';
import type {
  ProcurementStepDefinition,
  ProcurementStepData,
  ProcurementItem,
  Calendar,
  ScheduleItem,
} from '../types';

export const ProcurementStepDefinitionSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  enterpriseId: z.string().optional(),
  name: z.string(),
  order: z.number(),
  isEnterpriseStandard: z.boolean().optional(),
  defaultDurationDays: z.number().optional(),
  enterpriseStepId: z.string().optional(),
});

export const ProcurementStepDataSchema = z.object({
  plannedDate: z.string().optional(),
  actualDate: z.string().optional(),
  forecastDate: z.string().optional(),
  planDuration: z.number().optional(),
  forecastDuration: z.number().optional(),
});

export const ProcurementItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  packageId: z.string(),
  description: z.string(),
  calendarId: z.string().optional(),
  category: z.string().optional(),
  enterpriseAttributes: z.record(z.string(), z.string()).optional(),
  projectAttributes: z.record(z.string(), z.string()).optional(),
  stepData: z.record(z.string(), ProcurementStepDataSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CalendarSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  enterpriseId: z.string().optional(),
  name: z.string(),
  weekends: z.array(z.number()),
  holidays: z.array(z.string()),
  createdAt: z.string(),
});

export const ScheduleItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  activityId: z.string(),
  description: z.string(),
  activityPercentComplete: z.number(),
  baselineStartDate: z.string(),
  baselineEndDate: z.string(),
  plannedStartDate: z.string(),
  plannedEndDate: z.string(),
  currentStartDate: z.string(),
  currentEndDate: z.string(),
  updatedAt: z.string(),
});
