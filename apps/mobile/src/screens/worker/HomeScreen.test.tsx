import React from 'react';
import { Alert, AppState, Linking, PermissionsAndroid } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type { AttendanceResult, DayDto, MeTodayResponse } from '@ve/shared';
import { NetworkError } from '../../api/errors';
import { loadPending, savePending } from '../../attendance/pendingAction';
import { fakeApi } from '../../testing/fakeApi';
import { emitFakeLocation, fakeState } from '../../testing/fakeNative';
import { renderWithAuth } from '../../testing/render';
import { HomeScreen } from './HomeScreen';
import { previewMapHeight } from './LocationPreview';

const site = { id: 's1', name: 'Plot 7, Hinjewadi', lat: 18.59, lng: 73.73, radiusM: 100 };
const today = (extra: Partial<MeTodayResponse> = {}): MeTodayResponse => ({
  serverTime: '2026-09-25T03:30:00Z',
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
const completed: DayDto = { ...checkedIn, status: 'COMPLETED', checkOutAt: '2026-09-25T12:45:00Z', workedMinutes: 553 };
const okIn: AttendanceResult = { code: 'OK', message: 'ok', serverTime: checkedIn.checkInAt, day: checkedIn };

beforeEach(() => {
  // Pin only the date to the fixtures' work day; timers stay real so waitFor works.
  jest.useFakeTimers({
    now: new Date('2026-09-25T03:35:00Z'),
    doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'hrtime', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback'],
  });
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: 'granted',
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted',
  } as never);
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
});

afterEach(() => jest.useRealTimers());

test('not checked in: CHECK IN saves, shows the time and sets the reminder', async () => {
  const api = fakeApi({ today: jest.fn(async () => today()), checkIn: jest.fn(async () => okIn) });
  await renderWithAuth(<HomeScreen />, { api });
  expect(await screen.findByText('Plot 7, Hinjewadi')).toBeOnTheScreen();
  expect(screen.getByText('Namaste, Anil')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'CHECK IN' }));
  expect(await screen.findByText('Attendance saved')).toBeOnTheScreen();
  expect(screen.getByText('9:02 AM')).toBeOnTheScreen();
  expect(fakeState.reminders).toHaveLength(1);

  await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(screen.queryByText('Attendance saved')).toBeNull());
  await waitFor(() => expect(api.today).toHaveBeenCalledTimes(2));
});

test('a double tap sends only one request', async () => {
  // The server answers only after both taps, so the second tap always lands while the first is in flight.
  let answer: (result: AttendanceResult) => void = () => {};
  const checkIn = jest.fn(() => new Promise<AttendanceResult>((resolve) => (answer = resolve)));
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()), checkIn }) });
  const button = await screen.findByRole('button', { name: 'CHECK IN' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  await waitFor(() => expect(checkIn).toHaveBeenCalled());
  answer(okIn);
  expect(await screen.findByText('Attendance saved')).toBeOnTheScreen();
  expect(checkIn).toHaveBeenCalledTimes(1);
});

test('outside the site: shows the distance, Not saved, and Try again sends again', async () => {
  const outside: AttendanceResult = { code: 'OUTSIDE_SITE', message: 'far', serverTime: 'x', distanceM: 120 };
  const checkIn = jest.fn(async () => outside);
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()), checkIn }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'CHECK IN' }));
  expect(await screen.findByText('You are 120 m away from the site')).toBeOnTheScreen();
  expect(screen.getByText('Not saved')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(2));
});

test('location off: nothing is sent and Open settings opens location settings', async () => {
  fakeState.locationEnabled = false;
  const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
  const checkIn = jest.fn(async () => okIn);
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()), checkIn }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'CHECK IN' }));
  expect(await screen.findByText('Turn on location')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
  expect(sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
  expect(checkIn).not.toHaveBeenCalled();
});

test('working: shows since time, reminder, and CHECK OUT', async () => {
  const checkOut = jest.fn(async () => ({ code: 'OK', message: 'ok', serverTime: 'x', day: completed }) as AttendanceResult);
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ day: checkedIn })), checkOut }) });
  expect(await screen.findByText('Since 9:02 AM')).toBeOnTheScreen();
  expect(screen.getByText('Reminder at 7:00 PM')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'CHECK OUT' }));
  expect(await screen.findByText('6:15 PM')).toBeOnTheScreen();
  expect(checkOut).toHaveBeenCalledTimes(1);
});

test('already checked in: the reminder is set again (alarms are lost on reboot)', async () => {
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ day: checkedIn })) }) });
  expect(await screen.findByText('Since 9:02 AM')).toBeOnTheScreen();
  await waitFor(() => expect(fakeState.reminders).toEqual([expect.objectContaining({ workDate: '2026-09-25', reminderTime: '19:00' })]));
});

test('done: times and hours, no button', async () => {
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ day: completed })) }) });
  expect(await screen.findByText('Done for today')).toBeOnTheScreen();
  expect(screen.getByText('9:02 – 6:15')).toBeOnTheScreen();
  expect(screen.getByText('9 h 13 min worked')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /CHECK/ })).toBeNull();
});

test("yesterday's missed check-out shows a banner", async () => {
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ missedYesterday: true })) }) });
  expect(await screen.findByText('You did not check out yesterday')).toBeOnTheScreen();
  expect(screen.getByText('Tell your supervisor')).toBeOnTheScreen();
});

test('no site assigned: contact supervisor, no button', async () => {
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ site: null })) }) });
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'CHECK IN' })).toBeNull();
});

test('no internet on load: Try again reloads', async () => {
  const todayFn = jest
    .fn(async () => today())
    .mockRejectedValueOnce(new NetworkError('offline'));
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: todayFn }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'CHECK IN' })).toBeOnTheScreen();
});

test('a check-in that landed before a force-close is settled on launch', async () => {
  await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-25' });
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ day: checkedIn })) }) });
  expect(await screen.findByText('Since 9:02 AM')).toBeOnTheScreen();
  await waitFor(async () => expect(await loadPending()).toBeNull());
  expect(fakeState.reminders).toHaveLength(1);
});

test('menu → Log out asks first, then logs out', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { auth } = await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()) }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'Menu' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
  const buttons = alert.mock.calls[0]?.[2] ?? [];
  expect(auth.logout).not.toHaveBeenCalled();
  await act(async () => buttons[1]?.onPress?.());
  expect(auth.logout).toHaveBeenCalled();
});

async function renderHome(api = fakeApi({ today: jest.fn(async () => today()), checkIn: jest.fn(async () => okIn) })) {
  await renderWithAuth(<HomeScreen />, { api });
  await screen.findByText('Plot 7, Hinjewadi');
  await waitFor(() => expect(fakeState.watchIntervalMs).toBe(1000));
  return api;
}

test('the preview says when you are inside the site', async () => {
  await renderHome();
  expect(screen.getByText('Looking for your location…')).toBeOnTheScreen();
  await act(async () => emitFakeLocation({ lat: 18.59, lng: 73.73, accuracyM: 8, isMock: false }));
  expect(screen.getByText('Inside the site · 0 m from the centre · ±8 m')).toBeOnTheScreen();
});

test('the preview warns about a poor reading and a fake-location app', async () => {
  await renderHome();
  await act(async () => emitFakeLocation({ lat: 18.59, lng: 73.73, accuracyM: 85, isMock: true }));
  expect(screen.getByText('Getting a precise location… ±85 m')).toBeOnTheScreen();
  expect(screen.getByText('A fake-location app is on. Check-ins will be flagged.')).toBeOnTheScreen();
});

test('CHECK IN still works when the preview says outside', async () => {
  const api = await renderHome();
  await act(async () => emitFakeLocation({ lat: 18.6, lng: 73.73, accuracyM: 9, isMock: false }));
  expect(screen.getByText(/^Outside the site · \d+ m away$/)).toBeOnTheScreen();
  const button = screen.getByRole('button', { name: 'CHECK IN' });
  expect(button).toBeEnabled();
  await fireEvent.press(button);
  expect(await screen.findByText('Attendance saved')).toBeOnTheScreen();
  expect(api.checkIn).toHaveBeenCalledTimes(1);
});

test('the watch pauses while a check-in is being saved', async () => {
  let answer: (result: AttendanceResult) => void = () => {};
  const checkIn = jest.fn(() => new Promise<AttendanceResult>((resolve) => (answer = resolve)));
  await renderHome(fakeApi({ today: jest.fn(async () => today()), checkIn }));
  await fireEvent.press(screen.getByRole('button', { name: 'CHECK IN' }));
  await waitFor(() => expect(checkIn).toHaveBeenCalled());
  expect(fakeState.watchIntervalMs).toBeNull();
  answer(okIn);
  await fireEvent.press(await screen.findByRole('button', { name: 'OK' }));
  await waitFor(() => expect(fakeState.watchIntervalMs).toBe(1000));
});

test('the watch stops in the background and restarts on return', async () => {
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: string) => void);
    return { remove: jest.fn() } as never;
  });
  await renderHome();
  await act(async () => listeners.forEach((l) => l('background')));
  expect(fakeState.watchIntervalMs).toBeNull();
  await act(async () => listeners.forEach((l) => l('active')));
  await waitFor(() => expect(fakeState.watchIntervalMs).toBe(1000));
});

test('with location off the preview says so and offers the settings', async () => {
  fakeState.locationEnabled = false;
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()) }) });
  expect(await screen.findByText('Location is off. Turn it on to see where you are.')).toBeOnTheScreen();
  const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue();
  await fireEvent.press(screen.getByRole('button', { name: 'Location settings' }));
  expect(sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
  expect(fakeState.watchIntervalMs).toBeNull();
  expect(screen.getByRole('button', { name: 'CHECK IN' })).toBeEnabled();
});

test('no site: no preview and no watch', async () => {
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ site: null })) }) });
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  expect(screen.queryByText('Looking for your location…')).toBeNull();
  expect(fakeState.watchIntervalMs).toBeNull();
});

test('the CHECK IN button sits in a scroll view, so small screens can still reach it', async () => {
  await renderHome();
  expect(within(screen.getByTestId('home-scroll')).getByRole('button', { name: 'CHECK IN' })).toBeOnTheScreen();
});

test('the preview map gets shorter on short screens', () => {
  expect(previewMapHeight(1000)).toBe(200);
  expect(previewMapHeight(640)).toBe(141);
});

test('coming back to the app checks location without asking for permission again', async () => {
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: string) => void);
    return { remove: jest.fn() } as never;
  });
  await renderHome();
  // Android reports the app as backgrounded while its permission dialog is open.
  await act(async () => listeners.forEach((l) => l('background')));
  await act(async () => listeners.forEach((l) => l('active')));
  await waitFor(() => expect(fakeState.watchIntervalMs).toBe(1000));
  expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledTimes(1);
  expect(PermissionsAndroid.check).toHaveBeenCalled();
});
