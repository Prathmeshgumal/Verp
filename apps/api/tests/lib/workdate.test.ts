import { describe, expect, it } from 'vitest';
import { addDays, formatLocal, workDateOf } from '../../src/lib/workdate';

const IST = 'Asia/Kolkata';

describe('workDateOf', () => {
  it('uses the IST calendar date, not UTC', () => {
    expect(workDateOf(new Date('2026-09-25T18:29:59Z'), IST)).toBe('2026-09-25'); // 23:59:59 IST
    expect(workDateOf(new Date('2026-09-25T18:30:00Z'), IST)).toBe('2026-09-26'); // 00:00 IST
    expect(workDateOf(new Date('2026-09-25T19:00:00Z'), IST)).toBe('2026-09-26'); // 00:30 IST
  });
  it('respects other timezones', () => {
    expect(workDateOf(new Date('2026-09-25T02:00:00Z'), 'America/New_York')).toBe('2026-09-24');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('formatLocal', () => {
  it('formats in the company timezone with 24h time', () => {
    expect(formatLocal(new Date('2026-09-25T03:32:00Z'), IST)).toBe('2026-09-25 09:02');
    expect(formatLocal(new Date('2026-09-25T18:45:00Z'), IST)).toBe('2026-09-26 00:15');
  });
});
