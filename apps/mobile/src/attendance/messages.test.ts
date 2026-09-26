import type { AttendanceResult, DayDto } from '@ve/shared';
import i18n from '../i18n';
import { outcomeView } from './messages';

const day: DayDto = {
  id: 'd1',
  workDate: '2026-09-25',
  siteId: 's1',
  status: 'COMPLETED',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: '2026-09-25T12:45:00Z',
  workedMinutes: 553,
  flags: [],
  needsReview: false,
};
const result = (code: string, extra: Partial<AttendanceResult> = {}): AttendanceResult =>
  ({ code, message: code, serverTime: '2026-09-25T12:45:00Z', ...extra }) as AttendanceResult;

test.each([
  ['LOCATION_OFF', 'problem', 'result.locationOff', 'openLocationSettings'],
  ['PERMISSION_DENIED', 'problem', 'result.permissionDenied', 'openAppSettings'],
  ['PRECISE_LOCATION_REQUIRED', 'problem', 'result.preciseRequired', 'openAppSettings'],
  ['LOW_ACCURACY', 'problem', 'result.lowAccuracy', 'retry'],
  ['NO_FIX', 'problem', 'result.lowAccuracy', 'retry'],
  ['OUTSIDE_SITE', 'problem', 'result.outside', 'retry'],
  ['ALREADY_CHECKED_IN', 'info', 'result.alreadyIn', 'ok'],
  ['ALREADY_CHECKED_OUT', 'info', 'result.alreadyOut', 'ok'],
  ['NOT_CHECKED_IN', 'info', 'result.notCheckedIn', 'ok'],
  ['NO_SITE', 'info', 'result.contactSupervisor', 'ok'],
  ['ACCOUNT_INACTIVE', 'info', 'result.contactSupervisor', 'ok'],
  ['NETWORK', 'problem', 'result.network', 'retry'],
  ['INTERNAL', 'problem', 'result.network', 'retry'],
  ['IDEMPOTENCY_KEY_CONFLICT', 'problem', 'result.network', 'retry'],
])('%s → %s / %s / %s', (code, tone, titleKey, action) => {
  const view = outcomeView(code, 'checkIn', result(code));
  expect(view).toMatchObject({ tone, titleKey, action });
  expect(i18n.exists(view.titleKey)).toBe(true);
  expect(i18n.exists(view.actionKey)).toBe(true);
  if (view.detailKey) expect(i18n.exists(view.detailKey)).toBe(true);
});

test('OK shows the saved time for the action', () => {
  expect(outcomeView('OK', 'checkIn', result('OK', { day }))).toMatchObject({
    tone: 'success',
    titleKey: 'result.saved',
    detailKey: 'result.checkedInAt',
    time: day.checkInAt,
  });
  expect(outcomeView('OK', 'checkOut', result('OK', { day }))).toMatchObject({
    detailKey: 'result.checkedOutAt',
    time: day.checkOutAt,
  });
});

test('OUTSIDE_SITE shows the distance', () => {
  expect(outcomeView('OUTSIDE_SITE', 'checkIn', result('OUTSIDE_SITE', { distanceM: 120 })).titleParams).toEqual({
    distance: 120,
  });
});

test('ALREADY_CHECKED_OUT shows the existing times', () => {
  expect(outcomeView('ALREADY_CHECKED_OUT', 'checkOut', result('ALREADY_CHECKED_OUT', { day })).range).toEqual({
    from: day.checkInAt,
    to: day.checkOutAt,
  });
});
