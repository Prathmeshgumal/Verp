import type { TFunction } from 'i18next';
import type { Api } from '../api/endpoints';
import { getDeviceInfo } from '../native/device';
import { ensureLocationReady, getBestFix } from '../native/location';
import { cancelCheckoutReminder, scheduleCheckoutReminder } from '../native/reminder';
import type { SubmitDeps } from './submitFlow';

export function createSubmitDeps(api: Api, t: TFunction): SubmitDeps {
  return {
    api,
    ensureLocationReady,
    getBestFix: (targetAccuracyM) => getBestFix(targetAccuracyM),
    deviceInfo: getDeviceInfo,
    reminder: {
      schedule: (today) => scheduleCheckoutReminder(today, { title: t('reminder.title'), body: t('reminder.body') }),
      cancel: cancelCheckoutReminder,
    },
    now: () => new Date(),
  };
}
