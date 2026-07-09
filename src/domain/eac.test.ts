import { describe, it, expect } from 'vitest';
import {
  computeApprovedBudget,
  computeCostVariance,
  computeEacEtc,
  computeMovement,
  computePeriodEndFields,
} from './eac';

describe('computeApprovedBudget', () => {
  it('sums baseline and approved changes', () => {
    expect(computeApprovedBudget(550_000, 0)).toBe(550_000);
    expect(computeApprovedBudget(500_000, 50_000)).toBe(550_000);
    expect(computeApprovedBudget(0, 0)).toBe(0);
  });

  it('handles negative change orders (deductive changes)', () => {
    expect(computeApprovedBudget(600_000, -50_000)).toBe(550_000);
  });
});

describe('computeCostVariance', () => {
  it('returns positive value when under budget', () => {
    expect(computeCostVariance(550_000, 500_000)).toBe(50_000);
  });

  it('returns negative value when over budget', () => {
    expect(computeCostVariance(500_000, 550_000)).toBe(-50_000);
  });

  it('returns zero when on budget', () => {
    expect(computeCostVariance(500_000, 500_000)).toBe(0);
  });
});

describe('computeEacEtc', () => {
  it('ETC Details method: EAC = actuals + forecastEtc', () => {
    const { eac, etc } = computeEacEtc('ETC Details', 200_000, 300_000, 0);
    expect(eac).toBe(500_000);
    expect(etc).toBe(300_000);
  });

  it('Manual method: EAC is supplied; ETC is derived', () => {
    const { eac, etc } = computeEacEtc('Manual', 200_000, 0, 500_000);
    expect(eac).toBe(500_000);
    expect(etc).toBe(300_000);
  });

  it('Auto method behaves like Manual (EAC supplied)', () => {
    const { eac, etc } = computeEacEtc('Auto', 100_000, 0, 400_000);
    expect(eac).toBe(400_000);
    expect(etc).toBe(300_000);
  });

  it('ETC Details with zero actuals: EAC equals forecast ETC', () => {
    const { eac, etc } = computeEacEtc('ETC Details', 0, 500_000, 0);
    expect(eac).toBe(500_000);
    expect(etc).toBe(500_000);
  });
});

describe('computeMovement', () => {
  it('returns difference between current and previous', () => {
    expect(computeMovement(550_000, 500_000)).toBe(50_000);
    expect(computeMovement(400_000, 500_000)).toBe(-100_000);
    expect(computeMovement(0, 0)).toBe(0);
  });
});

describe('computePeriodEndFields', () => {
  it('computes all derived fields from leaves (Manual EAC method)', () => {
    const result = computePeriodEndFields({
      baselineBudget: 500_000,
      approvedChanges: 50_000,
      approvedBudgetPrev: 540_000,
      actualsToDate: 200_000,
      eacMethod: 'Manual',
      etcFromForecast: 0,
      manualEac: 500_000,
      eacPrev: 510_000,
      costVariancePrev: 30_000,
    });

    expect(result.approvedBudget).toBe(550_000);
    expect(result.approvedBudgetMovement).toBe(10_000);
    expect(result.eac).toBe(500_000);
    expect(result.etc).toBe(300_000);
    expect(result.eacMovement).toBe(-10_000);
    expect(result.costVariance).toBe(50_000);
    expect(result.costVarianceMovement).toBe(20_000);
  });

  it('computes all derived fields from leaves (ETC Details method)', () => {
    const result = computePeriodEndFields({
      baselineBudget: 500_000,
      approvedChanges: 0,
      approvedBudgetPrev: 500_000,
      actualsToDate: 150_000,
      eacMethod: 'ETC Details',
      etcFromForecast: 350_000,
      manualEac: 0,
      eacPrev: 500_000,
      costVariancePrev: 0,
    });

    expect(result.approvedBudget).toBe(500_000);
    expect(result.eac).toBe(500_000);
    expect(result.etc).toBe(350_000);
    expect(result.costVariance).toBe(0);
  });
});
