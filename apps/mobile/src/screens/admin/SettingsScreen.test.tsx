import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type { SettingsDto } from '@ve/shared';
import { answerConfirm } from '../../testing/confirm';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, loggedIn, renderWithAuth } from '../../testing/render';
import { reminderTimes, SettingsScreen } from './SettingsScreen';

const settings: SettingsDto = { timezone: 'Asia/Kolkata', maxAccuracyM: 50, defaultRadiusM: 100, reminderTime: '19:00', clockMismatchMinutes: 10 };

async function renderSettings(extra: Parameters<typeof fakeApi>[0] = {}) {
  const { auth } = await renderWithAuth(<SettingsScreen />, { api: fakeApi({ getSettings: jest.fn(async () => settings), ...extra }), state: loggedIn(adminUser) });
  await screen.findByText('Settings');
  return auth;
}

test('shows the current settings', async () => {
  await renderSettings();
  expect(screen.getByRole('button', { name: 'Time zone: Asia/Kolkata' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Check-out reminder time: 7:00 PM' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Required GPS accuracy (metres)').props.value).toBe('50');
});

test('saving sends the new values', async () => {
  const updateSettings = jest.fn(async (body: SettingsDto) => body);
  await renderSettings({ updateSettings });
  await fireEvent.changeText(screen.getByLabelText('Required GPS accuracy (metres)'), '30');
  await fireEvent.press(screen.getByRole('button', { name: 'Check-out reminder time: 7:00 PM' }));
  await fireEvent.press(screen.getByRole('button', { name: '6:30 PM' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ ...settings, maxAccuracyM: 30, reminderTime: '18:30' }));
  expect(await screen.findByText('Settings saved')).toBeOnTheScreen();
});

test('numbers out of range are not sent', async () => {
  const updateSettings = jest.fn(async (body: SettingsDto) => body);
  await renderSettings({ updateSettings });
  await fireEvent.changeText(screen.getByLabelText('Required GPS accuracy (metres)'), '2');
  await fireEvent.press(screen.getByRole('button', { name: 'Save settings' }));
  expect(screen.getByText('Enter a whole number from 5 to 500')).toBeOnTheScreen();
  expect(updateSettings).not.toHaveBeenCalled();
});

test('the save bar only shows once something has changed, and Discard puts it back', async () => {
  await renderSettings();
  expect(screen.queryByRole('button', { name: 'Save settings' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Required GPS accuracy (metres)'), '30');
  expect(within(screen.getByTestId('settings-save-bar')).getByText('Unsaved changes')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
  expect(screen.getByLabelText('Required GPS accuracy (metres)').props.value).toBe('50');
  expect(screen.queryByTestId('settings-save-bar')).toBeNull();
});

test('log out is a row in the account section, with the admin shown above it', async () => {
  await renderSettings();
  const account = screen.getByTestId('settings-account');
  expect(within(account).getByText('admin@ve.test')).toBeOnTheScreen();
  expect(within(account).getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
});

test('log out asks first', async () => {
  const auth = await renderSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
  expect(auth.logout).not.toHaveBeenCalled();
  await answerConfirm('Log out?', 'Log out');
  expect(auth.logout).toHaveBeenCalled();
});

test('reminder times are every 15 minutes and keep an odd saved time', () => {
  expect(reminderTimes('19:00')).toHaveLength(96);
  expect(reminderTimes('18:40')).toContain('18:40');
});
