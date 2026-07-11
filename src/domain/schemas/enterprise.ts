import { z } from 'zod';
import type {
  ProjectAttributeValue,
  ProjectAttribute,
  ResourceRate,
  CostElement,
  Vendor,
  Enterprise,
} from '../types';

export const ProjectAttributeValueSchema = z.object({
  id: z.string(),
  description: z.string(),
  sortOrder: z.number(),
});

export const ProjectAttributeSchema = z.object({
  id: z.string(),
  title: z.string(),
  values: z.array(ProjectAttributeValueSchema),
});

export const ResourceRateSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  rate: z.number().optional(),
  category: z.string().optional(),
  udf1: z.string().optional(),
  udf2: z.string().optional(),
  udf3: z.string().optional(),
});

export const CostElementSchema = z.object({
  id: z.string(),
  description: z.string(),
  sortCode: z.string(),
});

export const VendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
  contactEmail: z.string().optional(),
  contactName: z.string().optional(),
});

const EnterpriseUserEntrySchema = z.object({
  email: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
  joinedDate: z.string().optional(),
  joinedAt: z.string().optional(),
  role: z.enum(['Enterprise System Admin', 'Enterprise User']),
});

export const EnterpriseSchema = z.object({
  id: z.string(),
  enterpriseId: z.string(),
  name: z.string(),
  logoURL: z.string().optional(),
  adminUsers: z.array(z.string()),
  createdAt: z.string(),
  theme: z.enum(['light', 'dark']).optional(),
  users: z.record(z.string(), EnterpriseUserEntrySchema).optional(),
  projectAttributes: z.array(ProjectAttributeSchema).optional(),
  lineItemAttributes: z.array(ProjectAttributeSchema).optional(),
  costCodeAttributes: z.array(ProjectAttributeSchema).optional(),
  subcontractAttributes: z.array(ProjectAttributeSchema).optional(),
  changeAttributes: z.array(ProjectAttributeSchema).optional(),
  riskAttributes: z.array(ProjectAttributeSchema).optional(),
  procurementAttributes: z.array(ProjectAttributeSchema).optional(),
  progressAttributes: z.array(ProjectAttributeSchema).optional(),
  changeTypes: z.array(z.string()).optional(),
  riskTypes: z.array(z.string()).optional(),
  resourceRates: z.array(ResourceRateSchema).optional(),
  costElements: z.array(CostElementSchema).optional(),
  categories: z.array(z.string()).optional(),
  controlAccounts: z.array(z.string()).optional(),
  orderNumbers: z.array(z.string()).optional(),
  vendors: z.array(VendorSchema).optional(),
});
