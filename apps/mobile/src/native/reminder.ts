import { PermissionsAndroid } from 'react-native';
import type { MeTodayResponse } from '@ve/shared';
import NativeVeDevice from '../../specs/NativeVeDevice';
import { getDeviceInfo } from './device';

export interface ReminderText {
  title: string;
  body: string;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const { sdkInt } = await getDeviceInfo();
  if (sdkInt < 33) return true;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

export async function scheduleCheckoutReminder(
  today: Pick<MeTodayResponse, 'workDate' | 'reminderTime' | 'timezone'>,
  text: ReminderText,
): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  return NativeVeDevice.scheduleReminder(today.workDate, today.reminderTime, today.timezone, text.title, text.body);
}

export function cancelCheckoutReminder(): Promise<void> {
  return NativeVeDevice.cancelReminder();
}
