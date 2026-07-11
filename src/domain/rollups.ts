// Canonical roll-up formulas for parent documents whose totals are derived
// from child "leaf" records (Change <- ChangeRecord, CostCode <- actuals/
// budgets/etc/subcontracts). Phase 13.B1 (SYSTEM_REVIEW.md v2 / PLAN.md):
// these replace the duplicated updateParentTotals()/handleRecalculateAll()
// implementations scattered across components. Components call these at
// render time (compute-on-read) instead of writing the result back to
// Firestore and refreshing only on a manual "Recalculate" click.

import { computePeriodEndFields, type EacMethod } from './eac';

export interface ChangeRecordLeaf {
  budgetAmount: number;
  eacAmount: number;
}

/**
 * Roll up a Change's budget/eac totals from its ChangeRecord leaves.
 * Canonical replacement for the duplicated updateParentTotals in
 * ChangeManagement.tsx and BulkChangeRecords.tsx.
 */
export function computeChangeRollup(records: ChangeRecordLeaf[]): { budget: number; eac: number } {
  return records.reduce(
    (totals, r) => ({
      budget: totals.budget + (Number(r.budgetAmount) || 0),
      eac: totals.eac + (Number(r.eacAmount) || 0),
    }),
    { budget: 0, eac: 0 },
  );
}

export interface CostCodeLeafTotals {
  /** Sum of BaselineBudgetRecord.amount for this cost code. */
  baselineBudget: number;
  /** Sum of ChangeRecord.budgetAmount for approved changes assigned to this cost code. */
  budgetChanges: number;
  /** Sum of ChangeRecord.eacAmount for approved changes — only used by the 'Change Management' eacMethod. */
  eacApprovedChanges: number;
  /** Sum of ActualCostRecord.cost across all periods up to the reporting cutoff. */
  actualCostToDate: number;
  /** Sum of ActualCostRecord.cost for the current reporting period only. */
  actualCostThisPeriod: number;
  /** Sum of future-period EtcDetail qty x rate — only used by the 'ETC Details' eacMethod. */
  etcFromForecast: number;
  /** Sum of non-rejected subcontract line-item totals — only used by the 'Sub-Contract Management' eacMethod. */
  subcontractTotal: number;
}

/**
 * Resolves the EAC source value per eacMethod — the one place that decides
 * which leaf total becomes this cost code's estimate at completion.
 * 'ETC Details' is handled separately inside computeEacEtc (EAC is derived
 * from actuals + forecast, not supplied); every other method supplies EAC
 * directly, so this is the single dispatch point for "directly supplied".
 */
export function resolveEacSourceValue(
  eacMethod: EacMethod,
  leaves: CostCodeLeafTotals,
  storedManualEac: number,
): number {
  if (eacMethod === 'Change Management') return leaves.baselineBudget + leaves.eacApprovedChanges;
  if (eacMethod === 'Sub-Contract Management') return leaves.subcontractTotal;
  return storedManualEac; // 'Manual' and any other/default method — EAC is a direct user entry
}

export interface CostCodeRollup {
  baselineBudget: number;
  budgetChanges: number;
  approvedBudget: number;
  approvedBudgetMovement: number;
  actualCostToDate: number;
  actualCostThisPeriod: number;
  estimateToComplete: number;
  estimateAtCompletion: number;
  estimateAtCompletionMovement: number;
  costVariance: number;
  costVarianceMovement: number;
}

/**
 * Derive all CostCode roll-up fields from leaves in one call. This is the
 * single formula both the cost-codes grid (inline edits) and the bulk
 * "recalculate all" action must use — no parallel implementation. Delegates
 * the eac/etc/variance/movement math to computePeriodEndFields (eac.ts);
 * this function only resolves the method-specific EAC source value and
 * remaps field names to match the CostCode domain type.
 */
export function computeCostCodeRollup(params: {
  eacMethod: EacMethod;
  leaves: CostCodeLeafTotals;
  storedManualEac: number;
  approvedBudgetPrev: number;
  estimateAtCompletionPrev: number;
  costVariancePrev: number;
}): CostCodeRollup {
  const { leaves } = params;
  const manualEac = resolveEacSourceValue(params.eacMethod, leaves, params.storedManualEac);

  const fields = computePeriodEndFields({
    baselineBudget: leaves.baselineBudget,
    approvedChanges: leaves.budgetChanges,
    approvedBudgetPrev: params.approvedBudgetPrev,
    actualsToDate: leaves.actualCostToDate,
    eacMethod: params.eacMethod,
    etcFromForecast: leaves.etcFromForecast,
    manualEac,
    eacPrev: params.estimateAtCompletionPrev,
    costVariancePrev: params.costVariancePrev,
  });

  return {
    baselineBudget: leaves.baselineBudget,
    budgetChanges: leaves.budgetChanges,
    approvedBudget: fields.approvedBudget,
    approvedBudgetMovement: fields.approvedBudgetMovement,
    actualCostToDate: leaves.actualCostToDate,
    actualCostThisPeriod: leaves.actualCostThisPeriod,
    estimateToComplete: fields.etc,
    estimateAtCompletion: fields.eac,
    estimateAtCompletionMovement: fields.eacMovement,
    costVariance: fields.costVariance,
    costVarianceMovement: fields.costVarianceMovement,
  };
}
