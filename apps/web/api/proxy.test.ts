// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import handler, { proxy, rewriteCookiePath } from './proxy';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_url: URL, _init: RequestInit) => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

test('forwards the path, query, method and body to the backend', async () => {
  const fetchMock = stubFetch(Response.json({ ok: true }));
  const res = await proxy(
    new Request('https://demo.vercel.app/api/proxy?path=admin/attendance&from=2026-09-01', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: '{"a":1}',
    }),
    'https://api.example.test/',
  );
  expect(res.status).toBe(200);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(String(url)).toBe('https://api.example.test/admin/attendance?from=2026-09-01');
  expect(init.method).toBe('POST');
  expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"a":1}');
  const sent = new Headers(init.headers);
  expect(sent.get('authorization')).toBe('Bearer t');
  expect(sent.get('ngrok-skip-browser-warning')).toBe('1');
  expect(sent.get('host')).toBeNull();
});

test('the sign-in cookie is re-scoped to the /backend path the browser sees', async () => {
  const headers = new Headers({ 'content-type': 'application/json', 'content-encoding': 'gzip' });
  headers.append('set-cookie', 've_rt=abc; Path=/auth; HttpOnly; SameSite=Strict; Max-Age=60');
  stubFetch(new Response('{}', { status: 200, headers }));
  const res = await proxy(new Request('https://demo.vercel.app/api/proxy?path=auth/admin/login', { method: 'POST', body: '{}' }), 'https://api.example.test');
  expect(res.headers.getSetCookie()).toEqual(['ve_rt=abc; Path=/backend/auth; HttpOnly; SameSite=Strict; Max-Age=60']);
  expect(res.headers.get('content-encoding')).toBeNull();
});

test('a backend that is down gives a clear 502', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
  const res = await proxy(new Request('https://demo.vercel.app/api/proxy?path=health'), 'https://api.example.test');
  expect(res.status).toBe(502);
});

test('a deployment without BACKEND_URL says so', async () => {
  const res = await proxy(new Request('https://demo.vercel.app/api/proxy?path=health'), '');
  expect(res.status).toBe(500);
  expect(await res.text()).toContain('BACKEND_URL');
});

test('cookie paths are rewritten, cookies without a path are left alone', () => {
  expect(rewriteCookiePath('a=1; path=/auth')).toBe('a=1; Path=/backend/auth');
  expect(rewriteCookiePath('a=1; HttpOnly')).toBe('a=1; HttpOnly');
});

test('Vercel calls the handler with a context object; the address still comes from BACKEND_URL', async () => {
  const fetchMock = stubFetch(Response.json({ ok: true }));
  vi.stubEnv('BACKEND_URL', 'https://tunnel.example.test');
  const vercelCall = handler as unknown as (req: Request, ctx: { waitUntil: () => void }) => Promise<Response>;
  const res = await vercelCall(new Request('https://demo.vercel.app/api/proxy?path=health'), { waitUntil: () => {} });
  expect(res.status).toBe(200);
  expect(String(fetchMock.mock.calls[0]![0])).toBe('https://tunnel.example.test/health');
  vi.unstubAllEnvs();
});
