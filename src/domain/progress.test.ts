import { describe, it, expect } from 'vitest';
import { rocPercentComplete, earnedQty, overallPercentComplete } from './progress';

const steps = [
  { id: 'A', weight: 40 },
  { id: 'B', weight: 40 },
  { id: 'C', weight: 20 },
];

describe('rocPercentComplete', () => {
  it('returns 0 when no progress claimed', () => {
    expect(rocPercentComplete(steps, {})).toBe(0);
  });

  it('returns 100 when all steps at 100%', () => {
    expect(rocPercentComplete(steps, { A: 100, B: 100, C: 100 })).toBe(100);
  });

  it('weights each step by its weight fraction', () => {
    // A=100% × 40 + B=0% × 40 + C=100% × 20 = 40 + 0 + 20 = 60
    expect(rocPercentComplete(steps, { A: 100, C: 100 })).toBeCloseTo(60);
  });

  it('handles partial step progress', () => {
    // A=50% × 40 = 20 + B=0 + C=0 = 20
    expect(rocPercentComplete(steps, { A: 50 })).toBeCloseTo(20);
  });

  it('returns 0 for empty steps array', () => {
    expect(rocPercentComplete([], { A: 100 })).toBe(0);
  });
});

describe('earnedQty', () => {
  it('computes earned quantity from roc percent and total qty', () => {
    expect(earnedQty(50, 200)).toBeCloseTo(100);
  });

  it('returns 0 when rocPercent is 0', () => {
    expect(earnedQty(0, 500)).toBe(0);
  });

  it('returns totalQty when rocPercent is 100', () => {
    expect(earnedQty(100, 300)).toBeCloseTo(300);
  });
});

describe('overallPercentComplete', () => {
  it('returns earned/total × 100', () => {
    expect(overallPercentComplete(75, 100)).toBeCloseTo(75);
  });

  it('returns 0 when totalQty is 0 (avoid divide by zero)', () => {
    expect(overallPercentComplete(0, 0)).toBe(0);
  });

  it('can exceed 100 if earned > total (not clamped here)', () => {
    expect(overallPercentComplete(110, 100)).toBeCloseTo(110);
  });
});
