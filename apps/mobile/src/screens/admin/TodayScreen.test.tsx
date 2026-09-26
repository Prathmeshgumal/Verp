import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { DashboardTodayDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, loggedIn, renderWithAuth } from '../../testing/render';
import { TodayScreen } from './TodayScreen';

const dashboard: DashboardTodayDto = {
  workDate: '2026-09-25',
  activeEmployees: 47,
  checkedInToday: 33,
  workingNow: 31,
  completedToday: 2,
  notYetIn: 14,
  missedCheckouts: 1,
  needsReview: 3,
  working: [{ employeeId: 'e1', name: 'Ramesh Kale', siteName: 'Plot 7', checkInAt: '2026-09-25T03:32:00Z' }],
};

test('shows the day counts and who is working', async () => {
  await renderWithAuth(<TodayScreen />, { api: fakeApi({ dashboard: jest.fn(async () => dashboard) }), state: loggedIn(adminUser) });
  expect(await screen.findByText('31')).toBeOnTheScreen();
  expect(screen.getByText('Not yet in')).toBeOnTheScreen();
  expect(screen.getByText('14')).toBeOnTheScreen();
  expect(screen.getByText('Checked in 33 · Missed check-outs 1 · Active 47')).toBeOnTheScreen();
  expect(screen.getByText('Ramesh Kale')).toBeOnTheScreen();
  expect(screen.getByText('Plot 7 · since 9:02 AM')).toBeOnTheScreen();
  expect(screen.getByText('RK')).toBeOnTheScreen();
});

test('log out asks first', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { auth } = await renderWithAuth(<TodayScreen />, {
    api: fakeApi({ dashboard: jest.fn(async () => dashboard) }),
    state: loggedIn(adminUser),
  });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
  await act(async () => alert.mock.calls[0]?.[2]?.[1]?.onPress?.());
  expect(auth.logout).toHaveBeenCalled();
});
