// Canonical roll-up formulas for parent documents whose totals are derived
// from child "leaf" records (Change <- ChangeRecord, CostCode <- actuals/
// budgets/etc/subcontracts). Phase 13.B1 (SYSTEM_REVIEW.md v2 / PLAN.md):
// these replace the duplicated updateParentTotals()/handleRecalculateAll()
// implementations scattered across components. Components call these at
// render time (compute-on-read) instead of writing the result back to
// Firestore and refreshing only on a manual "Recalculate" click.

import { computePeriodEndFields, type EacMethod } from './eac';
import type { ActualCostRecord, BaselineBudgetRecord, Change, ChangeRecord, CostCode, EtcDetail, Subcontract } from './types';

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

export interface CostCodeRollupLeafSets {
  actuals: ActualCostRecord[];
  baselines: BaselineBudgetRecord[];
  etcRows: EtcDetail[];
  changes: Change[];
  changeRecords: ChangeRecord[];
  subcontracts: Subcontract[];
}

export interface ReportingPeriodContext {
  currentPeriodId?: string;
  /** Ordered list of all period ids for the project (any order is fine — only the position of currentPeriodId matters). */
  periodIds: string[];
}

function addTo(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) || 0) + amount);
}

// Mirrors the id-OR-code reconciliation fallback used throughout the app
// (see SYSTEM_REVIEW.md F5 — an ambiguous foreign key scheduled for a real
// fix in Phase 13.B2). Must match that fallback until F5 lands, or this will
// disagree with write paths elsewhere that still use it.
function sumByIdOrCode(map: Map<string, number>, id: string, code: string): number {
  return (map.get(id) || 0) + (map.get(code) || 0);
}

/**
 * Aggregates raw leaf collections into a Map<costCodeId, CostCodeRollup> —
 * pure, no I/O, no React. This is what changes if the leaf-selection rules
 * change (e.g. which change statuses count); the React hook that wires it to
 * live Firestore subscriptions (src/lib/costCodeRollups.ts) never needs to.
 */
export function aggregateCostCodeRollups(
  costCodes: CostCode[],
  leaves: CostCodeRollupLeafSets,
  period: ReportingPeriodContext,
): Map<string, CostCodeRollup> {
  const currentIndex = period.periodIds.findIndex((id) => id === period.currentPeriodId);
  const futurePeriodIds = new Set(period.periodIds.slice(currentIndex + 1));

  // Approved (or still-pending, forward-looking) changes count toward both
  // the approved budget and the EAC-forecast change totals.
  const countableChangeIds = new Set(
    leaves.changes.filter((c) => c.status === 'Approved' || c.status === 'Pending').map((c) => c.id),
  );

  const actualsToDateMap = new Map<string, number>();
  const actualsThisPeriodMap = new Map<string, number>();
  leaves.actuals.forEach((a) => {
    const cost = Number(a.cost) || 0;
    addTo(actualsToDateMap, a.costCodeId, cost);
    if (a.reportingPeriodId === period.currentPeriodId) addTo(actualsThisPeriodMap, a.costCodeId, cost);
  });

  const baselineMap = new Map<string, number>();
  leaves.baselines.forEach((b) => addTo(baselineMap, b.costCodeId, Number(b.amount) || 0));

  const budgetChangeMap = new Map<string, number>();
  const eacChangeMap = new Map<string, number>();
  leaves.changeRecords.forEach((r) => {
    if (!countableChangeIds.has(r.changeId)) return;
    addTo(budgetChangeMap, r.costCodeId, Number(r.budgetAmount) || 0);
    addTo(eacChangeMap, r.costCodeId, Number(r.eacAmount) || 0);
  });

  // EtcDetail keys by costCode (the code string), not costCodeId.
  const etcMap = new Map<string, number>();
  leaves.etcRows.forEach((r) => {
    const periodValues = r.periodValues || {};
    const futureQty = Object.entries(periodValues)
      .filter(([periodId]) => futurePeriodIds.has(periodId))
      .reduce((sum, [, qty]) => sum + (qty || 0), 0);
    addTo(etcMap, r.costCode, futureQty * (Number(r.rate) || 0));
  });

  const subcontractTotalMap = new Map<string, number>();
  leaves.subcontracts.forEach((sub) => {
    (sub.lineItems || []).forEach((li) => {
      if (li.status === 'Rejected') return;
      const assignedId = li.costCodeId || sub.defaultCostCodeId;
      if (assignedId) addTo(subcontractTotalMap, assignedId, Number(li.total) || 0);
    });
  });

  const rollups = new Map<string, CostCodeRollup>();
  for (const code of costCodes) {
    const codeLeaves: CostCodeLeafTotals = {
      baselineBudget: sumByIdOrCode(baselineMap, code.id, code.code),
      budgetChanges: sumByIdOrCode(budgetChangeMap, code.id, code.code),
      eacApprovedChanges: sumByIdOrCode(eacChangeMap, code.id, code.code),
      actualCostToDate: sumByIdOrCode(actualsToDateMap, code.id, code.code),
      actualCostThisPeriod: sumByIdOrCode(actualsThisPeriodMap, code.id, code.code),
      etcFromForecast: sumByIdOrCode(etcMap, code.id, code.code),
      subcontractTotal: sumByIdOrCode(subcontractTotalMap, code.id, code.code),
    };

    rollups.set(code.id, computeCostCodeRollup({
      eacMethod: code.eacMethod || 'Manual',
      leaves: codeLeaves,
      storedManualEac: Number(code.estimateAtCompletion) || 0,
      approvedBudgetPrev: Number(code.approvedBudgetPrevious) || 0,
      estimateAtCompletionPrev: Number(code.estimateAtCompletionPrevious) || 0,
      costVariancePrev: Number(code.costVariancePrevious) || 0,
    }));
  }
  return rollups;
}
