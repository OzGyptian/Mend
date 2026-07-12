import React, { createContext, useContext, useMemo } from 'react';
import { EnterpriseAdapter } from './adapters/EnterpriseAdapter';
import { ProjectAdapter } from './adapters/ProjectAdapter';
import { CostAdapter } from './adapters/CostAdapter';
import { ChangeAdapter } from './adapters/ChangeAdapter';
import { RiskAdapter } from './adapters/RiskAdapter';
import { SubcontractAdapter } from './adapters/SubcontractAdapter';
import { ProgressAdapter } from './adapters/ProgressAdapter';
import { ProcurementAdapter } from './adapters/ProcurementAdapter';
import { ScheduleAdapter } from './adapters/ScheduleAdapter';
import { UtilityAdapter } from './adapters/UtilityAdapter';
import { AuthAdapter } from './adapters/AuthAdapter';
import { UserRoleAdapter } from './adapters/UserRoleAdapter';
import { PostgresEnterpriseAdapter } from '../supabase/adapters/EnterpriseAdapter';
import { PostgresProjectAdapter } from '../supabase/adapters/ProjectAdapter';
import { PostgresCostAdapter } from '../supabase/adapters/CostAdapter';
import { PostgresChangeAdapter } from '../supabase/adapters/ChangeAdapter';
import { PostgresRiskAdapter } from '../supabase/adapters/RiskAdapter';
import { PostgresSubcontractAdapter } from '../supabase/adapters/SubcontractAdapter';
import { PostgresProgressAdapter } from '../supabase/adapters/ProgressAdapter';
import { PostgresProcurementAdapter } from '../supabase/adapters/ProcurementAdapter';
import { PostgresScheduleAdapter } from '../supabase/adapters/ScheduleAdapter';
import { PostgresUtilityAdapter } from '../supabase/adapters/UtilityAdapter';
import { PostgresAuthAdapter } from '../supabase/adapters/AuthAdapter';
import { PostgresUserRoleAdapter } from '../supabase/adapters/UserRoleAdapter';
import {
  MemoryAuthAdapter, MemoryEnterpriseAdapter, MemoryProjectAdapter,
  MemoryCostAdapter, MemoryChangeAdapter, MemoryRiskAdapter,
  MemorySubcontractAdapter, MemoryProgressAdapter, MemoryProcurementAdapter,
  MemoryScheduleAdapter, MemoryUtilityAdapter, MemoryUserRoleAdapter,
  seedMemory,
} from '../memory/MemoryAdapters';
import type { EnterpriseRepository } from '../ports/enterprise.port';
import type { ProjectRepository } from '../ports/project.port';
import type { CostRepository } from '../ports/cost.port';
import type { ChangeRepository } from '../ports/change.port';
import type { RiskRepository } from '../ports/risk.port';
import type { SubcontractRepository } from '../ports/subcontract.port';
import type { ProgressRepository } from '../ports/progress.port';
import type { ProcurementRepository } from '../ports/procurement.port';
import type { ScheduleRepository } from '../ports/schedule.port';
import type { UtilityRepository } from '../ports/utility.port';
import type { AuthRepository } from '../ports/auth.port';
import type { UserRoleRepository } from '../ports/userRole.port';

interface Platform {
  enterprise: EnterpriseRepository;
  project: ProjectRepository;
  cost: CostRepository;
  change: ChangeRepository;
  risk: RiskRepository;
  subcontract: SubcontractRepository;
  progress: ProgressRepository;
  procurement: ProcurementRepository;
  schedule: ScheduleRepository;
  utility: UtilityRepository;
  auth: AuthRepository;
  userRole: UserRoleRepository;
}

const PlatformContext = createContext<Platform | null>(null);

const VITE_ADAPTER = (import.meta as any).env?.VITE_ADAPTER;
const USE_MEMORY = VITE_ADAPTER === 'memory';
const USE_POSTGRES = VITE_ADAPTER === 'postgres';

// Populate deterministic demo fixtures once when running on the memory adapter
// (local dev + E2E characterization tests). Idempotent.
if (USE_MEMORY) seedMemory();

function buildPlatform(): Platform {
  if (USE_MEMORY) {
    return {
      enterprise: new MemoryEnterpriseAdapter(),
      project: new MemoryProjectAdapter(),
      cost: new MemoryCostAdapter(),
      change: new MemoryChangeAdapter(),
      risk: new MemoryRiskAdapter(),
      subcontract: new MemorySubcontractAdapter(),
      progress: new MemoryProgressAdapter(),
      procurement: new MemoryProcurementAdapter(),
      schedule: new MemoryScheduleAdapter(),
      utility: new MemoryUtilityAdapter(),
      auth: new MemoryAuthAdapter(),
      userRole: new MemoryUserRoleAdapter(),
    } as unknown as Platform;
  }
  if (USE_POSTGRES) {
    return {
      enterprise: new PostgresEnterpriseAdapter(),
      project: new PostgresProjectAdapter(),
      cost: new PostgresCostAdapter(),
      change: new PostgresChangeAdapter(),
      risk: new PostgresRiskAdapter(),
      subcontract: new PostgresSubcontractAdapter(),
      progress: new PostgresProgressAdapter(),
      procurement: new PostgresProcurementAdapter(),
      schedule: new PostgresScheduleAdapter(),
      utility: new PostgresUtilityAdapter(),
      auth: new PostgresAuthAdapter(),
      userRole: new PostgresUserRoleAdapter(),
    };
  }
  return {
    enterprise: new EnterpriseAdapter(),
    project: new ProjectAdapter(),
    cost: new CostAdapter(),
    change: new ChangeAdapter(),
    risk: new RiskAdapter(),
    subcontract: new SubcontractAdapter(),
    progress: new ProgressAdapter(),
    procurement: new ProcurementAdapter(),
    schedule: new ScheduleAdapter(),
    utility: new UtilityAdapter(),
    auth: new AuthAdapter(),
    userRole: new UserRoleAdapter(),
  };
}

export function FirestoreProvider({ children }: { children: React.ReactNode }) {
  const platform = useMemo<Platform>(() => buildPlatform(), []);

  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): Platform {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within <FirestoreProvider>');
  return ctx;
}
