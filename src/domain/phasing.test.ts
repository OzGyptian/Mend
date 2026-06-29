import { describe, it, expect } from 'vitest';
import { calculatePhasing, dateToISO } from './phasing';

const makePeriods = (count: number, base = '2024-01-01') => {
  const periods = [];
  const start = new Date(base);
  for (let i = 0; i < count; i++) {
    const pStart = new Date(start);
    pStart.setMonth(start.getMonth() + i);
    const pEnd = new Date(pStart);
    pEnd.setMonth(pStart.getMonth() + 1);
    pEnd.setDate(pEnd.getDate() - 1);
    periods.push({
      id: `p${i + 1}`,
      startDate: dateToISO(pStart),
      endDate: dateToISO(pEnd),
    });
  }
  return periods;
};

describe('dateToISO', () => {
  it('formats a Date to YYYY-MM-DD in local time', () => {
    const d = new Date(2024, 0, 15); // Jan 15 2024
    expect(dateToISO(d)).toBe('2024-01-15');
  });

  it('pads month and day with leading zeros', () => {
    const d = new Date(2024, 8, 5); // Sep 5 2024
    expect(dateToISO(d)).toBe('2024-09-05');
  });
});

describe('calculatePhasing', () => {
  it('returns empty object when no periods are active', () => {
    const result = calculatePhasing(1000, '2024-06-01', '2024-06-30', 'Even', []);
    expect(result).toEqual({});
  });

  it('returns empty object when start >= end', () => {
    const periods = makePeriods(3);
    const result = calculatePhasing(1000, '2024-03-01', '2024-01-01', 'Even', periods);
    expect(result).toEqual({});
  });

  it('distributes evenly across active periods', () => {
    const periods = makePeriods(4);
    const result = calculatePhasing(400, '2024-01-01', '2024-04-30', 'Even', periods);
    expect(Object.keys(result)).toHaveLength(4);
    expect(result['p1']).toBeCloseTo(100);
    expect(result['p2']).toBeCloseTo(100);
    expect(result['p3']).toBeCloseTo(100);
    expect(result['p4']).toBeCloseTo(100);
  });

  it('front-loads heavier weight to earlier periods', () => {
    const periods = makePeriods(3);
    const result = calculatePhasing(600, '2024-01-01', '2024-03-31', 'Front load', periods);
    // weights: 3, 2, 1 → total 6 → p1=300, p2=200, p3=100
    expect(result['p1']).toBeCloseTo(300);
    expect(result['p2']).toBeCloseTo(200);
    expect(result['p3']).toBeCloseTo(100);
  });

  it('back-loads heavier weight to later periods', () => {
    const periods = makePeriods(3);
    const result = calculatePhasing(600, '2024-01-01', '2024-03-31', 'Back load', periods);
    // weights: 1, 2, 3 → total 6 → p1=100, p2=200, p3=300
    expect(result['p1']).toBeCloseTo(100);
    expect(result['p2']).toBeCloseTo(200);
    expect(result['p3']).toBeCloseTo(300);
  });

  it('bell curve peaks in the middle period', () => {
    const periods = makePeriods(5);
    const result = calculatePhasing(1000, '2024-01-01', '2024-05-31', 'Bell', periods);
    // Middle period (p3) should be the largest
    const values = periods.map(p => result[p.id]);
    expect(values[2]).toBeGreaterThan(values[0]);
    expect(values[2]).toBeGreaterThan(values[4]);
    expect(values[1]).toBeGreaterThan(values[0]);
    expect(values[3]).toBeGreaterThan(values[4]);
  });

  it('bell curve alias also works', () => {
    const periods = makePeriods(3);
    const bell = calculatePhasing(300, '2024-01-01', '2024-03-31', 'Bell', periods);
    const bellCurve = calculatePhasing(300, '2024-01-01', '2024-03-31', 'Bell Curve', periods);
    expect(bell['p1']).toBeCloseTo(bellCurve['p1']);
    expect(bell['p2']).toBeCloseTo(bellCurve['p2']);
    expect(bell['p3']).toBeCloseTo(bellCurve['p3']);
  });

  it('s-curve weights sum to total', () => {
    const periods = makePeriods(6);
    const result = calculatePhasing(1000, '2024-01-01', '2024-06-30', 'S-Curve', periods);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1000);
  });

  it('profile uses existing period values as weights', () => {
    const periods = makePeriods(3);
    const existing = { p1: 1, p2: 3, p3: 6 };
    const result = calculatePhasing(1000, '2024-01-01', '2024-03-31', 'Profile', periods, existing);
    // weights: 1, 3, 6 → total 10 → p1=100, p2=300, p3=600
    expect(result['p1']).toBeCloseTo(100);
    expect(result['p2']).toBeCloseTo(300);
    expect(result['p3']).toBeCloseTo(600);
  });

  it('profile falls back to even when existing values are all zero', () => {
    const periods = makePeriods(3);
    const existing = { p1: 0, p2: 0, p3: 0 };
    const result = calculatePhasing(300, '2024-01-01', '2024-03-31', 'Profile', periods, existing);
    expect(result['p1']).toBeCloseTo(100);
    expect(result['p2']).toBeCloseTo(100);
    expect(result['p3']).toBeCloseTo(100);
  });

  it('unknown distribution falls back to even', () => {
    const periods = makePeriods(2);
    const result = calculatePhasing(200, '2024-01-01', '2024-02-29', 'UnknownMethod', periods);
    expect(result['p1']).toBeCloseTo(100);
    expect(result['p2']).toBeCloseTo(100);
  });

  it('only includes periods that overlap the date range', () => {
    const periods = makePeriods(4);
    // Only request 2 months of range — p3 and p4 should not appear
    const result = calculatePhasing(200, '2024-01-01', '2024-02-29', 'Even', periods);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['p1']).toBeCloseTo(100);
    expect(result['p2']).toBeCloseTo(100);
  });
});
