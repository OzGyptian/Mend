// Canonical EAC / ETC / cost-variance formulas.
// All components that display or compute these values MUST call these functions;
// no duplicate implementations allowed.

export type EacMethod = 'Manual' | 'ETC Details' | 'Auto' | string;

/** Approved budget = baseline + approved change orders */
export function computeApprovedBudget(baselineBudget: number, approvedChanges: number): number {
  return baselineBudget + approvedChanges;
}

/** Cost variance = approved budget − EAC (positive = under-budget) */
export function computeCostVariance(approvedBudget: number, eac: number): number {
  return approvedBudget - eac;
}

/**
 * Derive EAC and ETC from leaves.
 * - ETC Details: EAC is calculated from leaves (actuals + forecast ETC).
 * - All other methods (Manual, Auto): EAC is supplied; ETC is derived.
 */
export function computeEacEtc(
  eacMethod: EacMethod,
  actualsToDate: number,
  etcFromForecast: number,
  manualEac: number,
): { eac: number; etc: number } {
  if (eacMethod === 'ETC Details') {
    const eac = actualsToDate + etcFromForecast;
    return { eac, etc: etcFromForecast };
  }
  const etc = manualEac - actualsToDate;
  return { eac: manualEac, etc };
}

/** Movement = current period value − prior period value */
export function computeMovement(current: number, previous: number): number {
  return current - previous;
}

/**
 * EAC and ETC for a single forecast-grid row.
 * commitment method: EAC = qty × rate (locked commitment value).
 * All other methods: EAC = actuals to date + cost to go.
 * ETC is always EAC − actuals, floored at 0.
 */
export function computeForecastRowEac(
  forecastMethod: string,
  qty: number,
  rate: number,
  actualCostToDate: number,
  costToGo: number,
): { eac: number; etc: number } {
  const eac = forecastMethod === 'commitment' ? qty * rate : actualCostToDate + costToGo;
  return { eac, etc: Math.max(0, eac - actualCostToDate) };
}

/**
 * Derive all period-end EAC fields from leaves in one call.
 * Used by the onCellValueChanged handler in CostCodes.
 */
export function computePeriodEndFields(params: {
  baselineBudget: number;
  approvedChanges: number;
  approvedBudgetPrev: number;
  actualsToDate: number;
  eacMethod: EacMethod;
  etcFromForecast: number;
  manualEac: number;
  eacPrev: number;
  costVariancePrev: number;
}): {
  approvedBudget: number;
  approvedBudgetMovement: number;
  eac: number;
  etc: number;
  eacMovement: number;
  costVariance: number;
  costVarianceMovement: number;
} {
  const approvedBudget = computeApprovedBudget(params.baselineBudget, params.approvedChanges);
  const approvedBudgetMovement = computeMovement(approvedBudget, params.approvedBudgetPrev);
  const { eac, etc } = computeEacEtc(
    params.eacMethod,
    params.actualsToDate,
    params.etcFromForecast,
    params.manualEac,
  );
  const eacMovement = computeMovement(eac, params.eacPrev);
  const costVariance = computeCostVariance(approvedBudget, eac);
  const costVarianceMovement = computeMovement(costVariance, params.costVariancePrev);
  return { approvedBudget, approvedBudgetMovement, eac, etc, eacMovement, costVariance, costVarianceMovement };
}
