// Phase 13.B1.3 (SYSTEM_REVIEW.md v2 / PLAN.md): compute-on-read selector for
// CostCode financial roll-ups. Subscribes to the leaf collections a cost
// code's totals are derived from and recomputes live via
// domain/rollups.aggregateCostCodeRollups — no stored value, no
// "Recalculate" button. Replaces the ~130-line inline calculation in
// CostCodes.tsx's calculateCosts() (the sole live write path for these
// fields; the older handleRecalculateAll() was dead code and was removed).
//
// Every screen that currently reads CostCode.approvedBudget /
// actualCostToDate / estimateAtCompletion / costVariance (etc.) directly
// from the stored document should switch to this hook instead, so no two
// screens can ever disagree. The aggregation math itself lives in
// domain/rollups.ts (pure, unit-tested) — this file is intentionally thin:
// subscribe to leaves, hand them to the domain function, memoize.

import { useEffect, useMemo, useState } from 'react';
import type { ActualCostRecord, BaselineBudgetRecord, Change, ChangeRecord, CostCode, EtcDetail, Project, Subcontract } from '../domain/types';
import { aggregateCostCodeRollups, type CostCodeRollup } from '../domain/rollups';
import { useCostRepo, useChangeRepo, useSubcontractRepo } from '../platform/firestore/hooks';

/**
 * Live-subscribes to the leaf collections behind CostCode roll-ups and
 * returns a Map of costCodeId -> computed CostCodeRollup, recomputed
 * whenever any leaf or the cost codes themselves change.
 */
export function useCostCodeRollups(project: Project | null, costCodes: CostCode[]): Map<string, CostCodeRollup> {
  const costRepo = useCostRepo();
  const changeRepo = useChangeRepo();
  const subcontractRepo = useSubcontractRepo();

  const [actuals, setActuals] = useState<ActualCostRecord[]>([]);
  const [baselines, setBaselines] = useState<BaselineBudgetRecord[]>([]);
  const [etcRows, setEtcRows] = useState<EtcDetail[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);

  useEffect(() => {
    const projectId = project?.id;
    if (!projectId) {
      setActuals([]); setBaselines([]); setEtcRows([]); setChanges([]); setChangeRecords([]); setSubcontracts([]);
      return;
    }
    const unsubscribers = [
      costRepo.subscribeActualCosts(projectId, setActuals),
      costRepo.subscribeBaselineBudgets(projectId, setBaselines),
      costRepo.subscribeEtcDetails(projectId, setEtcRows),
      changeRepo.subscribeChanges(projectId, setChanges),
      changeRepo.subscribeChangeRecords(projectId, setChangeRecords),
      subcontractRepo.subscribeSubcontracts(projectId, setSubcontracts),
    ];
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [project?.id, costRepo, changeRepo, subcontractRepo]);

  return useMemo(() => {
    if (!project) return new Map<string, CostCodeRollup>();
    const allPeriods = project.reportingPeriods?.periods || [];
    return aggregateCostCodeRollups(
      costCodes,
      { actuals, baselines, etcRows, changes, changeRecords, subcontracts },
      { currentPeriodId: project.reportingPeriods?.currentPeriodId, periodIds: allPeriods.map((p) => p.id) },
    );
  }, [project, costCodes, actuals, baselines, etcRows, changes, changeRecords, subcontracts]);
}
