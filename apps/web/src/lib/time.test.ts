import { expect, test } from 'vitest';
import {
  addDays,
  companyInputToIso,
  formatDateTime,
  formatMinutes,
  formatTime,
  formatWorkDate,
  isoToCompanyInput,
  todayIn,
} from './time';

const IST = 'Asia/Kolkata';

test('the test run itself is in UTC (package.json sets TZ)', () => {
  expect(new Date('2026-09-25T00:00:00Z').getTimezoneOffset()).toBe(0);
});

test('formats times in the company zone even when the browser is in UTC', () => {
  expect(formatTime('2026-09-25T03:35:00.000Z', IST)).toBe('09:05');
  expect(formatDateTime('2026-09-25T03:35:00.000Z', IST)).toBe('25 Sep 2026, 09:05');
});

test('work dates are calendar dates and never shift', () => {
  expect(formatWorkDate('2026-09-25')).toBe('Fri 25 Sep 2026');
  expect(addDays('2026-09-25', -29)).toBe('2026-08-27');
});

test('today is the company date, not the UTC date', () => {
  expect(todayIn(IST, new Date('2026-09-25T20:00:00Z'))).toBe('2026-09-26');
});

test('datetime-local values are company time both ways', () => {
  expect(companyInputToIso('2026-09-25T18:30', IST)).toBe('2026-09-25T18:30:00+05:30');
  expect(isoToCompanyInput('2026-09-25T13:00:00.000Z', IST)).toBe('2026-09-25T18:30');
  expect(companyInputToIso('', IST)).toBeNull();
  expect(companyInputToIso('25/09/2026 18:30', IST)).toBeNull();
});

test('worked minutes read as hours and minutes', () => {
  expect(formatMinutes(515)).toBe('8h 35m');
  expect(formatMinutes(5)).toBe('0h 05m');
  expect(formatMinutes(null)).toBe('—');
});
