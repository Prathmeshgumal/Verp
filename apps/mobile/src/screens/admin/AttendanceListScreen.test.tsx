import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { AdminDayDto, Paginated } from '@ve/shared';
import { addDays } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { fakeApi } from '../../testing/fakeApi';
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

async function renderList(params?: { employeeId?: string; employeeName?: string }) {
  const listAttendance = jest.fn(async () => page([row]));
  const navigation = { ...fakeNavigation(), setParams: jest.fn() };
  await renderWithAuth(<AttendanceListScreen navigation={navigation as never} route={{ key: 'k', name: 'AttendanceList', params } as never} />, {
    api: fakeApi({ listAttendance }),
    state: loggedIn(adminUser),
  });
  return { listAttendance, navigation };
}

test('shows one day, and the arrows move the day', async () => {
  const { listAttendance } = await renderList();
  const today = localToday();
  expect(await screen.findByText('Ramesh Kale')).toBeOnTheScreen();
  expect(screen.getByText('Working')).toBeOnTheScreen();
  expect(screen.getByText('Review')).toBeOnTheScreen();
  expect(listAttendance).toHaveBeenCalledWith({ from: today, to: today, page: 1, pageSize: 50 });

  await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
  const yesterday = addDays(today, -1);
  await waitFor(() => expect(listAttendance).toHaveBeenCalledWith({ from: yesterday, to: yesterday, page: 1, pageSize: 50 }));
});

test('tapping a row opens its detail', async () => {
  const { navigation } = await renderList();
  await fireEvent.press(await screen.findByRole('button', { name: /Ramesh Kale/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('AttendanceDetail', { id: 'day-1' });
});

test('an employee filter shows the last 30 days and can be cleared', async () => {
  const { listAttendance, navigation } = await renderList({ employeeId: 'e1', employeeName: 'Ramesh Kale' });
  const today = localToday();
  expect(await screen.findByText('Employee: Ramesh Kale')).toBeOnTheScreen();
  expect(listAttendance).toHaveBeenCalledWith({ from: addDays(today, -29), to: today, employeeId: 'e1', page: 1, pageSize: 50 });
  await fireEvent.press(screen.getByRole('button', { name: 'Clear filter' }));
  expect(navigation.setParams).toHaveBeenCalledWith({ employeeId: undefined, employeeName: undefined });
});

test('more pages load on request', async () => {
  const listAttendance = jest
    .fn(async () => page([row]))
    .mockResolvedValueOnce({ items: [row], total: 2, page: 1, pageSize: 1 })
    .mockResolvedValueOnce({ items: [{ ...row, id: 'day-2', employeeName: 'Sunita Jadhav' }], total: 2, page: 2, pageSize: 1 });
  await renderWithAuth(
    <AttendanceListScreen navigation={fakeNavigation() as never} route={{ key: 'k', name: 'AttendanceList' } as never} />,
    { api: fakeApi({ listAttendance }), state: loggedIn(adminUser) },
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  expect(await screen.findByText('Sunita Jadhav')).toBeOnTheScreen();
});
