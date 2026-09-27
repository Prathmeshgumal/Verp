/**
 * Vercel Edge Function: passes /backend/* on the dashboard's own domain through to the API.
 *
 * Why a proxy: the API keeps admins signed in with a SameSite=Strict cookie, which a browser
 * never sends from x.vercel.app to a different site (e.g. an ngrok tunnel). Through this proxy
 * the browser only ever talks to the Vercel domain, so the cookie is first-party and there is no CORS.
 *
 * Set BACKEND_URL in the Vercel project (e.g. https://name.ngrok-free.dev). vercel.json rewrites
 * /backend/:path* to /api/proxy?path=:path*.
 */
export const config = { runtime: 'edge' };

export const PUBLIC_PREFIX = '/backend';

/** Headers that belong to one hop, or that fetch() has already dealt with (it un-gzips the body). */
const DROP_REQUEST = ['host', 'connection', 'content-length', 'accept-encoding'];
const DROP_RESPONSE = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie'];

/** The API scopes its cookie to /auth; in the browser that path lives under /backend. */
export function rewriteCookiePath(cookie: string): string {
  return cookie.replace(/;\s*path=\/([^;]*)/i, (_m, rest: string) => `; Path=${PUBLIC_PREFIX}/${rest}`);
}

export default async function handler(request: Request, backendUrl = process.env.BACKEND_URL): Promise<Response> {
  if (!backendUrl) return new Response('BACKEND_URL is not set for this deployment', { status: 500 });

  const incoming = new URL(request.url);
  const path = incoming.searchParams.get('path') ?? '';
  incoming.searchParams.delete('path');
  const target = new URL(`${backendUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`);
  target.search = incoming.searchParams.toString();

  const headers = new Headers(request.headers);
  for (const name of DROP_REQUEST) headers.delete(name);
  // Free ngrok tunnels show a warning page to browsers unless this header is present.
  headers.set('ngrok-skip-browser-warning', '1');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    });
  } catch {
    return Response.json({ error: { code: 'BACKEND_UNREACHABLE', message: 'The server is not reachable' } }, { status: 502 });
  }

  const out = new Headers(upstream.headers);
  for (const name of DROP_RESPONSE) out.delete(name);
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', rewriteCookiePath(cookie));
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
