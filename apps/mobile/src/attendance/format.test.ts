import i18n from '../i18n';
import {
  addDays,
  formatDuration,
  formatLongDate,
  formatTime,
  formatWorkDateMedium,
  formatWorkDateShort,
  minutesSince,
  toIsoWithOffset,
} from './format';

const t = i18n.t.bind(i18n);

test('times are shown in 12-hour local time', () => {
  expect(formatTime('2026-09-25T03:32:00Z', t)).toBe('9:02 AM');
  expect(formatTime('2026-09-25T12:45:00Z', t)).toBe('6:15 PM');
  expect(formatTime('2026-09-25T18:30:00Z', t)).toBe('12:00 AM');
  expect(formatTime('2026-09-25T12:45:00Z', t, false)).toBe('6:15');
});

test('durations in long and short form', () => {
  expect(formatDuration(553, t)).toBe('9 h 13 min');
  expect(formatDuration(544, t, true)).toBe('9h 04m');
  expect(formatDuration(0, t, true)).toBe('0h 00m');
});

test('minutesSince never goes negative', () => {
  const now = new Date('2026-09-25T07:00:00Z');
  expect(minutesSince('2026-09-25T03:32:00Z', now)).toBe(208);
  expect(minutesSince('2026-09-25T08:00:00Z', now)).toBe(0);
});

test('dates', () => {
  expect(formatLongDate(new Date('2026-09-25T06:00:00Z'), t)).toBe('Friday, 25 September');
  expect(formatWorkDateShort('2026-09-25', t)).toBe('Fri 25');
  expect(formatWorkDateMedium('2026-09-25', t)).toBe('Fri 25 Sep');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(addDays('2026-09-25', -29)).toBe('2026-08-27');
});

test('device time carries the local offset, as the API schema requires', () => {
  expect(toIsoWithOffset(new Date('2026-09-25T03:32:00.123Z'))).toBe('2026-09-25T09:02:00.123+05:30');
});
