import { useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@ve/shared';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { errorMessage } from '../lib/errors';
import { useServices } from '../services';

export type AuthState =
  | { status: 'loading' }
  | { status: 'loggedOut'; notice?: string }
  | { status: 'loggedIn'; user: PublicUser };

interface AuthValue {
  state: AuthState;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { client } = useServices();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    // The refresh cookie survives reloads and new tabs; the access token does not.
    client.restore().then(
      (user) => {
        if (active) setState(user ? { status: 'loggedIn', user } : { status: 'loggedOut' });
      },
      (err: unknown) => {
        if (active) setState({ status: 'loggedOut', notice: errorMessage(err) });
      },
    );
    const stop = client.onAuthLost(() => {
      queryClient.clear();
      setState({ status: 'loggedOut', notice: 'Your session ended. Please log in again' });
    });
    return () => {
      active = false;
      stop();
    };
  }, [client, queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      state,
      async login(email, password) {
        const user = await client.login(email, password);
        setState({ status: 'loggedIn', user });
      },
      async logout() {
        await client.logout();
        queryClient.clear();
        setState({ status: 'loggedOut' });
      },
    }),
    [state, client, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
