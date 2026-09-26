// @vitest-environment node
import type { AuthTokens, PublicUser } from '@ve/shared';
import { describe, expect, test, vi } from 'vitest';
import { buildUrl, createApiClient, type FetchLike } from './client';
import { ApiError, NetworkError } from './errors';

const admin: PublicUser = { id: 'a1', role: 'admin', name: 'Asha', phone: null, email: 'asha@example.com', siteId: null };
const tokens = (accessToken: string): AuthTokens => ({ accessToken, user: admin });
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };
  return { fetch, calls };
}

const auth = (call: Call) => (call.init.headers as Record<string, string>).authorization;
const path = (call: Call) => new URL(call.url).pathname;

async function loggedInClient(handler: (call: Call) => Response | Promise<Response>) {
  const f = fakeFetch((call) => (path(call) === '/auth/admin/login' ? json(200, tokens('t1')) : handler(call)));
  const client = createApiClient({ baseUrl: 'http://api.test', fetch: f.fetch });
  await client.login('asha@example.com', 'secret-password');
  return { client, calls: f.calls };
}

describe('buildUrl', () => {
  test('joins base and path, drops empty values, keeps false', () => {
    expect(buildUrl('http://api.test/', '/admin/employees', { q: '', siteId: undefined, isActive: false, page: 2 })).toBe(
      'http://api.test/admin/employees?isActive=false&page=2',
    );
  });
});

test('login asks for a web session and later requests carry the token', async () => {
  const { client, calls } = await loggedInClient(() => json(200, { ok: true }));
  const login = calls[0]!;
  expect(JSON.parse(login.init.body as string)).toEqual({ email: 'asha@example.com', password: 'secret-password', client: 'web' });
  expect(login.init.credentials).toBe('include');
  await client.request('GET', '/admin/settings');
  expect(auth(calls[1]!)).toBe('Bearer t1');
  expect(calls[1]!.init.credentials).toBe('include');
});

test('an expired token is refreshed through the cookie and the request retried', async () => {
  const { client, calls } = await loggedInClient((call) => {
    if (path(call) === '/auth/refresh') return json(200, tokens('t2'));
    return auth(call) === 'Bearer t2' ? json(200, { n: 1 }) : json(401, { code: 'UNAUTHORIZED', message: 'x' });
  });
  await expect(client.request('GET', '/admin/dashboard/today')).resolves.toEqual({ n: 1 });
  const refresh = calls.find((c) => path(c) === '/auth/refresh')!;
  expect(refresh.init.credentials).toBe('include');
  expect(refresh.init.body).toBeUndefined();
});

test('two 401s at once trigger one refresh', async () => {
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => (releaseRefresh = resolve));
  const { client, calls } = await loggedInClient(async (call) => {
    if (path(call) === '/auth/refresh') {
      await refreshGate;
      return json(200, tokens('t2'));
    }
    return auth(call) === 'Bearer t2' ? json(200, { path: path(call) }) : json(401, { code: 'UNAUTHORIZED', message: 'x' });
  });
  const a = client.request('GET', '/admin/dashboard/today');
  const b = client.request('GET', '/admin/attendance');
  await vi.waitFor(() => expect(calls.filter((c) => path(c) === '/auth/refresh')).toHaveLength(1));
  releaseRefresh();
  await expect(Promise.all([a, b])).resolves.toEqual([{ path: '/admin/dashboard/today' }, { path: '/admin/attendance' }]);
  expect(calls.filter((c) => path(c) === '/auth/refresh')).toHaveLength(1);
});

test('refresh rejected ends the session once without a retry loop', async () => {
  const { client, calls } = await loggedInClient((call) =>
    path(call) === '/auth/refresh' ? json(401, { code: 'SESSION_EXPIRED', message: 'x' }) : json(401, { code: 'UNAUTHORIZED', message: 'x' }),
  );
  const lost = vi.fn();
  client.onAuthLost(lost);
  await expect(client.request('GET', '/admin/settings')).rejects.toMatchObject({ status: 401 });
  expect(lost).toHaveBeenCalledTimes(1);
  expect(calls.map(path)).toEqual(['/auth/admin/login', '/admin/settings', '/auth/refresh']);
  // The token is gone: the next request goes out without one and does not refresh again.
  await expect(client.request('GET', '/admin/settings')).rejects.toBeInstanceOf(ApiError);
  expect(auth(calls.at(-1)!)).toBeUndefined();
  expect(lost).toHaveBeenCalledTimes(1);
});

test('ACCOUNT_INACTIVE ends the session', async () => {
  const { client } = await loggedInClient(() => json(403, { code: 'ACCOUNT_INACTIVE', message: 'x' }));
  const lost = vi.fn();
  client.onAuthLost(lost);
  await expect(client.request('GET', '/admin/settings')).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
  expect(lost).toHaveBeenCalledTimes(1);
});

test('restore uses the cookie and returns the user, or null without firing auth lost', async () => {
  const ok = fakeFetch(() => json(200, tokens('t9')));
  await expect(createApiClient({ baseUrl: 'http://api.test', fetch: ok.fetch }).restore()).resolves.toEqual(admin);

  const expired = fakeFetch(() => json(401, { code: 'SESSION_EXPIRED', message: 'x' }));
  const client = createApiClient({ baseUrl: 'http://api.test', fetch: expired.fetch });
  const lost = vi.fn();
  client.onAuthLost(lost);
  await expect(client.restore()).resolves.toBeNull();
  expect(lost).not.toHaveBeenCalled();
});

test('network failure and timeout become NetworkError', async () => {
  const offline = createApiClient({ baseUrl: 'http://api.test', fetch: async () => { throw new TypeError('fetch failed'); } });
  await expect(offline.request('GET', '/admin/settings')).rejects.toEqual(new NetworkError('offline'));
  const slow = createApiClient({
    baseUrl: 'http://api.test',
    fetch: async () => { throw new DOMException('timed out', 'TimeoutError'); },
  });
  await expect(slow.request('GET', '/admin/settings')).rejects.toMatchObject({ reason: 'timeout' });
});

test('logout clears the cookie on the server and forgets the token', async () => {
  const { client, calls } = await loggedInClient(() => json(204));
  const lost = vi.fn();
  client.onAuthLost(lost);
  await client.logout();
  expect(path(calls[1]!)).toBe('/auth/logout');
  expect(calls[1]!.init.credentials).toBe('include');
  await client.request('POST', '/admin/employees/e1/unlock');
  expect(auth(calls[2]!)).toBeUndefined();
  expect(lost).not.toHaveBeenCalled();
});

test('204 resolves to undefined and a POST without a body sends no content type', async () => {
  const { client, calls } = await loggedInClient(() => json(204));
  await expect(client.request('POST', '/admin/employees/e1/unlock')).resolves.toBeUndefined();
  expect((calls[1]!.init.headers as Record<string, string>)['content-type']).toBeUndefined();
});

test('raw requests refresh too', async () => {
  const { client } = await loggedInClient((call) => {
    if (path(call) === '/auth/refresh') return json(200, tokens('t2'));
    return auth(call) === 'Bearer t2' ? new Response('a,b\n', { status: 200 }) : json(401, { code: 'UNAUTHORIZED', message: 'x' });
  });
  const res = await client.requestRaw('GET', '/admin/attendance/export.csv');
  await expect(res.text()).resolves.toBe('a,b\n');
});
