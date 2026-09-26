import type { AuthTokens } from '@ve/shared';
import { ApiError, NetworkError } from './errors';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type Query = Record<string, string | number | boolean | undefined>;
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** false = public endpoint: no token, no refresh. */
  auth?: boolean;
  timeoutMs?: number;
}

export interface TokenStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
}

export interface ApiClient {
  request<T>(method: Method, path: string, options?: RequestOptions): Promise<T>;
  startSession(tokens: AuthTokens): Promise<void>;
  endSession(): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  onAuthLost(listener: (code: string) => void): () => void;
}

interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${baseUrl.replace(/\/+$/, '')}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

export function createApiClient({
  baseUrl,
  tokenStore,
  fetchImpl = (url, init) => fetch(url, init),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions): ApiClient {
  let accessToken: string | null = null;
  let refreshing: Promise<string> | null = null;
  const listeners = new Set<(code: string) => void>();

  async function send(method: Method, path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetchImpl(buildUrl(baseUrl, path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new NetworkError(controller.signal.aborted ? 'timeout' : 'offline', String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status >= 500) throw new NetworkError('server', `HTTP ${res.status}`);
    const text = await res.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new NetworkError('server', `Unreadable response (HTTP ${res.status})`);
      }
    }
    if (res.ok) return data as T;
    const body = (data ?? {}) as { code?: unknown; message?: unknown };
    throw new ApiError(
      res.status,
      typeof body.code === 'string' ? body.code : 'INTERNAL',
      typeof body.message === 'string' ? body.message : `HTTP ${res.status}`,
      data,
    );
  }

  /** Clears both tokens; tells listeners only if there was a session to lose. */
  async function loseSession(code: string): Promise<void> {
    const hadSession = accessToken !== null || (await tokenStore.getRefreshToken()) !== null;
    accessToken = null;
    await tokenStore.setRefreshToken(null);
    if (hadSession) listeners.forEach((listener) => listener(code));
  }

  async function doRefresh(): Promise<string> {
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) {
      accessToken = null;
      throw new ApiError(401, 'SESSION_EXPIRED', 'Please log in again', null);
    }
    try {
      const tokens = await parse<AuthTokens>(await send('POST', '/auth/refresh', { body: { refreshToken } }, null));
      if (tokens.refreshToken) await tokenStore.setRefreshToken(tokens.refreshToken);
      accessToken = tokens.accessToken;
      return tokens.accessToken;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) await loseSession(err.code);
      throw err;
    }
  }

  /** Single flight: the API rotates refresh tokens, so two parallel refreshes would burn the session. */
  function refreshAccess(): Promise<string> {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function finish<T>(res: Response): Promise<T> {
    try {
      return await parse<T>(res);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_INACTIVE') await loseSession(err.code);
      else if (err instanceof ApiError && err.status === 401) await loseSession('SESSION_EXPIRED');
      throw err;
    }
  }

  async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
    if (options.auth === false) return parse<T>(await send(method, path, options, null));
    const token = accessToken ?? (await refreshAccess());
    const first = await send(method, path, options, token);
    if (first.status !== 401) return finish<T>(first);
    // Someone else may already have refreshed while this request was in flight.
    const fresh = accessToken && accessToken !== token ? accessToken : await refreshAccess();
    return finish<T>(await send(method, path, options, fresh));
  }

  return {
    request,
    async startSession(tokens) {
      accessToken = tokens.accessToken;
      await tokenStore.setRefreshToken(tokens.refreshToken ?? null);
    },
    async endSession() {
      accessToken = null;
      await tokenStore.setRefreshToken(null);
    },
    getRefreshToken: () => tokenStore.getRefreshToken(),
    onAuthLost(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
