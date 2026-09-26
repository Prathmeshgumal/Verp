import React from 'react';
import { screen } from '@testing-library/react-native';
import type { DayDto, MeTodayResponse } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { renderWithAuth } from '../../testing/render';
import { HistoryScreen } from './HistoryScreen';

const today = { workDate: '2026-09-25' } as MeTodayResponse;
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

test('lists the last 30 days with times, hours, missed and absent days', async () => {
  const myAttendance = jest.fn(async () => [
    day('2026-09-25', 'COMPLETED', '2026-09-25T12:45:00Z', 553),
    day('2026-09-24', 'MISSED_CHECKOUT', null, null),
  ]);
  await renderWithAuth(<HistoryScreen />, { api: fakeApi({ today: jest.fn(async () => today), myAttendance }) });
  expect(await screen.findByText('Today, Fri 25')).toBeOnTheScreen();
  expect(screen.getByText('9:02 – 6:15')).toBeOnTheScreen();
  expect(screen.getByText('9h 13m')).toBeOnTheScreen();
  expect(screen.getByText('Thu 24')).toBeOnTheScreen();
  expect(screen.getByText('No check-out · 9:02 – ?')).toBeOnTheScreen();
  expect(screen.getAllByText('Not present').length).toBeGreaterThan(0);
  expect(myAttendance).toHaveBeenCalledWith('2026-08-27', '2026-09-25');
});
