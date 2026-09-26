import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { MeTodayResponse } from '@ve/shared';
import { fakeApi } from '../testing/fakeApi';
import { renderWithAuth } from '../testing/render';
import { WorkerNavigator } from './WorkerNavigator';

test('two tabs: Home and My attendance', async () => {
  const api = fakeApi({
    today: jest.fn(async () => ({ workDate: '2026-09-25', site: null, day: null, missedYesterday: false }) as MeTodayResponse),
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
  expect(await screen.findByText('Last 30 days')).toBeOnTheScreen();
});
