import type { AttendanceResult, DayDto, MeTodayResponse } from '@ve/shared';
import { ApiError, NetworkError } from '../api/errors';
import type { Fix, LocationProblem } from '../native/location';
import { fakeState } from '../testing/fakeNative';
import { StorageKeys } from '../storageKeys';
import { loadPending, savePending } from './pendingAction';
import { resumePendingOnLaunch, submitAttendance, type SubmitDeps } from './submitFlow';

const site = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100 };
const today = (extra: Partial<MeTodayResponse> = {}): MeTodayResponse => ({
  serverTime: '2026-09-25T03:32:00Z',
  workDate: '2026-09-25',
  day: null,
  missedYesterday: false,
  site,
  maxAccuracyM: 50,
  reminderTime: '19:00',
  timezone: 'Asia/Kolkata',
  ...extra,
});
const checkedIn: DayDto = {
  id: 'd1',
  workDate: '2026-09-25',
  siteId: 's1',
  status: 'CHECKED_IN',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  workedMinutes: null,
  flags: [],
  needsReview: false,
};
const ok = (day: DayDto = checkedIn): AttendanceResult => ({ code: 'OK', message: 'ok', serverTime: day.checkInAt, day });

function makeDeps(overrides: Partial<SubmitDeps['api']> = {}) {
  const deps = {
    api: {
      checkIn: jest.fn(async (_key: string) => ok()),
      checkOut: jest.fn(async (_key: string) => ok({ ...checkedIn, status: 'COMPLETED', checkOutAt: '2026-09-25T12:45:00Z' })),
      today: jest.fn(async () => today()),
      ...overrides,
    },
    ensureLocationReady: jest.fn<Promise<LocationProblem | null>, []>(async () => null),
    getBestFix: jest.fn<Promise<Fix | null>, [number]>(async () => ({ lat: 18.5912, lng: 73.7389, accuracyM: 12, isMock: false })),
    deviceInfo: jest.fn(async () => ({ ...fakeState.info })),
    reminder: { schedule: jest.fn(async () => true), cancel: jest.fn(async () => undefined) },
    now: () => new Date('2026-09-25T03:32:00.000Z'),
  };
  return deps as typeof deps & SubmitDeps;
}

const keysUsed = (mock: jest.Mock) => mock.mock.calls.map((call) => call[0] as string);

test('a check-in sends the fix, device details and local time, then schedules the reminder', async () => {
  const deps = makeDeps();
  const steps: string[] = [];
  const outcome = await submitAttendance('checkIn', today(), deps, (s) => steps.push(s));
  expect(outcome.code).toBe('OK');
  expect(deps.api.checkIn).toHaveBeenCalledWith(expect.any(String), {
    lat: 18.5912,
    lng: 73.7389,
    accuracyM: 12,
    isMock: false,
    deviceTime: '2026-09-25T09:02:00.000+05:30',
    deviceId: 'device-1',
    deviceModel: 'Test Phone',
    appVersion: '0.1.0',
  });
  expect(deps.getBestFix).toHaveBeenCalledWith(50);
  expect(steps).toEqual(['locating', 'saving']);
  expect(deps.reminder.schedule).toHaveBeenCalledWith(expect.objectContaining({ workDate: '2026-09-25' }));
  expect(await loadPending()).toBeNull();
});

test('the key is saved before the request goes out', async () => {
  let savedDuringSend: string | undefined;
  const deps = makeDeps({
    checkIn: jest.fn(async (key: string) => {
      savedDuringSend = JSON.parse(fakeState.prefs.get(StorageKeys.pendingAction) ?? '{}').key;
      expect(savedDuringSend).toBe(key);
      return ok();
    }),
  });
  await submitAttendance('checkIn', today(), deps);
  expect(savedDuringSend).toBeDefined();
});

test('a location problem stops before any request', async () => {
  const deps = makeDeps();
  deps.ensureLocationReady.mockResolvedValue('PRECISE_LOCATION_REQUIRED');
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('PRECISE_LOCATION_REQUIRED');
  expect(deps.getBestFix).not.toHaveBeenCalled();
  expect(deps.api.checkIn).not.toHaveBeenCalled();
});

test('no GPS reading at all is NO_FIX and nothing is sent', async () => {
  const deps = makeDeps();
  deps.getBestFix.mockResolvedValue(null);
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NO_FIX');
  expect(deps.api.checkIn).not.toHaveBeenCalled();
});

test('a server rejection is final: key cleared, no reminder', async () => {
  const outside: AttendanceResult = { code: 'OUTSIDE_SITE', message: 'far', serverTime: 'x', distanceM: 120 };
  const deps = makeDeps({ checkIn: jest.fn(async () => outside) });
  expect(await submitAttendance('checkIn', today(), deps)).toEqual({ code: 'OUTSIDE_SITE', result: outside });
  expect(await loadPending()).toBeNull();
  expect(deps.reminder.schedule).not.toHaveBeenCalled();
});

test('timeout after the server saved shows saved without resending', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new NetworkError('timeout');
    }),
    today: jest.fn(async () => today({ day: checkedIn })),
  });
  const steps: string[] = [];
  const outcome = await submitAttendance('checkIn', today(), deps, (s) => steps.push(s));
  expect(outcome.code).toBe('OK');
  expect(outcome.result?.day).toEqual(checkedIn);
  expect(deps.api.checkIn).toHaveBeenCalledTimes(1);
  expect(steps).toEqual(['locating', 'saving', 'checking']);
  expect(deps.reminder.schedule).toHaveBeenCalled();
  expect(await loadPending()).toBeNull();
});

test('timeout retries with the same key', async () => {
  const checkIn = jest
    .fn(async (_key: string) => ok())
    .mockRejectedValueOnce(new NetworkError('timeout'));
  const deps = makeDeps({ checkIn });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('OK');
  const [first, second] = keysUsed(checkIn);
  expect(checkIn).toHaveBeenCalledTimes(2);
  expect(second).toBe(first);
});

test('two unknown outcomes keep the key so Try again reuses it', async () => {
  const checkIn = jest.fn(async (_key: string): Promise<AttendanceResult> => {
    throw new NetworkError('offline');
  });
  const deps = makeDeps({ checkIn });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NETWORK');
  expect(checkIn).toHaveBeenCalledTimes(2);
  const pending = await loadPending();
  expect(pending?.key).toBe(keysUsed(checkIn)[0]);

  checkIn.mockImplementation(async () => ok());
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('OK');
  expect(new Set(keysUsed(checkIn)).size).toBe(1);
});

test('when the status check also fails the key is kept and nothing is resent', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new NetworkError('offline');
    }),
    today: jest.fn(async () => {
      throw new NetworkError('offline');
    }),
  });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NETWORK');
  expect(deps.api.checkIn).toHaveBeenCalledTimes(1);
  expect(await loadPending()).not.toBeNull();
});

test('midnight passing during the request drops the key', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new NetworkError('timeout');
    }),
    today: jest.fn(async () => today({ workDate: '2026-09-26' })),
  });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NETWORK');
  expect(await loadPending()).toBeNull();
});

test('an idempotency conflict is final and clears the key', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'conflict', {});
    }),
  });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  expect(await loadPending()).toBeNull();
});

test('check-out cancels the reminder, also when already checked out', async () => {
  const deps = makeDeps();
  await submitAttendance('checkOut', today({ day: checkedIn }), deps);
  expect(deps.reminder.cancel).toHaveBeenCalledTimes(1);

  (deps.api.checkOut as jest.Mock).mockResolvedValue({ code: 'ALREADY_CHECKED_OUT', message: 'x', serverTime: 'x' } as AttendanceResult);
  await submitAttendance('checkOut', today({ day: checkedIn }), deps);
  expect(deps.reminder.cancel).toHaveBeenCalledTimes(2);
});

test('a reminder failure does not turn a saved check-in into an error', async () => {
  const deps = makeDeps();
  deps.reminder.schedule.mockRejectedValue(new Error('alarm service down'));
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('OK');
});

describe('resumePendingOnLaunch', () => {
  const reminder = () => ({ schedule: jest.fn(async () => true), cancel: jest.fn(async () => undefined) });

  test('a check-in that landed while the app was closed clears the key and sets the reminder', async () => {
    await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-25' });
    const r = reminder();
    expect(await resumePendingOnLaunch(today({ day: checkedIn }), { reminder: r })).toBe('landed');
    expect(r.schedule).toHaveBeenCalled();
    expect(await loadPending()).toBeNull();
  });

  test("yesterday's key is discarded without touching the reminder", async () => {
    await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-24' });
    const r = reminder();
    expect(await resumePendingOnLaunch(today(), { reminder: r })).toBe('discard');
    expect(r.schedule).not.toHaveBeenCalled();
    expect(await loadPending()).toBeNull();
  });

  test('a key that has not landed is kept for the next tap', async () => {
    await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-25' });
    expect(await resumePendingOnLaunch(today(), { reminder: reminder() })).toBe('keep');
    expect((await loadPending())?.key).toBe('k');
  });

  test('nothing pending → null', async () => {
    expect(await resumePendingOnLaunch(today(), { reminder: reminder() })).toBeNull();
  });
});
