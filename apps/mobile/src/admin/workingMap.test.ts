import type { DashboardMapDay } from '@ve/shared';
import { stackDays, stackLabel, stackTone, visibleDays } from './workingMap';

const day = (dayId: string, name: string, extra: Partial<DashboardMapDay> = {}): DashboardMapDay => ({
  dayId,
  employeeId: `e-${dayId}`,
  name,
  siteId: 's1',
  siteName: 'Plot 7',
  status: 'CHECKED_IN',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  checkInLat: 18.5912,
  checkInLng: 73.7389,
  needsReview: false,
  ...extra,
});

test('finished days show only when asked', () => {
  const days = [day('a', 'Ravi'), day('b', 'Amol', { status: 'COMPLETED', checkOutAt: '2026-09-25T12:00:00Z' })];
  expect(visibleDays(days, false).map((d) => d.dayId)).toEqual(['a']);
  expect(visibleDays(days, true)).toHaveLength(2);
});

test('people at one spot share a tag; people further apart get their own', () => {
  const stacks = stackDays([day('a', 'Ravi'), day('b', 'Amol', { checkInLat: 18.59121 }), day('c', 'Sunil', { checkInLat: 18.6 })]);
  expect(stacks.map((s) => s.days.map((d) => d.name))).toEqual([['Ravi', 'Amol'], ['Sunil']]);
});

test('a tag names one person with the time, or up to two names and a count', () => {
  const t = ((k: string) => ({ 'date.am': 'AM', 'date.pm': 'PM' })[k] ?? k) as never;
  expect(stackLabel([day('a', 'Ravi')], t)).toBe('Ravi · in 9:02');
  expect(stackLabel([day('a', 'Ravi'), day('b', 'Amol')], t)).toBe('Ravi, Amol');
  expect(stackLabel([day('a', 'Ravi'), day('b', 'Amol'), day('c', 'Sunil')], t)).toBe('Ravi, Amol +1');
});

test('a tag is orange if anyone needs review, green if anyone works, else grey', () => {
  expect(stackTone([day('a', 'R', { needsReview: true }), day('b', 'A')])).toBe('orange');
  expect(stackTone([day('a', 'R', { status: 'COMPLETED' }), day('b', 'A')])).toBe('green');
  expect(stackTone([day('a', 'R', { status: 'COMPLETED' })])).toBe('grey');
});
