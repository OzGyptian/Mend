import { describe, it, expect } from 'vitest';
import { resolveCostCodeId } from './costCodes';

const costCodes = [
  { id: 'abc123', code: 'E1' },
  { id: 'def456', code: 'E2' },
  { id: 'ghi789', code: 'E3' },
];

describe('resolveCostCodeId', () => {
  it('resolves a raw doc id to itself', () => {
    expect(resolveCostCodeId('abc123', costCodes)).toBe('abc123');
  });

  it('resolves a raw code to its doc id', () => {
    expect(resolveCostCodeId('E2', costCodes)).toBe('def456');
  });

  it('resolves a "CODE - NAME" formatted label to the doc id', () => {
    expect(resolveCostCodeId('E3 - Excavation', costCodes)).toBe('ghi789');
  });

  it('resolves a doubled "CODE - CODE" label (e.g. name equals code) to the doc id', () => {
    expect(resolveCostCodeId('E3 - E3', costCodes)).toBe('ghi789');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(resolveCostCodeId('  E1  ', costCodes)).toBe('abc123');
  });

  it('returns undefined for an empty string', () => {
    expect(resolveCostCodeId('', costCodes)).toBeUndefined();
  });

  it('returns undefined for whitespace only', () => {
    expect(resolveCostCodeId('   ', costCodes)).toBeUndefined();
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveCostCodeId('NOPE', costCodes)).toBeUndefined();
  });

  it('returns undefined for a formatted label whose code portion does not match', () => {
    expect(resolveCostCodeId('ZZ - Unknown', costCodes)).toBeUndefined();
  });

  it('prefers an exact id/code match over label-parsing when both could apply', () => {
    const ambiguous = [...costCodes, { id: 'E1 - E1', code: 'weird' }];
    expect(resolveCostCodeId('E1 - E1', ambiguous)).toBe('E1 - E1');
  });
});
