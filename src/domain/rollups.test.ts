import { describe, it, expect } from 'vitest';
import {
  aggregateChangeRollups, aggregateCostCodeRollups, computeChangeRollup, computeCostCodeRollup, resolveEacSourceValue,
  type CostCodeLeafTotals,
} from './rollups';
import type {
  ActualCostRecord, BaselineBudgetRecord, Change, ChangeRecord, CostCode, EtcDetail, Subcontract,
} from './types';

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

function costCode(overrides: Partial<CostCode>): CostCode {
  return {
    id: overrides.id || 'cc1',
    code: overrides.code || 'C1',
    eacMethod: 'Manual',
    estimateAtCompletion: 0,
    approvedBudgetPrevious: 0,
    estimateAtCompletionPrevious: 0,
    costVariancePrevious: 0,
    ...overrides,
  } as unknown as CostCode;
}

describe('aggregateCostCodeRollups', () => {
  const period = { currentPeriodId: 'p2', periodIds: ['p1', 'p2', 'p3'] };

  it('sums baseline budgets and actuals for a matching costCodeId', () => {
    const codes = [costCode({ id: 'cc1', code: 'C1' })];
    const baselines = [
      { costCodeId: 'cc1', amount: 500_000 },
      { costCodeId: 'cc1', amount: 50_000 },
    ] as unknown as BaselineBudgetRecord[];
    const actuals = [
      { costCodeId: 'cc1', cost: 200_000, reportingPeriodId: 'p1' },
      { costCodeId: 'cc1', cost: 40_000, reportingPeriodId: 'p2' },
    ] as unknown as ActualCostRecord[];

    const result = aggregateCostCodeRollups(
      codes,
      { actuals, baselines, etcRows: [], changes: [], changeRecords: [], subcontracts: [] },
      period,
    );

    const rollup = result.get('cc1')!;
    expect(rollup.baselineBudget).toBe(550_000);
    expect(rollup.actualCostToDate).toBe(240_000);
    expect(rollup.actualCostThisPeriod).toBe(40_000); // only the current-period (p2) record
  });

  it('falls back to matching by code when costCodeId is the human code (F5 fallback)', () => {
    const codes = [costCode({ id: 'cc1', code: 'C1' })];
    const baselines = [{ costCodeId: 'C1', amount: 100_000 }] as unknown as BaselineBudgetRecord[];

    const result = aggregateCostCodeRollups(
      codes,
      { actuals: [], baselines, etcRows: [], changes: [], changeRecords: [], subcontracts: [] },
      period,
    );
    expect(result.get('cc1')!.baselineBudget).toBe(100_000);
  });

  it('only counts change records for Approved or Pending changes', () => {
    const codes = [costCode({ id: 'cc1', code: 'C1' })];
    const changes = [
      { id: 'chg-approved', status: 'Approved' },
      { id: 'chg-pending', status: 'Pending' },
      { id: 'chg-rejected', status: 'Rejected' },
    ] as unknown as Change[];
    const changeRecords = [
      { changeId: 'chg-approved', costCodeId: 'cc1', budgetAmount: 1000, eacAmount: 1100 },
      { changeId: 'chg-pending', costCodeId: 'cc1', budgetAmount: 2000, eacAmount: 2200 },
      { changeId: 'chg-rejected', costCodeId: 'cc1', budgetAmount: 5000, eacAmount: 5000 },
    ] as unknown as ChangeRecord[];

    const result = aggregateCostCodeRollups(
      codes,
      { actuals: [], baselines: [], etcRows: [], changes, changeRecords, subcontracts: [] },
      period,
    );
    expect(result.get('cc1')!.budgetChanges).toBe(3000); // approved + pending only, not rejected
  });

  it('ETC Details: only sums EtcDetail qty for future periods, keyed by costCode string', () => {
    const codes = [costCode({ id: 'cc1', code: 'C1', eacMethod: 'ETC Details' as CostCode['eacMethod'] })];
    const etcRows = [
      { costCode: 'C1', rate: 10, periodValues: { p1: 5, p2: 5, p3: 20 } }, // p1/p2 are past/current, p3 is future
    ] as unknown as EtcDetail[];
    const actuals = [{ costCodeId: 'cc1', cost: 100, reportingPeriodId: 'p1' }] as unknown as ActualCostRecord[];

    const result = aggregateCostCodeRollups(
      codes,
      { actuals, baselines: [], etcRows, changes: [], changeRecords: [], subcontracts: [] },
      period,
    );
    const rollup = result.get('cc1')!;
    expect(rollup.estimateToComplete).toBe(20 * 10); // only p3 (future) counted
    expect(rollup.estimateAtCompletion).toBe(100 + 200);
  });

  it('Sub-Contract Management: excludes Rejected line items, uses defaultCostCodeId fallback', () => {
    const codes = [costCode({ id: 'cc1', code: 'C1', eacMethod: 'Sub-Contract Management' as CostCode['eacMethod'] })];
    const subcontracts = [
      {
        defaultCostCodeId: 'cc1',
        lineItems: [
          { costCodeId: 'cc1', total: 300_000, status: 'Approved' },
          { costCodeId: '', total: 999_999, status: 'Rejected' },
          { total: 50_000, status: 'Approved' }, // no costCodeId -> falls back to defaultCostCodeId
        ],
      },
    ] as unknown as Subcontract[];

    const result = aggregateCostCodeRollups(
      codes,
      { actuals: [], baselines: [], etcRows: [], changes: [], changeRecords: [], subcontracts },
      period,
    );
    expect(result.get('cc1')!.estimateAtCompletion).toBe(350_000);
  });

  it('returns an empty map for no cost codes', () => {
    const result = aggregateCostCodeRollups(
      [],
      { actuals: [], baselines: [], etcRows: [], changes: [], changeRecords: [], subcontracts: [] },
      period,
    );
    expect(result.size).toBe(0);
  });
});

describe('aggregateChangeRollups', () => {
  const changes = [{ id: 'chg-1' }, { id: 'chg-2' }] as unknown as Change[];

  it('groups records by changeId and computes each change independently', () => {
    const records = [
      { changeId: 'chg-1', budgetAmount: 1000, eacAmount: 1200 },
      { changeId: 'chg-1', budgetAmount: 500, eacAmount: 400 },
      { changeId: 'chg-2', budgetAmount: 50, eacAmount: 50 },
    ] as unknown as ChangeRecord[];

    const result = aggregateChangeRollups(changes, records);
    expect(result.get('chg-1')).toEqual({ budget: 1500, eac: 1600 });
    expect(result.get('chg-2')).toEqual({ budget: 50, eac: 50 });
  });

  it('returns zeroed totals for a change with no records', () => {
    const result = aggregateChangeRollups(changes, []);
    expect(result.get('chg-1')).toEqual({ budget: 0, eac: 0 });
    expect(result.get('chg-2')).toEqual({ budget: 0, eac: 0 });
  });
});
