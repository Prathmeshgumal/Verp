import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { AdminDayDto, Paginated } from '@ve/shared';
import { addDays } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { fakeApi } from '../../testing/fakeApi';
import { fakeState } from '../../testing/fakeNative';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { AttendanceListScreen } from './AttendanceListScreen';

const row: AdminDayDto = {
  id: 'day-1',
  workDate: '2026-09-25',
  siteId: 's1',
  status: 'CHECKED_IN',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  workedMinutes: null,
  flags: ['MOCK_LOCATION'],
  needsReview: true,
  employeeId: 'e1',
  employeeName: 'Ramesh Kale',
  employeeCode: 'E-12',
  siteName: 'Plot 7',
  checkInLat: 18.59,
  checkInLng: 73.73,
  checkInAccuracyM: 12,
  checkInDistanceM: 20,
  checkOutLat: null,
  checkOutLng: null,
  checkOutAccuracyM: null,
  checkOutDistanceM: null,
  reviewedAt: null,
};
const page = (items: AdminDayDto[], total = items.length): Paginated<AdminDayDto> => ({ items, total, page: 1, pageSize: 50 });

const sites = [{ id: 's1', name: 'Plot 7', address: null, lat: 18.59, lng: 73.73, radiusM: 100, isActive: true }];

async function renderList(filters?: object, extra: Parameters<typeof fakeApi>[0] = {}) {
  const listAttendance = jest.fn(async () => page([row]));
  const navigation = { ...fakeNavigation(), setParams: jest.fn() };
  const api = fakeApi({ listAttendance, listEmployees: jest.fn(async () => []), listSites: jest.fn(async () => sites as never), ...extra });
  await renderWithAuth(
    <AttendanceListScreen navigation={navigation as never} route={{ key: 'k', name: 'AttendanceList', params: filters ? { filters } : undefined } as never} />,
    { api, state: loggedIn(adminUser) },
  );
  // The list waits for three queries; under a full parallel run that can take over the default second.
  await screen.findAllByText('Ramesh Kale', {}, { timeout: 5000 });
  return { listAttendance, navigation, api };
}

test('shows today by default, with status and review badges', async () => {
  const { listAttendance } = await renderList();
  const today = localToday();
  expect(screen.getByText('Working')).toBeOnTheScreen();
  expect(screen.getByText('Review')).toBeOnTheScreen();
  expect(listAttendance).toHaveBeenCalledWith({ from: today, to: today, page: 1, pageSize: 50 });
});

test('tapping a row opens its detail', async () => {
  const { navigation } = await renderList();
  await fireEvent.press(screen.getByRole('button', { name: /Ramesh Kale, Working/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('AttendanceDetail', { id: 'day-1' });
});

test('filters from a link are used, and the employee name is not sent', async () => {
  const today = localToday();
  const { listAttendance } = await renderList({ from: addDays(today, -29), to: today, employeeId: 'e1', employeeName: 'Ramesh Kale' });
  expect(listAttendance).toHaveBeenCalledWith({ from: addDays(today, -29), to: today, employeeId: 'e1', page: 1, pageSize: 50 });
  expect(screen.getByRole('button', { name: 'Employee: Ramesh Kale' })).toBeOnTheScreen();
});

test('site, status and needs-review filters change the query', async () => {
  const { listAttendance } = await renderList();
  await fireEvent.press(screen.getByRole('button', { name: 'Site: All sites' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Plot 7' }));
  await waitFor(() => expect(listAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ siteId: 's1' })));
  await fireEvent.press(screen.getByRole('button', { name: 'Status: Any status' }));
  await fireEvent.press(screen.getByRole('button', { name: 'No check-out' }));
  await waitFor(() => expect(listAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'MISSED_CHECKOUT' })));
  await fireEvent.press(screen.getByRole('switch', { name: 'Needs review' }));
  await waitFor(() => expect(listAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ needsReview: true })));
});

test('export shares a CSV of the current filters', async () => {
  const exportAttendanceCsv = jest.fn(async () => 'Employee Code\n');
  await renderList(undefined, { exportAttendanceCsv });
  const today = localToday();
  await fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => expect(fakeState.shared).toHaveLength(1));
  expect(exportAttendanceCsv).toHaveBeenCalledWith({ from: today, to: today });
  expect(fakeState.shared[0]).toEqual({ fileName: `attendance_${today}_${today}.csv`, content: 'Employee Code\n', mimeType: 'text/csv' });
});

test('more pages load on request', async () => {
  const listAttendance = jest
    .fn(async () => page([row]))
    .mockResolvedValueOnce({ items: [row], total: 2, page: 1, pageSize: 1 })
    .mockResolvedValueOnce({ items: [{ ...row, id: 'day-2', employeeName: 'Sunita Jadhav' }], total: 2, page: 2, pageSize: 1 });
  await renderWithAuth(
    <AttendanceListScreen navigation={{ ...fakeNavigation(), setParams: jest.fn() } as never} route={{ key: 'k', name: 'AttendanceList' } as never} />,
    { api: fakeApi({ listAttendance, listEmployees: jest.fn(async () => []), listSites: jest.fn(async () => []) }), state: loggedIn(adminUser) },
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  expect(await screen.findByText('Sunita Jadhav')).toBeOnTheScreen();
});

const refusedAttempt = {
  id: 'ev1',
  employeeId: 'e1',
  name: 'Ramesh Kale',
  siteId: 's1',
  siteName: 'Plot 7',
  workDate: '2026-09-22',
  type: 'IN' as const,
  result: 'LOW_ACCURACY' as const,
  serverTime: '2026-09-22T03:40:00Z',
  lat: 18.6,
  lng: 73.75,
  accuracyM: 80,
  distanceM: null,
};

test('the Refused tab lists earlier refused attempts with the same dates and people', async () => {
  const listRefused = jest.fn(async () => ({ items: [refusedAttempt], total: 1, page: 1, pageSize: 50 }));
  const { listAttendance } = await renderList({ from: '2026-09-01', to: '2026-09-25', employeeId: 'e1' }, { listRefused });
  await fireEvent.press(screen.getByRole('tab', { name: 'Refused' }));
  expect(await screen.findByText('1 refused attempt')).toBeOnTheScreen();
  expect(listRefused).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-25', employeeId: 'e1', siteId: undefined, page: 1, pageSize: 50 });
  expect(screen.getByText('Check-in refused · location not accurate enough')).toBeOnTheScreen();
  expect(screen.getByText('accuracy ±80 m · Tue 22 Sep · 9:10 AM')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  expect(listAttendance).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Ramesh Kale, Show on map' }));
  expect(await screen.findByTestId('refused-map')).toBeOnTheScreen();
});
