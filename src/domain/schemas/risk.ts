import { z } from 'zod';
import type { Risk, RiskRecord } from '../types';

export const RiskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  riskId: z.string(),
  description: z.string(),
  type: z.string(),
  status: z.enum(['Open', 'Mitigated', 'Closed', 'Realized']),
  strategy: z.enum(['Avoid', 'Mitigate', 'Transfer', 'Accept']),
  initiator: z.string(),
  reference: z.string(),
  exposure: z.number(),
  minImpactTotal: z.number().optional(),
  mostLikelyImpactTotal: z.number().optional(),
  maxImpactTotal: z.number().optional(),
  mitigation: z.number(),
  residualExposure: z.number(),
  periodId: z.string().optional(),
  enterpriseAttributes: z.record(z.string(), z.string()).optional(),
  projectAttributes: z.record(z.string(), z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RiskRecordSchema = z.object({
  id: z.string(),
  riskId: z.string(),
  projectId: z.string(),
  costCodeId: z.string(),
  scope: z.string(),
  enterpriseAttributes: z.record(z.string(), z.string()),
  projectAttributes: z.record(z.string(), z.string()),
  probability: z.number(),
  minImpactAmount: z.number(),
  mostLikelyImpactAmount: z.number(),
  maxImpactAmount: z.number(),
  betaPertImpactAmount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
