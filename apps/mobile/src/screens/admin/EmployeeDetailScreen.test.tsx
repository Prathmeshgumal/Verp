import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { EmployeeDetailDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { addDays } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { EmployeeDetailScreen } from './EmployeeDetailScreen';

const detail: EmployeeDetailDto = {
  id: 'e1',
  name: 'Anil Pawar',
  phone: '+919876543210',
  employeeCode: 'E-7',
  siteId: 's1',
  siteName: 'Plot 7',
  isActive: true,
  lockedUntil: null,
  createdAt: '2026-09-01T00:00:00Z',
  sessions: [{ id: 'x1', deviceId: 'dev', deviceModel: 'Redmi 9A', createdAt: '2026-09-01T00:00:00Z', lastUsedAt: '2026-09-25T03:32:00Z' }],
};

const day = {
  id: 'day-1', workDate: '2026-09-25', siteId: 's1', status: 'COMPLETED' as const, checkInAt: '2026-09-25T03:32:00Z', checkOutAt: '2026-09-25T12:45:00Z',
  workedMinutes: 553, flags: [], needsReview: false, employeeId: 'e1', employeeName: 'Anil Pawar', employeeCode: 'E-7', siteName: 'Plot 7',
  checkInLat: 18.59, checkInLng: 73.73, checkInAccuracyM: 10, checkInDistanceM: 5, checkOutLat: 18.59, checkOutLng: 73.73, checkOutAccuracyM: 10, checkOutDistanceM: 5, reviewedAt: null,
};

async function renderDetail(extra: Parameters<typeof fakeApi>[0] = {}, employee: EmployeeDetailDto = detail) {
  const parent = { navigate: jest.fn() };
  const navigation = { ...fakeNavigation(), getParent: () => parent };
  const api = {
    getEmployee: jest.fn(async () => employee),
    resetPin: jest.fn(async () => ({ pin: '555123' })),
    listSites: jest.fn(async () => [{ id: 's1', name: 'Plot 7', address: null, lat: 18.59, lng: 73.73, radiusM: 100, isActive: true }, { id: 's2', name: 'Yard', address: null, lat: 18.6, lng: 73.7, radiusM: 100, isActive: true }] as never),
    listAttendance: jest.fn(async () => ({ items: [day], total: 1, page: 1, pageSize: 50 })),
    listRefused: jest.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 5 })),
    ...extra,
  };
  await renderWithAuth(
    <EmployeeDetailScreen navigation={navigation as never} route={{ key: 'k', name: 'EmployeeDetail', params: { id: 'e1' } } as never} />,
    { api: fakeApi(api), state: loggedIn(adminUser) },
  );
  await screen.findByText('Anil Pawar');
  return { parent, navigation, api };
}

test('shows the profile, phones used and the last 30 days', async () => {
  const { api } = await renderDetail();
  expect(screen.getByText('Redmi 9A')).toBeOnTheScreen();
  expect(screen.getByText('Active')).toBeOnTheScreen();
  const today = localToday();
  expect(api.listAttendance).toHaveBeenCalledWith({ from: addDays(today, -29), to: today, employeeId: 'e1', page: 1, pageSize: 50 });
  expect(await screen.findByRole('button', { name: 'Fri 25 Sep, Done' })).toBeOnTheScreen();
});

test('a day in the last 30 opens its detail', async () => {
  const { navigation } = await renderDetail();
  await fireEvent.press(await screen.findByRole('button', { name: 'Fri 25 Sep, Done' }));
  expect(navigation.navigate).toHaveBeenCalledWith('AttendanceDetail', { id: 'day-1' });
});

test('reset PIN asks first, then shows the new PIN once', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { api } = await renderDetail();
  await fireEvent.press(screen.getByRole('button', { name: 'Reset PIN' }));
  expect(api.resetPin).not.toHaveBeenCalled();
  await act(async () => alert.mock.calls[0]?.[2]?.[1]?.onPress?.());
  expect(await screen.findByText('555123')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByText('555123')).toBeNull();
});

test('details can be edited and saved', async () => {
  const updateEmployee = jest.fn(async () => detail);
  await renderDetail({ updateEmployee });
  await fireEvent.changeText(screen.getByLabelText('Full name'), 'Anil R Pawar');
  await fireEvent.press(screen.getByRole('button', { name: 'Site: Plot 7' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Yard' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateEmployee).toHaveBeenCalledWith('e1', { name: 'Anil R Pawar', phone: '+919876543210', employeeCode: 'E-7', siteId: 's2' }));
  expect(await screen.findByText('Saved')).toBeOnTheScreen();
});

test('deactivate and log out everywhere ask first', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const updateEmployee = jest.fn(async () => detail);
  const revokeSessions = jest.fn(async () => undefined);
  await renderDetail({ updateEmployee, revokeSessions });
  await fireEvent.press(screen.getByRole('button', { name: 'Deactivate' }));
  expect(updateEmployee).not.toHaveBeenCalled();
  await act(async () => alert.mock.calls[0]?.[2]?.[1]?.onPress?.());
  expect(updateEmployee).toHaveBeenCalledWith('e1', { isActive: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Log out everywhere' }));
  await act(async () => alert.mock.calls[1]?.[2]?.[1]?.onPress?.());
  expect(revokeSessions).toHaveBeenCalledWith('e1');
});

test('a locked employee can be unlocked', async () => {
  const unlockEmployee = jest.fn(async () => undefined);
  await renderDetail({ unlockEmployee }, { ...detail, lockedUntil: new Date(Date.now() + 600_000).toISOString() });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
  await waitFor(() => expect(unlockEmployee).toHaveBeenCalledWith('e1'));
});

test('Open in Attendance shows this employee there', async () => {
  const { parent } = await renderDetail();
  await fireEvent.press(screen.getByRole('button', { name: 'Open in Attendance' }));
  const today = localToday();
  expect(parent.navigate).toHaveBeenCalledWith('AttendanceTab', {
    screen: 'AttendanceList',
    params: { filters: { from: addDays(today, -29), to: today, employeeId: 'e1', employeeName: 'Anil Pawar' } },
  });
});

test('refused attempts from the last 30 days open a map, and See all opens the Refused list', async () => {
  const attempt = {
    id: 'ev1',
    employeeId: 'e1',
    name: 'Anil Pawar',
    siteId: 's1',
    siteName: 'Plot 7',
    workDate: '2026-09-22',
    type: 'OUT' as const,
    result: 'OUTSIDE_SITE' as const,
    serverTime: '2026-09-22T12:40:00Z',
    lat: 18.6,
    lng: 73.75,
    accuracyM: 9,
    distanceM: 340,
  };
  const listRefused = jest.fn(async () => ({ items: [attempt], total: 8, page: 1, pageSize: 5 }));
  const { parent } = await renderDetail({ listRefused });
  expect(await screen.findByText('Check-out refused · outside the site')).toBeOnTheScreen();
  expect(listRefused).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'e1', page: 1, pageSize: 5 }));
  expect(screen.getByText('340 m from Plot 7')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'See all' }));
  expect(parent.navigate).toHaveBeenCalledWith('AttendanceTab', {
    screen: 'AttendanceList',
    params: { filters: expect.objectContaining({ employeeId: 'e1', employeeName: 'Anil Pawar' }), view: 'refused' },
  });

  await fireEvent.press(screen.getByRole('button', { name: /Tue 22 Sep.*Show on map/ }));
  expect(await screen.findByTestId('refused-map')).toBeOnTheScreen();
});
