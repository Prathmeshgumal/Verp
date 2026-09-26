import type { AuthTokens } from '@ve/shared';
import { createApiClient, type FetchLike, type TokenStore } from './client';
import { ApiError, NetworkError } from './errors';

type Req = { method: string; url: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body?: unknown };

function makeFetch(handler: (req: Req, signal?: AbortSignal | null) => Reply | Promise<Reply>) {
  const calls: Req[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const req: Req = {
      method: init.method ?? 'GET',
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(req);
    const reply = await handler(req, init.signal);
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      text: async () => (reply.body === undefined ? '' : JSON.stringify(reply.body)),
    } as Response;
  };
  return { fetchImpl, calls };
}

function memoryStore(initial: string | null = null): TokenStore & { value: string | null } {
  const store = {
    value: initial,
    getRefreshToken: async () => store.value,
    setRefreshToken: async (token: string | null) => {
      store.value = token;
    },
  };
  return store;
}

const tokens = (n: number): AuthTokens => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  user: { id: 'u1', role: 'employee', name: 'Anil', phone: '+919876543210', email: null, siteId: null },
});

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const refreshCalls = (calls: Req[]) => calls.filter((c) => c.url.endsWith('/auth/refresh')).length;

/** Server where only `validAccess` is accepted and `refresh-1` rotates to tokens(2). */
function server(validAccess = 'access-2') {
  return makeFetch(async (req) => {
    if (req.url.endsWith('/auth/refresh')) {
      await delay(5);
      return (req.body as { refreshToken: string }).refreshToken === 'refresh-1'
        ? { status: 200, body: tokens(2) }
        : { status: 401, body: { code: 'SESSION_EXPIRED', message: 'Please log in again' } };
    }
    return req.headers.Authorization === `Bearer ${validAccess}`
      ? { status: 200, body: { ok: true, url: req.url } }
      : { status: 401, body: { code: 'UNAUTHORIZED', message: 'Login required' } };
  });
}

test('sends JSON with the bearer token and builds the query string', async () => {
  const { fetchImpl, calls } = server('access-1');
  const client = createApiClient({ baseUrl: 'http://api.test/', tokenStore: memoryStore(), fetchImpl });
  await client.startSession(tokens(1));
  await client.request('POST', '/x', { body: { a: 1 }, query: { from: '2026-09-01', skip: undefined } });
  expect(calls[0]).toMatchObject({
    method: 'POST',
    url: 'http://api.test/x?from=2026-09-01',
    body: { a: 1 },
    headers: { Authorization: 'Bearer access-1', 'Content-Type': 'application/json' },
  });
});

test('4xx becomes ApiError with the server code', async () => {
  const { fetchImpl } = makeFetch(() => ({ status: 404, body: { code: 'NOT_FOUND', message: 'nope' } }));
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore(), fetchImpl });
  const err = await client.request('GET', '/x', { auth: false }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 404, code: 'NOT_FOUND' });
});

test('5xx, connection failure and timeout become NetworkError', async () => {
  const s500 = makeFetch(() => ({ status: 502 }));
  await expect(
    createApiClient({ baseUrl: 'http://a', tokenStore: memoryStore(), fetchImpl: s500.fetchImpl }).request('GET', '/x', { auth: false }),
  ).rejects.toMatchObject({ name: 'NetworkError', reason: 'server' });

  const offline: FetchLike = async () => {
    throw new TypeError('Network request failed');
  };
  await expect(
    createApiClient({ baseUrl: 'http://a', tokenStore: memoryStore(), fetchImpl: offline }).request('GET', '/x', { auth: false }),
  ).rejects.toMatchObject({ reason: 'offline' });

  const hang: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
  const err = await createApiClient({ baseUrl: 'http://a', tokenStore: memoryStore(), fetchImpl: hang, timeoutMs: 20 })
    .request('GET', '/x', { auth: false })
    .catch((e: unknown) => e);
  expect(err).toBeInstanceOf(NetworkError);
  expect(err).toMatchObject({ reason: 'timeout' });
});

test('with no access token it refreshes first and stores the rotated refresh token', async () => {
  const { fetchImpl, calls } = server();
  const store = memoryStore('refresh-1');
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  await expect(client.request('GET', '/me')).resolves.toMatchObject({ ok: true });
  expect(refreshCalls(calls)).toBe(1);
  expect(store.value).toBe('refresh-2');
});

test('concurrent requests share one refresh', async () => {
  const { fetchImpl, calls } = server();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore('refresh-1'), fetchImpl });
  await Promise.all([client.request('GET', '/me/today'), client.request('GET', '/me/attendance')]);
  expect(refreshCalls(calls)).toBe(1);
  expect(calls.filter((c) => c.headers.Authorization === 'Bearer access-2')).toHaveLength(2);
});

test('two 401s at once trigger one refresh', async () => {
  const { fetchImpl, calls } = server();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore(), fetchImpl });
  await client.startSession(tokens(1)); // access-1 is now expired on the server
  const results = await Promise.all([client.request('GET', '/a'), client.request('GET', '/b')]);
  expect(results).toEqual([expect.objectContaining({ ok: true }), expect.objectContaining({ ok: true })]);
  expect(refreshCalls(calls)).toBe(1);
});

test('refresh rejected ends the session once without retry loop', async () => {
  const { fetchImpl, calls } = server();
  const store = memoryStore();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  const lost = jest.fn();
  client.onAuthLost(lost);
  await client.startSession({ ...tokens(1), refreshToken: 'refresh-revoked' });

  await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(calls).toHaveLength(2); // the 401 and one refresh, nothing else
  expect(store.value).toBeNull();
  expect(lost).toHaveBeenCalledTimes(1);
  expect(lost).toHaveBeenCalledWith('SESSION_EXPIRED');

  await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(calls).toHaveLength(2); // no token left, so no request is even attempted
  expect(lost).toHaveBeenCalledTimes(1);
});

test('ACCOUNT_INACTIVE ends the session', async () => {
  const { fetchImpl } = makeFetch(() => ({ status: 403, body: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' } }));
  const store = memoryStore();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  const lost = jest.fn();
  client.onAuthLost(lost);
  await client.startSession(tokens(1));
  await expect(client.request('GET', '/me/today')).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
  expect(lost).toHaveBeenCalledWith('ACCOUNT_INACTIVE');
  expect(store.value).toBeNull();
});

test('a refresh that fails for lack of network keeps the session', async () => {
  const fetchImpl: FetchLike = async () => {
    throw new TypeError('Network request failed');
  };
  const store = memoryStore('refresh-1');
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  const lost = jest.fn();
  client.onAuthLost(lost);
  await expect(client.request('GET', '/me')).rejects.toBeInstanceOf(NetworkError);
  expect(store.value).toBe('refresh-1');
  expect(lost).not.toHaveBeenCalled();
});

test('auth:false requests never send a token or refresh', async () => {
  const { fetchImpl, calls } = makeFetch(() => ({ status: 204 }));
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore('refresh-1'), fetchImpl });
  await expect(client.request('POST', '/auth/logout', { auth: false, body: {} })).resolves.toBeUndefined();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.headers.Authorization).toBeUndefined();
});
