import React, { type ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicUser } from '@ve/shared';
import { AuthContext, type AuthContextValue, type AuthState } from '../auth/AuthContext';
import type { Api } from '../api/endpoints';
import { fakeApi } from './fakeApi';

export const employeeUser: PublicUser = {
  id: 'emp-1',
  role: 'employee',
  name: 'Anil Pawar',
  phone: '+919876543210',
  email: null,
  siteId: 'site-1',
};

export const adminUser: PublicUser = {
  id: 'adm-1',
  role: 'admin',
  name: 'Priya Kulkarni',
  phone: null,
  email: 'admin@ve.test',
  siteId: null,
};

export const loggedIn = (user: PublicUser): AuthState => ({ status: 'loggedIn', user });

interface Options {
  api?: Api;
  state?: AuthState;
  auth?: Partial<AuthContextValue>;
}

export async function renderWithAuth(ui: ReactElement, { api = fakeApi(), state = loggedIn(employeeUser), auth }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const value: AuthContextValue = {
    state,
    api,
    loginEmployee: jest.fn(async () => {}),
    loginAdmin: jest.fn(async () => {}),
    logout: jest.fn(async () => {}),
    ...auth,
  };
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, auth: value, queryClient };
}

/** Screens take navigation/route as props; tests pass this instead of a real navigator. */
export function fakeNavigation() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
  };
}
