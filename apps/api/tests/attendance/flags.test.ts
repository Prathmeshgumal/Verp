import { describe, expect, it } from 'vitest';
import { computeFlags, mergeFlags } from '../../src/modules/attendance/flags';

const now = new Date('2026-09-25T04:00:00Z');

describe('computeFlags', () => {
  it('flags mock locations', () => {
    expect(computeFlags({ isMock: true, deviceTime: now.toISOString() }, now, 10)).toEqual(['MOCK_LOCATION']);
  });
  it('flags clock mismatch beyond the threshold only', () => {
    const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString();
    expect(computeFlags({ isMock: false, deviceTime: at(10) }, now, 10)).toEqual([]);
    expect(computeFlags({ isMock: false, deviceTime: at(-11) }, now, 10)).toEqual(['CLOCK_MISMATCH']);
  });
});

describe('mergeFlags', () => {
  it('unions without duplicates, preserving order', () => {
    expect(mergeFlags(['A', 'B'], ['B', 'C'])).toEqual(['A', 'B', 'C']);
  });
});
