import type { AuthTokens, ErrorCode, PublicUser } from '@ve/shared';
import { ApiError, NetworkError } from './errors';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export type Query = Record<string, string | number | boolean | undefined>;

export interface RequestOptions {
  body?: unknown;
  query?: Query;
}

export interface ApiClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
  /** Same auth and refresh handling as request, but hands back the raw response (file downloads). */
  requestRaw(method: string, path: string, options?: RequestOptions): Promise<Response>;
  login(email: string, password: string): Promise<PublicUser>;
  /** Gets a fresh access token from the refresh cookie. null = no valid session (not an error). */
  restore(): Promise<PublicUser | null>;
  logout(): Promise<void>;
  /** Called when a logged-in session ends by itself (refresh refused, account turned off). */
  onAuthLost(listener: () => void): () => void;
}

const TIMEOUT_MS = 15_000;

export function buildUrl(base: string, path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${base.replace(/\/+$/, '')}${path}${qs ? `?${qs}` : ''}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  return new ApiError(res.status, (body?.code as ErrorCode | undefined) ?? 'UNKNOWN', body?.message ?? `HTTP ${res.status}`);
}

export function createApiClient({ baseUrl, fetch: fetchImpl = (url, init) => fetch(url, init) }: { baseUrl: string; fetch?: FetchLike }): ApiClient {
  // Memory only: a page reload drops it and restore() gets a new one from the HttpOnly cookie.
  let accessToken: string | null = null;
  let user: PublicUser | null = null;
  let refreshing: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();

  async function send(method: string, path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    try {
      return await fetchImpl(buildUrl(baseUrl, path, options.query), {
        method,
        headers,
        credentials: 'include',
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new NetworkError(err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : 'offline');
    }
  }

  function loseSession() {
    if (accessToken === null) return;
    accessToken = null;
    user = null;
    listeners.forEach((listener) => listener());
  }

  async function doRefresh(): Promise<boolean> {
    const res = await send('POST', '/auth/refresh', {}, null);
    if (!res.ok) return false;
    const tokens = (await res.json()) as AuthTokens;
    accessToken = tokens.accessToken;
    user = tokens.user;
    return true;
  }

  function refreshOnce(): Promise<boolean> {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function requestRaw(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
    const token = accessToken;
    let res = await send(method, path, options, token);
    if (res.status === 401 && token) {
      // If another request already swapped the token, just retry with the new one.
      const refreshed = accessToken !== token || (await refreshOnce());
      if (refreshed) res = await send(method, path, options, accessToken);
    }
    if (!res.ok) {
      const err = await toApiError(res);
      if (res.status === 401 || err.code === 'ACCOUNT_INACTIVE') loseSession();
      throw err;
    }
    return res;
  }

  return {
    requestRaw,

    async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
      const res = await requestRaw(method, path, options);
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },

    async login(email, password) {
      const res = await send('POST', '/auth/admin/login', { body: { email, password, client: 'web' } }, null);
      if (!res.ok) throw await toApiError(res);
      const tokens = (await res.json()) as AuthTokens;
      accessToken = tokens.accessToken;
      user = tokens.user;
      return tokens.user;
    },

    async restore() {
      return (await refreshOnce()) ? user : null;
    },

    async logout() {
      try {
        await send('POST', '/auth/logout', {}, accessToken);
      } catch (err) {
        // Offline: the server session stays until it expires; locally we are logged out either way.
        console.warn('logout request failed', err);
      }
      accessToken = null;
      user = null;
    },

    onAuthLost(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
