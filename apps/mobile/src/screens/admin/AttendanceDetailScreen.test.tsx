import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { AdminDayDetailDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, loggedIn, renderWithAuth } from '../../testing/render';
import { AttendanceDetailScreen, checkoutIso } from './AttendanceDetailScreen';

const detail: AdminDayDetailDto = {
  day: {
    id: 'day-1',
    workDate: '2026-09-25',
    siteId: 's1',
    status: 'COMPLETED',
    checkInAt: '2026-09-25T03:32:00Z',
    checkOutAt: '2026-09-25T12:45:00Z',
    workedMinutes: 553,
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
    checkOutLat: 18.59,
    checkOutLng: 73.73,
    checkOutAccuracyM: 9,
    checkOutDistanceM: 31,
    reviewedAt: null,
  },
  site: { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100 },
  events: [
    { id: 'ev1', type: 'IN', result: 'OUTSIDE_SITE', serverTime: '2026-09-25T03:30:00Z', deviceTime: null, lat: 18.6, lng: 73.7, accuracyM: 15, distanceM: 140, isMock: false, deviceId: 'd', deviceModel: 'M', appVersion: '0.1.0' },
    { id: 'ev2', type: 'IN', result: 'OK', serverTime: '2026-09-25T03:32:00Z', deviceTime: null, lat: 18.59, lng: 73.73, accuracyM: 11, distanceM: 20, isMock: true, deviceId: 'd', deviceModel: 'M', appVersion: '0.1.0' },
  ],
};

const route = { params: { id: 'day-1' } };

async function renderDetail(overrides: Parameters<typeof fakeApi>[0] = {}) {
  const api = fakeApi({ getAttendance: jest.fn(async () => detail), ...overrides });
  await renderWithAuth(<AttendanceDetailScreen route={route} />, { api, state: loggedIn(adminUser) });
  await screen.findByText('Ramesh Kale');
  return api;
}

test('shows times, distances, flags and every attempt', async () => {
  await renderDetail();
  expect(screen.getByText('9:02 AM')).toBeOnTheScreen();
  expect(screen.getByText('6:15 PM')).toBeOnTheScreen();
  expect(screen.getByText('20 m from site, ±12 m')).toBeOnTheScreen();
  expect(screen.getByText('9 h 13 min worked')).toBeOnTheScreen();
  expect(screen.getByText('Fake GPS suspected')).toBeOnTheScreen();
  expect(screen.getByText('OUTSIDE_SITE')).toBeOnTheScreen();
  expect(screen.getByText('Fake GPS')).toBeOnTheScreen();
});

test('a day that needs review can be marked reviewed', async () => {
  const markReviewed = jest.fn(async () => detail.day);
  await renderDetail({ markReviewed });
  await fireEvent.press(screen.getByRole('button', { name: 'Mark reviewed' }));
  await waitFor(() => expect(markReviewed).toHaveBeenCalledWith('day-1'));
  expect(await screen.findByText('Marked reviewed')).toBeOnTheScreen();
});

test('the check-out can be fixed with a time and a reason', async () => {
  const fixCheckout = jest.fn(async () => detail.day);
  await renderDetail({ fixCheckout });
  await fireEvent.press(screen.getByRole('button', { name: 'Fix check-out' }));
  await fireEvent.changeText(screen.getByLabelText('Check-out time'), '19:05');
  await fireEvent.press(screen.getByRole('button', { name: 'Save check-out' }));
  expect(screen.getByText('Say why, in a few words')).toBeOnTheScreen();
  expect(fixCheckout).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Reason'), 'Supervisor confirmed');
  await fireEvent.press(screen.getByRole('button', { name: 'Save check-out' }));
  await waitFor(() => expect(fixCheckout).toHaveBeenCalledWith('day-1', { checkOutAt: '2026-09-25T19:05:00.000+05:30', reason: 'Supervisor confirmed' }));
  expect(await screen.findByText('Check-out fixed')).toBeOnTheScreen();
});

test('a still-open day cannot be fixed yet', async () => {
  await renderDetail({ getAttendance: jest.fn(async () => ({ ...detail, day: { ...detail.day, status: 'CHECKED_IN' as const, checkOutAt: null } })) });
  expect(screen.queryByRole('button', { name: 'Fix check-out' })).toBeNull();
  expect(screen.getByText('Still checked in. The check-out can be fixed once the day is closed.')).toBeOnTheScreen();
});

test('check-out times must look like 18:30', () => {
  expect(checkoutIso('2026-09-25', '7:5')).toBeNull();
  expect(checkoutIso('2026-09-25', '25:00')).toBeNull();
  expect(checkoutIso('2026-09-25', '7:05')).toBe('2026-09-25T07:05:00.000+05:30');
});
