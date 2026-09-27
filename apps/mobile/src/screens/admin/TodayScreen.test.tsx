import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import type { DashboardTodayDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { formatDistance } from './refused';
import { TodayScreen } from './TodayScreen';

const mapDay = { employeeId: 'e1', name: 'Ramesh Kale', siteId: 's1', siteName: 'Plot 7', status: 'CHECKED_IN' as const, checkInAt: '2026-09-25T03:32:00Z', checkOutAt: null, checkInLat: 18.59, checkInLng: 73.73, needsReview: false };
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
  mapDays: [
    { ...mapDay, dayId: 'd1' },
    { ...mapDay, dayId: 'd2', employeeId: 'e2', name: 'Amol Patil' },
  ],
  refused: [
    { id: 'ev9', employeeId: 'e3', name: 'Sunil More', siteId: 's1', siteName: 'Plot 7', type: 'IN', result: 'OUTSIDE_SITE', serverTime: '2026-09-25T04:10:00Z', lat: 18.6, lng: 73.75, accuracyM: 10, distanceM: 1500 },
  ],
};

async function renderToday() {
  const navigation = { ...fakeNavigation(), getParent: jest.fn() };
  const parent = { navigate: jest.fn() };
  navigation.getParent.mockReturnValue(parent);
  await renderWithAuth(<TodayScreen navigation={navigation as never} route={{ key: 'k', name: 'Today' } as never} />, {
    api: fakeApi({ dashboard: jest.fn(async () => dashboard), listSites: jest.fn(async () => []) }),
    state: loggedIn(adminUser),
  });
  await screen.findByText('Today');
  return { navigation, parent };
}

test('shows every count from the web dashboard', async () => {
  await renderToday();
  for (const label of ['Working now: 31', 'Checked in: 33', 'Completed: 2', 'Not yet in: 14', 'Missed check-outs: 1', 'Needs review: 3', 'Refused today: 1', 'Active employees: 47']) {
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  }
});

test('who is working opens their day', async () => {
  const { navigation } = await renderToday();
  expect(screen.getByText('Plot 7 · since 9:02 AM')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Ramesh Kale' }));
  expect(navigation.navigate).toHaveBeenCalledWith('AttendanceDetail', { id: 'd1' });
});

test('refused attempts show why and how far away', async () => {
  await renderToday();
  expect(screen.getByText('Refused attempts')).toBeOnTheScreen();
  expect(screen.getByText('Check-in refused · outside the site')).toBeOnTheScreen();
  expect(screen.getByText('1.5 km from Plot 7 · 9:40 AM')).toBeOnTheScreen();
});

test('tapping a refused attempt shows where the phone was on a map', async () => {
  await renderToday();
  expect(screen.queryByTestId('refused-map')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sunil More, Show on map' }));
  expect(await screen.findByTestId('refused-map')).toBeOnTheScreen();
  expect(screen.getByText('±10 m')).toBeOnTheScreen();
  expect(screen.getByText('1.5 km')).toBeOnTheScreen();
});

test('missed check-outs and review counts open the filtered attendance list', async () => {
  const { parent } = await renderToday();
  await fireEvent.press(screen.getByRole('button', { name: 'Missed check-outs: 1' }));
  expect(parent.navigate).toHaveBeenCalledWith('AttendanceTab', {
    screen: 'AttendanceList',
    params: { filters: { from: '2020-01-01', to: '2026-09-25', status: 'MISSED_CHECKOUT' } },
  });
});

test('distances read in metres, then kilometres', () => {
  expect(formatDistance(340.4)).toBe('340 m');
  expect(formatDistance(1500)).toBe('1.5 km');
});

test('a tag for two people at one spot lists them; tapping one opens their day', async () => {
  const { navigation } = await renderToday();
  await fireEvent(screen.getByTestId('today-map'), 'message', { nativeEvent: { data: JSON.stringify({ type: 'tag', key: 'd1' }) } });
  expect(await screen.findByText('2 people here')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Amol Patil' }));
  expect(navigation.navigate).toHaveBeenCalledWith('AttendanceDetail', { id: 'd2' });
});
