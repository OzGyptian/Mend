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
}

const PlatformContext = createContext<Platform | null>(null);

export function FirestoreProvider({ children }: { children: React.ReactNode }) {
  const platform = useMemo<Platform>(() => ({
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
  }), []);

  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): Platform {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within <FirestoreProvider>');
  return ctx;
}
