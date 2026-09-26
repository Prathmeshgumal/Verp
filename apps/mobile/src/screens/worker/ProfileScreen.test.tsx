import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { MeTodayResponse } from '@ve/shared';
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
  const alert = jest.spyOn(Alert, 'alert');
  const { auth } = await renderWithAuth(<ProfileScreen />, { api: fakeApi({ today: jest.fn(async () => today) }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
  const buttons = alert.mock.calls[0]?.[2] ?? [];
  expect(auth.logout).not.toHaveBeenCalled();
  await act(async () => buttons[1]?.onPress?.());
  expect(auth.logout).toHaveBeenCalled();
});
