import { describe, it, expect } from 'vitest';
import { computeChangeRollup, computeCostCodeRollup, resolveEacSourceValue, type CostCodeLeafTotals } from './rollups';

describe('computeChangeRollup', () => {
  it('returns zeroed totals for no records', () => {
    expect(computeChangeRollup([])).toEqual({ budget: 0, eac: 0 });
  });

  it('sums budgetAmount and eacAmount across records', () => {
    const records = [
      { budgetAmount: 1000, eacAmount: 1200 },
      { budgetAmount: 500, eacAmount: 400 },
    ];
    expect(computeChangeRollup(records)).toEqual({ budget: 1500, eac: 1600 });
  });

  it('treats missing/non-numeric fields as zero', () => {
    const records = [{ budgetAmount: undefined as unknown as number, eacAmount: 100 }];
    expect(computeChangeRollup(records)).toEqual({ budget: 0, eac: 100 });
  });
});

const baseLeaves: CostCodeLeafTotals = {
  baselineBudget: 500_000,
  budgetChanges: 50_000,
  eacApprovedChanges: 0,
  actualCostToDate: 300_000,
  actualCostThisPeriod: 40_000,
  etcFromForecast: 0,
  subcontractTotal: 0,
};

describe('resolveEacSourceValue', () => {
  it('Change Management: baseline + eac approved changes', () => {
    const leaves = { ...baseLeaves, eacApprovedChanges: 75_000 };
    expect(resolveEacSourceValue('Change Management', leaves, 999)).toBe(500_000 + 75_000);
  });

  it('Sub-Contract Management: subcontract total', () => {
    const leaves = { ...baseLeaves, subcontractTotal: 610_000 };
    expect(resolveEacSourceValue('Sub-Contract Management', leaves, 999)).toBe(610_000);
  });

  it('Manual (and any other/default method): stored manual EAC passthrough', () => {
    expect(resolveEacSourceValue('Manual', baseLeaves, 725_000)).toBe(725_000);
    expect(resolveEacSourceValue('anything-else', baseLeaves, 725_000)).toBe(725_000);
  });
});

describe('computeCostCodeRollup', () => {
  const prevPeriod = { approvedBudgetPrev: 0, estimateAtCompletionPrev: 0, costVariancePrev: 0 };

  it('ETC Details method: EAC = actuals + forecast ETC', () => {
    const leaves = { ...baseLeaves, etcFromForecast: 250_000 };
    const result = computeCostCodeRollup({
      eacMethod: 'ETC Details',
      leaves,
      storedManualEac: 0,
      ...prevPeriod,
    });
    expect(result.estimateToComplete).toBe(250_000);
    expect(result.estimateAtCompletion).toBe(300_000 + 250_000);
    expect(result.approvedBudget).toBe(550_000);
    expect(result.costVariance).toBe(550_000 - 550_000);
  });

  it('Change Management method: EAC = baseline + eac approved changes', () => {
    const leaves = { ...baseLeaves, eacApprovedChanges: 100_000 };
    const result = computeCostCodeRollup({
      eacMethod: 'Change Management',
      leaves,
      storedManualEac: 0,
      ...prevPeriod,
    });
    expect(result.estimateAtCompletion).toBe(500_000 + 100_000);
    expect(result.estimateToComplete).toBe(600_000 - 300_000);
  });

  it('Sub-Contract Management method: EAC = subcontract total', () => {
    const leaves = { ...baseLeaves, subcontractTotal: 620_000 };
    const result = computeCostCodeRollup({
      eacMethod: 'Sub-Contract Management',
      leaves,
      storedManualEac: 0,
      ...prevPeriod,
    });
    expect(result.estimateAtCompletion).toBe(620_000);
    expect(result.estimateToComplete).toBe(620_000 - 300_000);
  });

  it('Manual method: EAC = stored manual value, unaffected by other leaves', () => {
    const result = computeCostCodeRollup({
      eacMethod: 'Manual',
      leaves: baseLeaves,
      storedManualEac: 700_000,
      ...prevPeriod,
    });
    expect(result.estimateAtCompletion).toBe(700_000);
    expect(result.estimateToComplete).toBe(700_000 - 300_000);
  });

  it('computes movements against prior-period values', () => {
    const result = computeCostCodeRollup({
      eacMethod: 'Manual',
      leaves: baseLeaves,
      storedManualEac: 700_000,
      approvedBudgetPrev: 500_000,
      estimateAtCompletionPrev: 650_000,
      costVariancePrev: -100_000,
    });
    expect(result.approvedBudgetMovement).toBe(550_000 - 500_000);
    expect(result.estimateAtCompletionMovement).toBe(700_000 - 650_000);
    expect(result.costVarianceMovement).toBe(result.costVariance - -100_000);
  });

  it('passes through baselineBudget/budgetChanges/actualCostToDate/actualCostThisPeriod unchanged', () => {
    const result = computeCostCodeRollup({
      eacMethod: 'Manual',
      leaves: baseLeaves,
      storedManualEac: 700_000,
      ...prevPeriod,
    });
    expect(result.baselineBudget).toBe(baseLeaves.baselineBudget);
    expect(result.budgetChanges).toBe(baseLeaves.budgetChanges);
    expect(result.actualCostToDate).toBe(baseLeaves.actualCostToDate);
    expect(result.actualCostThisPeriod).toBe(baseLeaves.actualCostThisPeriod);
  });
});
