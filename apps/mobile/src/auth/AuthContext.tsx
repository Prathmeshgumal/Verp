import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthTokens, PublicUser } from '@ve/shared';
import type { ApiClient } from '../api/client';
import type { Api } from '../api/endpoints';
import { getDeviceInfo } from '../native/device';
import { clearLocalSession, loadCachedUser, saveCachedUser } from './session';

export type AuthState =
  | { status: 'loading' }
  | { status: 'loggedOut'; reason: string | null }
  | { status: 'loggedIn'; user: PublicUser };

export interface AuthContextValue {
  state: AuthState;
  api: Api;
  loginEmployee(phone: string, pin: string): Promise<void>;
  loginAdmin(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function useUser(): PublicUser {
  const { state } = useAuth();
  if (state.status !== 'loggedIn') throw new Error('useUser needs a logged-in user');
  return state.user;
}

interface Props {
  client: ApiClient;
  api: Api;
  children: ReactNode;
}

export function AuthProvider({ client, api, children }: Props) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const endLocal = useCallback(
    async (reason: string | null) => {
      await clearLocalSession();
      queryClient.clear();
      setState({ status: 'loggedOut', reason });
    },
    [queryClient],
  );

  useEffect(() => client.onAuthLost((code) => void endLocal(code)), [client, endLocal]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [refreshToken, user] = await Promise.all([client.getRefreshToken(), loadCachedUser()]);
      if (cancelled) return;
      if (refreshToken && user) {
        // Stay logged in across restarts; the first API call refreshes the access token.
        setState({ status: 'loggedIn', user });
        return;
      }
      await client.endSession();
      await clearLocalSession();
      if (!cancelled) setState({ status: 'loggedOut', reason: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const begin = useCallback(
    async (tokens: AuthTokens) => {
      await client.startSession(tokens);
      await saveCachedUser(tokens.user);
      setState({ status: 'loggedIn', user: tokens.user });
    },
    [client],
  );

  const loginEmployee = useCallback(
    async (phone: string, pin: string) => {
      const { deviceId, deviceModel } = await getDeviceInfo();
      await begin(await api.loginEmployee({ phone, pin, deviceId, deviceModel }));
    },
    [api, begin],
  );

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const { deviceId, deviceModel } = await getDeviceInfo();
      await begin(await api.loginAdmin({ email: email.trim(), password, client: 'mobile', deviceId, deviceModel }));
    },
    [api, begin],
  );

  const logout = useCallback(async () => {
    const refreshToken = await client.getRefreshToken();
    if (refreshToken) {
      try {
        await api.logout(refreshToken);
      } catch (err) {
        console.warn('logout: server call failed', err);
      }
    }
    await client.endSession();
    await endLocal(null);
  }, [api, client, endLocal]);

  const value = useMemo(
    () => ({ state, api, loginEmployee, loginAdmin, logout }),
    [state, api, loginEmployee, loginAdmin, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
