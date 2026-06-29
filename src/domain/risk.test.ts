import { describe, it, expect } from 'vitest';
import { betaPertImpact } from './risk';

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
