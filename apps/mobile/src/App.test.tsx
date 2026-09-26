import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { DashboardTodayDto, MeTodayResponse } from '@ve/shared';
import { StorageKeys } from './storageKeys';
import { fakeState } from './testing/fakeNative';
import { adminUser, employeeUser } from './testing/render';
import App from './App';

const reply = (status: number, body?: unknown) =>
  ({ status, ok: status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

function server(routes: Record<string, unknown>) {
  globalThis.fetch = jest.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path === '/auth/refresh') return reply(200, { accessToken: 'a2', refreshToken: 'r2', user: employeeUser });
    return path in routes ? reply(200, routes[path]) : reply(404, { code: 'NOT_FOUND', message: path });
  }) as unknown as typeof fetch;
}

function storeSession(user: typeof employeeUser) {
  fakeState.secure.set('refreshToken', 'r1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(user));
}

test('no session → worker login', async () => {
  server({});
  await render(<App />);
  expect(await screen.findByText('Your phone number and PIN')).toBeOnTheScreen();
});

test('a stored employee session opens the worker home', async () => {
  storeSession(employeeUser);
  server({
    '/me/today': { workDate: '2026-09-25', day: null, site: null, missedYesterday: false, maxAccuracyM: 50, reminderTime: '19:00', timezone: 'Asia/Kolkata', serverTime: '2026-09-25T03:00:00Z' } satisfies MeTodayResponse,
  });
  await render(<App />);
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: 'My attendance' })).toBeOnTheScreen();
});

test('a stored admin session opens the admin Today screen, never worker screens', async () => {
  storeSession(adminUser);
  server({
    '/admin/dashboard/today': { workDate: '2026-09-25', activeEmployees: 1, checkedInToday: 0, workingNow: 0, completedToday: 0, notYetIn: 1, missedCheckouts: 0, needsReview: 0, working: [] } satisfies DashboardTodayDto,
  });
  await render(<App />);
  expect(await screen.findByText('Nobody is working right now')).toBeOnTheScreen();
  expect(screen.queryByRole('tab', { name: 'My attendance' })).toBeNull();
});
