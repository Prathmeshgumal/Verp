import type { DayDto } from '@ve/shared';
import { buildHistoryRows } from './history';

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

test('one row per day for 30 days, newest first, gaps are absent days', () => {
  const rows = buildHistoryRows('2026-09-25', [
    day('2026-09-25', 'CHECKED_IN'),
    day('2026-09-24', 'MISSED_CHECKOUT'),
    day('2026-09-22', 'COMPLETED'),
  ]);
  expect(rows).toHaveLength(30);
  expect(rows.slice(0, 4).map((r) => [r.workDate, r.kind])).toEqual([
    ['2026-09-25', 'working'],
    ['2026-09-24', 'missed'],
    ['2026-09-23', 'absent'],
    ['2026-09-22', 'completed'],
  ]);
  expect(rows[3]).toMatchObject({ workedMinutes: 553, checkOutAt: '2026-09-22T12:45:00Z' });
  expect(rows[29]?.workDate).toBe('2026-08-27');
});
