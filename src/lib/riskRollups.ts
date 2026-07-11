// Phase 13.B1.6 (SYSTEM_REVIEW.md v2 / PLAN.md): compute-on-read selector for
// Risk.exposure/minImpactTotal/mostLikelyImpactTotal/maxImpactTotal. Same
// pattern as useCostCodeRollups (costCodeRollups.ts) — thin hook, all the
// math lives in domain/risk.ts (aggregateRiskRollups, unit-tested).
// Replaces the identical updateParentTotals() duplicated in
// RiskManagement.tsx and BulkRiskRecords.tsx.

import { useEffect, useMemo, useState } from 'react';
import type { RiskRecord } from '../domain/types';
import { aggregateRiskRollups, type computeRiskRollup } from '../domain/risk';
import { useRiskRepo } from '../platform/firestore/hooks';
import type { Risk } from '../domain/types';

export function useRiskRollups(projectId: string | undefined, risks: Risk[]): Map<string, ReturnType<typeof computeRiskRollup>> {
  const riskRepo = useRiskRepo();
  const [riskRecords, setRiskRecords] = useState<RiskRecord[]>([]);

  useEffect(() => {
    if (!projectId) { setRiskRecords([]); return; }
    return riskRepo.subscribeRiskRecords(projectId, setRiskRecords);
  }, [projectId, riskRepo]);

  return useMemo(() => aggregateRiskRollups(risks, riskRecords), [risks, riskRecords]);
}
