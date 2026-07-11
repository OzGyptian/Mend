import { z } from 'zod';
import type { Change, ChangeRecord } from '../types';

export const ChangeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  changeId: z.string(),
  description: z.string(),
  type: z.string(),
  status: z.enum(['Approved', 'Pending', 'Rejected', 'Withdrawn']),
  initiator: z.string(),
  reference: z.string(),
  budget: z.number(),
  eac: z.number(),
  periodId: z.string().optional(),
  enterpriseAttributes: z.record(z.string(), z.string()).optional(),
  projectAttributes: z.record(z.string(), z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ChangeRecordSchema = z.object({
  id: z.string(),
  changeId: z.string(),
  projectId: z.string(),
  costCodeId: z.string(),
  scope: z.string(),
  enterpriseAttributes: z.record(z.string(), z.string()),
  projectAttributes: z.record(z.string(), z.string()),
  budgetAmount: z.number(),
  eacAmount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
