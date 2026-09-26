import type { MeTodayResponse } from '@ve/shared';
import { prefs, randomUuid } from '../native/device';
import { StorageKeys } from '../storageKeys';
import type { AttendanceAction } from './messages';

export interface PendingAction {
  key: string;
  action: AttendanceAction;
  workDate: string;
}

function isPending(value: unknown): value is PendingAction {
  const v = value as Partial<PendingAction> | null;
  return (
    !!v &&
    typeof v.key === 'string' &&
    (v.action === 'checkIn' || v.action === 'checkOut') &&
    typeof v.workDate === 'string'
  );
}

export async function loadPending(): Promise<PendingAction | null> {
  const stored = await prefs.getJson<unknown>(StorageKeys.pendingAction);
  return isPending(stored) ? stored : null;
}

export const savePending = (pending: PendingAction) => prefs.setJson(StorageKeys.pendingAction, pending);

export const clearPending = () => prefs.remove(StorageKeys.pendingAction);

/**
 * The idempotency key for this tap. Reuses the saved key for the same action and work date,
 * so a retry after a crash or timeout can never create a second record. A key from another day
 * or action is dropped. The key is on disk before this returns, i.e. before any network call.
 */
export async function keyFor(action: AttendanceAction, workDate: string): Promise<string> {
  const pending = await loadPending();
  if (pending && pending.action === action && pending.workDate === workDate) return pending.key;
  const key = await randomUuid();
  await savePending({ key, action, workDate });
  return key;
}

export type PendingState = 'landed' | 'discard' | 'keep';

export function reconcilePending(pending: PendingAction, today: MeTodayResponse): PendingState {
  if (pending.workDate !== today.workDate) return 'discard';
  if (pending.action === 'checkIn') return today.day ? 'landed' : 'keep';
  return today.day?.status === 'COMPLETED' ? 'landed' : 'keep';
}
