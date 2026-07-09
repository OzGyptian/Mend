import { describe, it, expect } from 'vitest';
import { isWorkingDay, addBusinessDays, subtractBusinessDays } from './procurement';
import type { Calendar } from './types';

const STANDARD_CAL: Calendar = {
  id: 'cal-1',
  projectId: 'p1',
  name: 'Standard',
  weekends: [0, 6],
  holidays: [],
  createdAt: '',
};

const CAL_WITH_HOLIDAY: Calendar = {
  ...STANDARD_CAL,
  holidays: ['2024-12-25'],
};

describe('isWorkingDay', () => {
  it('returns true for Monday', () => {
    expect(isWorkingDay(new Date('2024-07-08'), STANDARD_CAL)).toBe(true); // Monday
  });

  it('returns false for Saturday', () => {
    expect(isWorkingDay(new Date('2024-07-06'), STANDARD_CAL)).toBe(false); // Saturday
  });

  it('returns false for Sunday', () => {
    expect(isWorkingDay(new Date('2024-07-07'), STANDARD_CAL)).toBe(false); // Sunday
  });

  it('returns false for a holiday on a weekday', () => {
    expect(isWorkingDay(new Date('2024-12-25'), CAL_WITH_HOLIDAY)).toBe(false); // Wednesday + holiday
  });

  it('returns true for a day adjacent to a holiday', () => {
    expect(isWorkingDay(new Date('2024-12-24'), CAL_WITH_HOLIDAY)).toBe(true); // Tuesday
  });

  it('handles calendar with no weekends (e.g. site works 7 days)', () => {
    const sevenDayCal: Calendar = { ...STANDARD_CAL, weekends: [] };
    expect(isWorkingDay(new Date('2024-07-06'), sevenDayCal)).toBe(true); // Saturday — not a weekend
  });
});

describe('addBusinessDays', () => {
  it('adds zero days returns same date', () => {
    expect(addBusinessDays('2024-07-08', 0, STANDARD_CAL)).toBe('2024-07-08');
  });

  it('adds business days without crossing a weekend', () => {
    expect(addBusinessDays('2024-07-08', 3, STANDARD_CAL)).toBe('2024-07-11'); // Mon+3 = Thu
  });

  it('skips weekend when crossing from Friday', () => {
    expect(addBusinessDays('2024-07-05', 1, STANDARD_CAL)).toBe('2024-07-08'); // Fri+1 = Mon
  });

  it('skips holiday', () => {
    // Mon 23 Dec + 2 business days: Tue 24 (working), skip Wed 25 (holiday), land Thu 26
    expect(addBusinessDays('2024-12-23', 2, CAL_WITH_HOLIDAY)).toBe('2024-12-26');
  });

  it('adds a full week (5 days)', () => {
    expect(addBusinessDays('2024-07-08', 5, STANDARD_CAL)).toBe('2024-07-15'); // Mon + 5 working = next Mon
  });
});

describe('subtractBusinessDays', () => {
  it('subtracts zero days returns same date', () => {
    expect(subtractBusinessDays('2024-07-08', 0, STANDARD_CAL)).toBe('2024-07-08');
  });

  it('subtracts business days without crossing a weekend', () => {
    expect(subtractBusinessDays('2024-07-11', 3, STANDARD_CAL)).toBe('2024-07-08'); // Thu-3 = Mon
  });

  it('skips weekend when going backward from Monday', () => {
    expect(subtractBusinessDays('2024-07-08', 1, STANDARD_CAL)).toBe('2024-07-05'); // Mon-1 = Fri
  });

  it('skips holiday going backward', () => {
    // Thu 26 Dec - 2 business days: skip Wed 25 (holiday), Tue 24 (working), Mon 23
    expect(subtractBusinessDays('2024-12-26', 2, CAL_WITH_HOLIDAY)).toBe('2024-12-23');
  });
});
