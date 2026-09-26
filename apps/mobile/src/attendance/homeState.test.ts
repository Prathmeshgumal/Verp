import type { DayDto, MeTodayResponse } from '@ve/shared';
import { homeView } from './homeState';

const site = { id: 's1', name: 'Plot 7, Hinjewadi', lat: 18.59, lng: 73.73, radiusM: 100 };
const base: MeTodayResponse = {
  serverTime: '2026-09-25T04:00:00Z',
  workDate: '2026-09-25',
  day: null,
  missedYesterday: false,
  site,
  maxAccuracyM: 50,
  reminderTime: '19:00',
  timezone: 'Asia/Kolkata',
};
const day = (status: DayDto['status'], extra: Partial<DayDto> = {}): DayDto => ({
  id: 'd1',
  workDate: '2026-09-25',
  siteId: 's1',
  status,
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  workedMinutes: null,
  flags: [],
  needsReview: false,
  ...extra,
});

test('no day yet and a site → check in', () => {
  expect(homeView(base)).toEqual({ view: { kind: 'checkIn', siteName: site.name }, missedYesterday: false });
});

test('no site assigned → contact supervisor, no button', () => {
  expect(homeView({ ...base, site: null }).view).toEqual({ kind: 'noSite' });
});

test('checked in → working since check-in time', () => {
  expect(homeView({ ...base, day: day('CHECKED_IN') }).view).toEqual({
    kind: 'working',
    siteName: site.name,
    since: '2026-09-25T03:32:00Z',
  });
});

test('checked in but the site was since removed still offers check-out', () => {
  expect(homeView({ ...base, site: null, day: day('CHECKED_IN') }).view.kind).toBe('working');
});

test('completed → done with times and minutes', () => {
  const done = day('COMPLETED', { checkOutAt: '2026-09-25T12:45:00Z', workedMinutes: 553 });
  expect(homeView({ ...base, day: done }).view).toEqual({
    kind: 'done',
    checkInAt: done.checkInAt,
    checkOutAt: done.checkOutAt,
    workedMinutes: 553,
  });
});

test("yesterday's missed checkout is reported alongside any state", () => {
  expect(homeView({ ...base, missedYesterday: true }).missedYesterday).toBe(true);
});
