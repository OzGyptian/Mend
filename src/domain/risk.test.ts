import { describe, it, expect } from 'vitest';
import { betaPertImpact, betaPertExposure, computeRiskRollup, aggregateRiskRollups, computeExposureForModel, validateModelInputs } from './risk';
import type { Risk, RiskRecord } from './types';

describe('computeExposureForModel', () => {
  it('computes beta_pert_3point exposure from model_inputs + probability', () => {
    const result = computeExposureForModel('beta_pert_3point', { min: 10, mostLikely: 50, max: 90 }, 0.4);
    expect(result).toBeCloseTo(betaPertExposure(10, 50, 90, 0.4));
  });

  it('throws for an unrecognized risk model rather than silently defaulting to 0', () => {
    expect(() => computeExposureForModel('monte_carlo_p90', { p90: 1000 }, 0.5)).toThrow(/Unknown risk model/);
  });

  it('throws when model_inputs do not match the model\'s expected shape', () => {
    expect(() => computeExposureForModel('beta_pert_3point', { likelihood: 4 }, 0.5)).toThrow();
  });
});

describe('validateModelInputs', () => {
  it('parses valid beta_pert_3point inputs', () => {
    expect(validateModelInputs('beta_pert_3point', { min: 1, mostLikely: 2, max: 3 })).toEqual({ min: 1, mostLikely: 2, max: 3 });
  });
});

describe('betaPertImpact', () => {
  it('computes (min + 4×mostLikely + max) / 6', () => {
    expect(betaPertImpact(10, 50, 90)).toBeCloseTo(50);
  });

  it('is symmetric around the most likely value', () => {
    expect(betaPertImpact(0, 100, 200)).toBeCloseTo(100);
  });

  it('returns min when all three inputs are equal', () => {
    expect(betaPertImpact(75, 75, 75)).toBeCloseTo(75);
  });

  it('returns 0 when all inputs are 0', () => {
    expect(betaPertImpact(0, 0, 0)).toBe(0);
  });

  it('weights the most likely value 4× relative to extremes', () => {
    // min=0, ml=60, max=120 → (0 + 240 + 120) / 6 = 360 / 6 = 60
    expect(betaPertImpact(0, 60, 120)).toBeCloseTo(60);
    // min=0, ml=0, max=120 → (0 + 0 + 120) / 6 = 20
    expect(betaPertImpact(0, 0, 120)).toBeCloseTo(20);
  });
});

describe('betaPertExposure', () => {
  it('multiplies betaPert impact by probability', () => {
    // betaPertImpact(10, 50, 90) = 50; × 0.4 = 20
    expect(betaPertExposure(10, 50, 90, 0.4)).toBeCloseTo(20);
  });

  it('returns zero when probability is zero', () => {
    expect(betaPertExposure(10, 50, 90, 0)).toBe(0);
  });

  it('equals betaPertImpact when probability is 1', () => {
    expect(betaPertExposure(100, 200, 300, 1)).toBeCloseTo(betaPertImpact(100, 200, 300));
  });
});

describe('computeRiskRollup', () => {
  it('returns zeroed totals for no records', () => {
    expect(computeRiskRollup([])).toEqual({
      exposure: 0,
      minImpactTotal: 0,
      mostLikelyImpactTotal: 0,
      maxImpactTotal: 0,
    });
  });

  it('sums exposure and impact totals across records', () => {
    const records = [
      { minImpactAmount: 10, mostLikelyImpactAmount: 50, maxImpactAmount: 90, probability: 0.4 },
      { minImpactAmount: 100, mostLikelyImpactAmount: 200, maxImpactAmount: 300, probability: 1 },
    ];
    const result = computeRiskRollup(records);
    expect(result.exposure).toBeCloseTo(20 + 200);
    expect(result.minImpactTotal).toBe(110);
    expect(result.mostLikelyImpactTotal).toBe(250);
    expect(result.maxImpactTotal).toBe(390);
  });

  it('treats missing/non-numeric leaf fields as zero', () => {
    const records = [
      { minImpactAmount: undefined as unknown as number, mostLikelyImpactAmount: 50, maxImpactAmount: 90, probability: 0.4 },
    ];
    const result = computeRiskRollup(records);
    expect(result.minImpactTotal).toBe(0);
    expect(Number.isFinite(result.exposure)).toBe(true);
  });
});

describe('aggregateRiskRollups', () => {
  const risks = [{ id: 'risk-1' }, { id: 'risk-2' }] as unknown as Risk[];

  it('groups records by riskId and computes each risk independently', () => {
    const records = [
      { riskId: 'risk-1', minImpactAmount: 10, mostLikelyImpactAmount: 50, maxImpactAmount: 90, probability: 0.4 },
      { riskId: 'risk-1', minImpactAmount: 100, mostLikelyImpactAmount: 200, maxImpactAmount: 300, probability: 1 },
      { riskId: 'risk-2', minImpactAmount: 5, mostLikelyImpactAmount: 5, maxImpactAmount: 5, probability: 1 },
    ] as unknown as RiskRecord[];

    const result = aggregateRiskRollups(risks, records);
    expect(result.get('risk-1')!.minImpactTotal).toBe(110);
    expect(result.get('risk-2')!.minImpactTotal).toBe(5);
    expect(result.get('risk-2')!.exposure).toBe(5);
  });

  it('returns zeroed totals for a risk with no records', () => {
    const result = aggregateRiskRollups(risks, []);
    expect(result.get('risk-1')).toEqual({ exposure: 0, minImpactTotal: 0, mostLikelyImpactTotal: 0, maxImpactTotal: 0 });
    expect(result.get('risk-2')).toEqual({ exposure: 0, minImpactTotal: 0, mostLikelyImpactTotal: 0, maxImpactTotal: 0 });
  });

  it('ignores records belonging to a risk not in the input list', () => {
    const records = [
      { riskId: 'orphan-risk', minImpactAmount: 999, mostLikelyImpactAmount: 999, maxImpactAmount: 999, probability: 1 },
    ] as unknown as RiskRecord[];
    const result = aggregateRiskRollups(risks, records);
    expect(result.size).toBe(2);
    expect(result.get('risk-1')!.minImpactTotal).toBe(0);
  });
});
