import type { AttendanceResult } from '@ve/shared';
import type { LocationProblem } from '../native/location';
import type { IconName } from '../ui/Icon';

export type AttendanceAction = 'checkIn' | 'checkOut';
export type ClientCode = LocationProblem | 'NO_FIX' | 'NETWORK';
export type Tone = 'success' | 'problem' | 'info';
export type OutcomeAction = 'ok' | 'retry' | 'openAppSettings' | 'openLocationSettings';

export interface OutcomeView {
  tone: Tone;
  icon: IconName;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  detailKey?: string;
  /** ISO time shown large under the detail. */
  time?: string;
  /** Existing times for "already done" answers. */
  range?: { from: string; to: string | null };
  actionKey: string;
  action: OutcomeAction;
}

const retry = { actionKey: 'common.tryAgain', action: 'retry' } as const;
const ok = { actionKey: 'common.ok', action: 'ok' } as const;
const settings = { actionKey: 'result.openSettings' } as const;

/** Spec §5 "Result codes → employee messages". Unknown codes fall back to "Not saved, no internet". */
export function outcomeView(code: string, action: AttendanceAction, result?: AttendanceResult): OutcomeView {
  const day = result?.day;
  switch (code) {
    case 'OK':
      return {
        tone: 'success',
        icon: 'check',
        titleKey: 'result.saved',
        detailKey: action === 'checkIn' ? 'result.checkedInAt' : 'result.checkedOutAt',
        time: (action === 'checkIn' ? day?.checkInAt : day?.checkOutAt) ?? result?.serverTime,
        ...ok,
      };
    case 'LOCATION_OFF':
      return { tone: 'problem', icon: 'pin', titleKey: 'result.locationOff', detailKey: 'result.locationOffHelp', ...settings, action: 'openLocationSettings' };
    case 'PERMISSION_DENIED':
      return { tone: 'problem', icon: 'pin', titleKey: 'result.permissionDenied', detailKey: 'result.permissionHelp', ...settings, action: 'openAppSettings' };
    case 'PRECISE_LOCATION_REQUIRED':
      return { tone: 'problem', icon: 'pin', titleKey: 'result.preciseRequired', detailKey: 'result.preciseHelp', ...settings, action: 'openAppSettings' };
    case 'LOW_ACCURACY':
    case 'NO_FIX':
      return { tone: 'problem', icon: 'signal', titleKey: 'result.lowAccuracy', detailKey: 'result.lowAccuracyHelp', ...retry };
    case 'OUTSIDE_SITE':
      return {
        tone: 'problem',
        icon: 'fence',
        titleKey: 'result.outside',
        titleParams: { distance: result?.distanceM ?? '?' },
        detailKey: 'result.outsideHelp',
        ...retry,
      };
    case 'ALREADY_CHECKED_IN':
      return { tone: 'info', icon: 'info', titleKey: 'result.alreadyIn', detailKey: 'result.checkedInAt', time: day?.checkInAt, ...ok };
    case 'ALREADY_CHECKED_OUT':
      return {
        tone: 'info',
        icon: 'info',
        titleKey: 'result.alreadyOut',
        range: day ? { from: day.checkInAt, to: day.checkOutAt } : undefined,
        ...ok,
      };
    case 'NOT_CHECKED_IN':
      return { tone: 'info', icon: 'info', titleKey: 'result.notCheckedIn', ...ok };
    case 'NO_SITE':
    case 'ACCOUNT_INACTIVE':
    case 'FORBIDDEN':
      return { tone: 'info', icon: 'person', titleKey: 'result.contactSupervisor', ...ok };
    default:
      return { tone: 'problem', icon: 'wifiOff', titleKey: 'result.network', detailKey: 'result.networkHelp', ...retry };
  }
}
