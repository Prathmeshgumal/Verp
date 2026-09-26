import type { AttendanceResult, AttendanceSubmit, MeTodayResponse } from '@ve/shared';
import type { Api } from '../api/endpoints';
import { ApiError, NetworkError } from '../api/errors';
import type { DeviceInfo } from '../native/device';
import type { Fix, LocationProblem } from '../native/location';
import { toIsoWithOffset } from './format';
import type { AttendanceAction } from './messages';
import { clearPending, keyFor, loadPending, reconcilePending, type PendingState } from './pendingAction';

export type SubmitStep = 'locating' | 'saving' | 'checking';

export interface SubmitOutcome {
  code: string;
  result?: AttendanceResult;
}

export interface SubmitDeps {
  api: Pick<Api, 'checkIn' | 'checkOut' | 'today'>;
  ensureLocationReady(): Promise<LocationProblem | null>;
  getBestFix(targetAccuracyM: number): Promise<Fix | null>;
  deviceInfo(): Promise<DeviceInfo>;
  reminder: { schedule(today: MeTodayResponse): Promise<unknown>; cancel(): Promise<unknown> };
  now(): Date;
}

const MAX_SENDS = 2;

async function updateReminder(action: AttendanceAction, code: string, today: MeTodayResponse, deps: Pick<SubmitDeps, 'reminder'>) {
  try {
    if (action === 'checkIn' && (code === 'OK' || code === 'ALREADY_CHECKED_IN')) await deps.reminder.schedule(today);
    if (action === 'checkOut' && (code === 'OK' || code === 'ALREADY_CHECKED_OUT')) await deps.reminder.cancel();
  } catch (err) {
    console.warn('attendance: reminder update failed', err);
  }
}

async function finalError(err: unknown): Promise<SubmitOutcome> {
  if (err instanceof ApiError) {
    // 429 may pass and 401 has already ended the session; every other 4xx is a final answer.
    if (err.status !== 429 && err.status !== 401) await clearPending();
    return { code: err.code };
  }
  console.warn('attendance: unexpected error', err);
  return { code: 'NETWORK' };
}

export async function submitAttendance(
  action: AttendanceAction,
  today: MeTodayResponse,
  deps: SubmitDeps,
  onStep: (step: SubmitStep) => void = () => {},
): Promise<SubmitOutcome> {
  const key = await keyFor(action, today.workDate);

  const problem = await deps.ensureLocationReady();
  if (problem) return { code: problem };

  onStep('locating');
  const fix = await deps.getBestFix(today.maxAccuracyM);
  if (!fix) return { code: 'NO_FIX' };

  const info = await deps.deviceInfo();
  const body: AttendanceSubmit = {
    lat: fix.lat,
    lng: fix.lng,
    accuracyM: fix.accuracyM,
    isMock: fix.isMock,
    deviceTime: toIsoWithOffset(deps.now()),
    deviceId: info.deviceId,
    deviceModel: info.deviceModel,
    appVersion: info.appVersion,
  };
  const send = (k: string) => (action === 'checkIn' ? deps.api.checkIn(k, body) : deps.api.checkOut(k, body));

  for (let attempt = 1; attempt <= MAX_SENDS; attempt++) {
    onStep('saving');
    try {
      const result = await send(key);
      await clearPending();
      await updateReminder(action, result.code, today, deps);
      return { code: result.code, result };
    } catch (err) {
      if (!(err instanceof NetworkError)) return finalError(err);
      console.warn(`attendance: unknown outcome (attempt ${attempt})`, err);
    }

    // We do not know whether the server saved it. Ask before sending again.
    onStep('checking');
    let fresh: MeTodayResponse;
    try {
      fresh = await deps.api.today();
    } catch (err) {
      console.warn('attendance: status check failed', err);
      return { code: 'NETWORK' };
    }
    const state = reconcilePending({ key, action, workDate: today.workDate }, fresh);
    if (state === 'landed') {
      await clearPending();
      await updateReminder(action, 'OK', fresh, deps);
      return {
        code: 'OK',
        result: { code: 'OK', message: 'Saved', serverTime: fresh.serverTime, day: fresh.day ?? undefined },
      };
    }
    if (state === 'discard') {
      await clearPending();
      return { code: 'NETWORK' };
    }
  }
  return { code: 'NETWORK' };
}

/** On app start: settle a key left behind by a crash or force-close (spec §5 client step 1). */
export async function resumePendingOnLaunch(
  today: MeTodayResponse,
  deps: Pick<SubmitDeps, 'reminder'>,
): Promise<PendingState | null> {
  const pending = await loadPending();
  if (!pending) return null;
  const state = reconcilePending(pending, today);
  if (state === 'landed') await updateReminder(pending.action, 'OK', today, deps);
  if (state !== 'keep') await clearPending();
  return state;
}
