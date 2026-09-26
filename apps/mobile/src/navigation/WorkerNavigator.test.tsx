import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { MeTodayResponse } from '@ve/shared';
import { fakeApi } from '../testing/fakeApi';
import { renderWithAuth } from '../testing/render';
import { WorkerNavigator } from './WorkerNavigator';

test('three tabs: Home, My attendance and Profile', async () => {
  const api = fakeApi({
    today: jest.fn(async () => ({ workDate: '2026-09-25', site: null, day: null, missedYesterday: false, joinedOn: '2026-09-01' }) as MeTodayResponse),
    myAttendance: jest.fn(async () => []),
  });
  await renderWithAuth(
    <NavigationContainer>
      <WorkerNavigator />
    </NavigationContainer>,
    { api },
  );
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'My attendance' }));
  expect(await screen.findByText('September 2026')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  expect(await screen.findByRole('button', { name: 'Log out' })).toBeOnTheScreen();
});
