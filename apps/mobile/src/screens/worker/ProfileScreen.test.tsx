import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import type { MeTodayResponse } from '@ve/shared';
import { answerConfirm } from '../../testing/confirm';
import { fakeApi } from '../../testing/fakeApi';
import { renderWithAuth } from '../../testing/render';
import { ProfileScreen } from './ProfileScreen';

const today = {
  workDate: '2026-09-25',
  site: { id: 's1', name: 'Plot 7, Hinjewadi', lat: 18.59, lng: 73.73, radiusM: 150 },
  joinedOn: '2026-09-10',
} as MeTodayResponse;

test('shows the worker, their site and when they joined', async () => {
  await renderWithAuth(<ProfileScreen />, { api: fakeApi({ today: jest.fn(async () => today) }) });
  expect(await screen.findByText('Plot 7, Hinjewadi')).toBeOnTheScreen();
  expect(screen.getByText('10 September 2026')).toBeOnTheScreen();
});

test('Log out asks first, then logs out', async () => {
  const { auth } = await renderWithAuth(<ProfileScreen />, { api: fakeApi({ today: jest.fn(async () => today) }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
  expect(screen.getByText('You will need your phone number and PIN to log in again.')).toBeOnTheScreen();
  expect(auth.logout).not.toHaveBeenCalled();
  await answerConfirm('Log out?', 'Log out');
  expect(auth.logout).toHaveBeenCalled();
});

test('Cancel in the dialog keeps you logged in', async () => {
  const { auth } = await renderWithAuth(<ProfileScreen />, { api: fakeApi({ today: jest.fn(async () => today) }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
  await answerConfirm('Log out?', 'Cancel');
  expect(auth.logout).not.toHaveBeenCalled();
  expect(screen.queryByRole('header', { name: 'Log out?' })).toBeNull();
});
