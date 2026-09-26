import { PermissionsAndroid } from 'react-native';
import { fakeState } from '../testing/fakeNative';
import { cancelCheckoutReminder, scheduleCheckoutReminder } from './reminder';

const today = { workDate: '2026-09-25', reminderTime: '19:00', timezone: 'Asia/Kolkata' };
const text = { title: 'Check out', body: 'Tap to check out' };

test('below Android 13 schedules without asking for notification permission', async () => {
  fakeState.info.sdkInt = 32;
  const request = jest.spyOn(PermissionsAndroid, 'request');
  expect(await scheduleCheckoutReminder(today, text)).toBe(true);
  expect(request).not.toHaveBeenCalled();
  expect(fakeState.reminders).toEqual([{ ...today, ...text }]);
});

test('Android 13+ asks for notification permission once, then schedules', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
  expect(await scheduleCheckoutReminder(today, text)).toBe(true);
  expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
});

test('Android 13+ with permission already granted does not prompt', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  const request = jest.spyOn(PermissionsAndroid, 'request');
  expect(await scheduleCheckoutReminder(today, text)).toBe(true);
  expect(request).not.toHaveBeenCalled();
});

test('denied notification permission skips scheduling', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  expect(await scheduleCheckoutReminder(today, text)).toBe(false);
  expect(fakeState.reminders).toEqual([]);
});

test('cancel removes the scheduled reminder', async () => {
  fakeState.info.sdkInt = 32;
  await scheduleCheckoutReminder(today, text);
  await cancelCheckoutReminder();
  expect(fakeState.reminders).toEqual([]);
});
