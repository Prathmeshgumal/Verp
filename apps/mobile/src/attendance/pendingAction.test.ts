import type { MeTodayResponse } from '@ve/shared';
import { fakeState } from '../testing/fakeNative';
import { StorageKeys } from '../storageKeys';
import { clearPending, keyFor, loadPending, reconcilePending, savePending } from './pendingAction';

const today = (extra: Partial<MeTodayResponse> = {}): MeTodayResponse => ({
  serverTime: '2026-09-25T04:00:00Z',
  workDate: '2026-09-25',
  day: null,
  missedYesterday: false,
  site: null,
  maxAccuracyM: 50,
  reminderTime: '19:00',
  timezone: 'Asia/Kolkata',
  ...extra,
});

test('keyFor saves the key before returning and reuses it for the same action and day', async () => {
  const first = await keyFor('checkIn', '2026-09-25');
  expect(JSON.parse(fakeState.prefs.get(StorageKeys.pendingAction) ?? 'null')).toEqual({
    key: first,
    action: 'checkIn',
    workDate: '2026-09-25',
  });
  expect(await keyFor('checkIn', '2026-09-25')).toBe(first);
});

test('keyFor discards a pending key from an earlier work date', async () => {
  await savePending({ key: 'yesterdays-key', action: 'checkIn', workDate: '2026-09-24' });
  const key = await keyFor('checkIn', '2026-09-25');
  expect(key).not.toBe('yesterdays-key');
  expect(await loadPending()).toEqual({ key, action: 'checkIn', workDate: '2026-09-25' });
});

test('keyFor uses a new key when the pending one was for the other action', async () => {
  await savePending({ key: 'in-key', action: 'checkIn', workDate: '2026-09-25' });
  expect(await keyFor('checkOut', '2026-09-25')).not.toBe('in-key');
});

test('a corrupt stored value is ignored', async () => {
  fakeState.prefs.set(StorageKeys.pendingAction, '{"key":42}');
  expect(await loadPending()).toBeNull();
  await clearPending();
  expect(fakeState.prefs.has(StorageKeys.pendingAction)).toBe(false);
});

test.each([
  ['an earlier work date', { key: 'k', action: 'checkIn', workDate: '2026-09-24' }, today(), 'discard'],
  ['check-in that reached the server', { key: 'k', action: 'checkIn', workDate: '2026-09-25' }, today({ day: { status: 'CHECKED_IN' } as never }), 'landed'],
  ['check-in that did not', { key: 'k', action: 'checkIn', workDate: '2026-09-25' }, today(), 'keep'],
  ['check-out that completed the day', { key: 'k', action: 'checkOut', workDate: '2026-09-25' }, today({ day: { status: 'COMPLETED' } as never }), 'landed'],
  ['check-out that did not', { key: 'k', action: 'checkOut', workDate: '2026-09-25' }, today({ day: { status: 'CHECKED_IN' } as never }), 'keep'],
] as const)('reconcile: %s → %s', (_name, pending, t, expected) => {
  expect(reconcilePending(pending, t)).toBe(expected);
});
