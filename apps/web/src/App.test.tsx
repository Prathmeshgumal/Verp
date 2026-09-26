import { QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';
import { App } from './App';
import type { ApiClient } from './api/client';
import type { Api } from './api/endpoints';
import { ApiError } from './api/errors';
import { AuthProvider } from './auth/AuthContext';
import { AppProviders } from './providers';
import { adminUser, dashboardToday, fakeApi, fakeClient, testSettings } from './testing/fakes';

function renderApp({ client = {}, api = {} }: { client?: Partial<ApiClient>; api?: Partial<Api> } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const services = {
    client: fakeClient(client),
    api: fakeApi({ settings: vi.fn(async () => testSettings), dashboard: vi.fn(async () => dashboardToday()), ...api }),
  };
  const user = userEvent.setup();
  render(
    <AppProviders services={services} queryClient={queryClient} env="test">
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </AppProviders>,
  );
  return { user, services };
}

test('restores the session from the cookie on load', async () => {
  renderApp({ client: { restore: vi.fn(async () => adminUser) } });
  expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(screen.getByText('Asha Admin')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
});

test('expired cookie shows the login page once', async () => {
  const restore = vi.fn(async () => null);
  renderApp({ client: { restore } });
  expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  expect(restore).toHaveBeenCalledTimes(1);
});

test('logging in opens the dashboard', async () => {
  const login = vi.fn(async () => adminUser);
  const { user } = renderApp({ client: { login } });
  await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret-password');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(login).toHaveBeenCalledWith('asha@example.com', 'secret-password');
});

test('wrong password says so and stays on the login page', async () => {
  const { user } = renderApp({ client: { login: vi.fn(async () => { throw new ApiError(401, 'INVALID_CREDENTIALS', 'x'); }) } });
  await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
  await user.type(screen.getByLabelText('Password'), 'nope');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByText('Wrong email or password')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
});

test('an empty form is checked before anything is sent', async () => {
  const login = vi.fn();
  const { user } = renderApp({ client: { login } });
  await user.click(await screen.findByRole('button', { name: 'Log in' }));
  expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  expect(screen.getByText('Enter your password')).toBeInTheDocument();
  expect(login).not.toHaveBeenCalled();
});

test('a session that ends while working returns to login with a notice', async () => {
  let authLost = () => {};
  renderApp({
    client: {
      restore: vi.fn(async () => adminUser),
      onAuthLost: (listener) => {
        authLost = listener;
        return () => {};
      },
    },
  });
  await screen.findByRole('heading', { name: 'Today' });
  act(() => authLost());
  expect(await screen.findByText('Your session ended. Please log in again')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
});

test('log out ends the session', async () => {
  const logout = vi.fn(async () => {});
  const { user } = renderApp({ client: { restore: vi.fn(async () => adminUser), logout } });
  await user.click(await screen.findByRole('button', { name: 'Log out' }));
  expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  expect(logout).toHaveBeenCalledTimes(1);
});
