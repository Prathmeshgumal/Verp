import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthTokens } from '@ve/shared';
import { createApiClient, type FetchLike } from '../api/client';
import { createApi } from '../api/endpoints';
import { secureTokenStore } from '../api/tokenStore';
import { fakeState } from '../testing/fakeNative';
import { employeeUser } from '../testing/render';
import { StorageKeys } from '../storageKeys';
import { AuthProvider, useAuth, type AuthContextValue } from './AuthContext';

const tokens: AuthTokens = { accessToken: 'access-1', refreshToken: 'refresh-1', user: employeeUser };

async function setup(fetchImpl: FetchLike) {
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: secureTokenStore, fetchImpl });
  const api = createApi(client);
  let ctx: AuthContextValue | null = null;
  function Probe() {
    ctx = useAuth();
    const s = ctx.state;
    return <Text testID="state">{s.status === 'loggedOut' ? `loggedOut:${s.reason ?? ''}` : s.status}</Text>;
  }
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider client={client} api={api}>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { api, auth: () => ctx as unknown as AuthContextValue };
}

const reply = (status: number, body?: unknown) =>
  ({ status, ok: status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

test('with nothing stored the app starts logged out', async () => {
  await setup(async () => reply(500));
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:'));
});

test('a stored session starts logged in without any network call', async () => {
  fakeState.secure.set('refreshToken', 'refresh-1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(employeeUser));
  const fetchImpl = jest.fn<Promise<Response>, Parameters<FetchLike>>();
  await setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedIn'));
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('employee login sends the device id and keeps the session', async () => {
  const fetchImpl = jest.fn<Promise<Response>, Parameters<FetchLike>>(async () => reply(200, tokens));
  const { auth } = await setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:'));
  await act(() => auth().loginEmployee('98765 43210', '123456'));
  expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string)).toEqual({
    phone: '98765 43210',
    pin: '123456',
    deviceId: 'device-1',
    deviceModel: 'Test Phone',
  });
  expect(screen.getByTestId('state')).toHaveTextContent('loggedIn');
  expect(fakeState.secure.get('refreshToken')).toBe('refresh-1');
  expect(JSON.parse(fakeState.prefs.get(StorageKeys.user) ?? 'null')).toEqual(employeeUser);
});

test('auth loss returns to login with the reason', async () => {
  fakeState.secure.set('refreshToken', 'refresh-1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(employeeUser));
  fakeState.prefs.set(StorageKeys.pendingAction, '{"key":"k","action":"checkIn","workDate":"2026-09-25"}');
  fakeState.reminders = [{ workDate: '2026-09-25', reminderTime: '19:00', timezone: 'Asia/Kolkata', title: 't', body: 'b' }];
  const fetchImpl: FetchLike = async (url) =>
    url.endsWith('/auth/refresh') ? reply(200, tokens) : reply(403, { code: 'ACCOUNT_INACTIVE', message: 'inactive' });
  const { api } = await setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedIn'));

  await act(async () => {
    await expect(api.today()).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
  });

  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:ACCOUNT_INACTIVE'));
  expect(fakeState.secure.has('refreshToken')).toBe(false);
  expect(fakeState.prefs.has(StorageKeys.user)).toBe(false);
  expect(fakeState.prefs.has(StorageKeys.pendingAction)).toBe(false);
  expect(fakeState.reminders).toEqual([]);
});

test('logout clears the phone even when the server cannot be reached', async () => {
  fakeState.secure.set('refreshToken', 'refresh-1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(employeeUser));
  const fetchImpl = jest.fn<Promise<Response>, Parameters<FetchLike>>(async () => {
    throw new TypeError('Network request failed');
  });
  const { auth } = await setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedIn'));
  await act(() => auth().logout());
  expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.test/auth/logout');
  expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:');
  expect(fakeState.secure.has('refreshToken')).toBe(false);
});
