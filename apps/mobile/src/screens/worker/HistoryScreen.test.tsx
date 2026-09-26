import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import type { DayDto, MeTodayResponse } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { renderWithAuth } from '../../testing/render';
import { HistoryScreen } from './HistoryScreen';

const today = { workDate: '2026-09-25', joinedOn: '2026-09-10' } as MeTodayResponse;
const day = (workDate: string, status: DayDto['status'], out: string | null, minutes: number | null): DayDto => ({
  id: workDate,
  workDate,
  siteId: 's1',
  status,
  checkInAt: `${workDate}T03:32:00Z`,
  checkOutAt: out,
  workedMinutes: minutes,
  flags: [],
  needsReview: false,
});

async function render(myAttendance = jest.fn(async () => [day('2026-09-24', 'COMPLETED', '2026-09-24T12:45:00Z', 553), day('2026-09-23', 'MISSED_CHECKOUT', null, null)])) {
  await renderWithAuth(<HistoryScreen />, { api: fakeApi({ today: jest.fn(async () => today), myAttendance }) });
  await screen.findByRole('button', { name: 'Thu 24, Done' });
  return myAttendance;
}

test('shows this month as a calendar, fetched from the 1st to today', async () => {
  const myAttendance = await render();
  expect(screen.getByText('September 2026')).toBeOnTheScreen();
  expect(myAttendance).toHaveBeenCalledWith('2026-09-01', '2026-09-25');
  expect(screen.getByRole('button', { name: 'Wed 23, No check-out' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Tue 22, Absent' })).toBeOnTheScreen();
});

test('days before the worker joined are not marked absent', async () => {
  await render();
  expect(screen.getByRole('button', { name: 'Wed 9' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Wed 9' }));
  expect(screen.getByText('Before you joined')).toBeOnTheScreen();
});

test('the summary counts the month, and tapping a day shows its times', async () => {
  await render();
  // 10–24 Sep: 2 present, 13 absent, 1 without check-out.
  expect(screen.getByLabelText('Absent: 13')).toBeOnTheScreen();
  expect(screen.getByLabelText('Present: 2')).toBeOnTheScreen();
  expect(screen.getByLabelText('No check-out: 1')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Thu 24, Done' }));
  expect(screen.getByText('9:02 – 6:15')).toBeOnTheScreen();
  expect(screen.getByText('9h 13m')).toBeOnTheScreen();
});

test('months go back to the joining month and not past this month', async () => {
  const myAttendance = await render();
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  expect(myAttendance).toHaveBeenCalledTimes(1);
});

test('an earlier month can be opened when the worker joined before it', async () => {
  const myAttendance = jest.fn(async () => []);
  await renderWithAuth(<HistoryScreen />, { api: fakeApi({ today: jest.fn(async () => ({ ...today, joinedOn: '2026-07-15' })), myAttendance }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'Previous month' }));
  expect(await screen.findByText('August 2026')).toBeOnTheScreen();
  expect(myAttendance).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31');
});
