import React from 'react';
import { screen } from '@testing-library/react-native';
import type { AdminDayDetailDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { AttendanceDetailScreen } from './AttendanceDetailScreen';

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

test('shows times, distances, flags and every attempt', async () => {
  await renderWithAuth(
    <AttendanceDetailScreen navigation={fakeNavigation() as never} route={{ key: 'k', name: 'AttendanceDetail', params: { id: 'day-1' } } as never} />,
    { api: fakeApi({ getAttendance: jest.fn(async () => detail) }), state: loggedIn(adminUser) },
  );
  expect(await screen.findByText('Ramesh Kale')).toBeOnTheScreen();
  expect(screen.getByText('9:02 AM')).toBeOnTheScreen();
  expect(screen.getByText('6:15 PM')).toBeOnTheScreen();
  expect(screen.getByText('20 m from site, ±12 m')).toBeOnTheScreen();
  expect(screen.getByText('9 h 13 min worked')).toBeOnTheScreen();
  expect(screen.getByText('Fake GPS suspected')).toBeOnTheScreen();
  expect(screen.getByText('Fix the check-out and mark reviewed on the web dashboard')).toBeOnTheScreen();
  expect(screen.getByText('OUTSIDE_SITE')).toBeOnTheScreen();
  expect(screen.getByText('Fake GPS')).toBeOnTheScreen();
});
