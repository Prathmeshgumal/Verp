import type { DayDto } from '@ve/shared';
import { buildMonth, monthOf, monthRange, monthSummary, shiftMonth } from './history';

const day = (workDate: string, status: DayDto['status'], extra: Partial<DayDto> = {}): DayDto => ({
  id: workDate,
  workDate,
  siteId: 's1',
  status,
  checkInAt: `${workDate}T03:32:00Z`,
  checkOutAt: status === 'COMPLETED' ? `${workDate}T12:45:00Z` : null,
  workedMinutes: status === 'COMPLETED' ? 553 : null,
  flags: [],
  needsReview: false,
  ...extra,
});

test('months move across year ends', () => {
  expect(monthOf('2026-09-25')).toBe('2026-09');
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
});

test('a month is fetched from its first day up to today, never more than 31 days', () => {
  expect(monthRange('2026-09', '2026-09-25')).toEqual({ from: '2026-09-01', to: '2026-09-25' });
  expect(monthRange('2026-08', '2026-09-25')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  expect(monthRange('2024-02', '2026-09-25')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
});

test('the grid starts on Monday and pads the first week', () => {
  // 1 Sep 2026 is a Tuesday.
  const { weeks } = buildMonth('2026-09', '2026-09-25', '2026-01-01', []);
  expect(weeks[0]?.[0]).toBeNull();
  expect(weeks[0]?.[1]?.workDate).toBe('2026-09-01');
  expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  expect(weeks.every((w) => w.length === 7)).toBe(true);
});

test('past days without a record are absent; before joining, today and the future are not', () => {
  const { weeks } = buildMonth('2026-09', '2026-09-25', '2026-09-10', [
    day('2026-09-24', 'MISSED_CHECKOUT'),
    day('2026-09-22', 'COMPLETED'),
    day('2026-09-21', 'CHECKED_IN'),
  ]);
  const kind = (d: string) => weeks.flat().find((c) => c?.workDate === d)?.kind;
  expect(kind('2026-09-09')).toBe('none');
  expect(kind('2026-09-10')).toBe('absent');
  expect(kind('2026-09-21')).toBe('working');
  expect(kind('2026-09-22')).toBe('completed');
  expect(kind('2026-09-23')).toBe('absent');
  expect(kind('2026-09-24')).toBe('missed');
  expect(kind('2026-09-25')).toBe('none');
  expect(kind('2026-09-26')).toBe('none');
});

test('today with a record shows it', () => {
  const { weeks } = buildMonth('2026-09', '2026-09-25', '2026-09-10', [day('2026-09-25', 'CHECKED_IN')]);
  expect(weeks.flat().find((c) => c?.workDate === '2026-09-25')?.kind).toBe('working');
});

test('the summary counts present, absent and missed days and adds up hours', () => {
  const month = buildMonth('2026-09', '2026-09-25', '2026-09-20', [
    day('2026-09-24', 'MISSED_CHECKOUT'),
    day('2026-09-22', 'COMPLETED'),
    day('2026-09-21', 'COMPLETED', { workedMinutes: 60 }),
  ]);
  expect(monthSummary(month)).toEqual({ present: 3, absent: 2, missed: 1, minutes: 613 });
});
