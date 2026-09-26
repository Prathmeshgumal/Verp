import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { ApiClient } from '../api/client';
import type { Api } from '../api/endpoints';
import { queryKeys } from '../lib/queryKeys';
import { AppProviders } from '../providers';
import type { Services } from '../services';
import { fakeApi, fakeClient, testSettings } from './fakes';

interface Options {
  api?: Partial<Api>;
  client?: Partial<ApiClient>;
  services?: Partial<Services>;
  /** Starting URL, e.g. '/employees/e1?tab=x'. */
  route?: string;
  /** Route pattern the page is mounted on, e.g. '/employees/:id'. */
  path?: string;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/** Renders a page as AppLayout would: providers, router, and company settings already loaded. */
export function renderWithProviders(ui: ReactElement, { api, client, services, route = '/', path = '*' }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.settings, testSettings);
  const value: Services = { client: fakeClient(client), api: fakeApi(api), ...services } as Services;
  const user = userEvent.setup();
  const result = render(
    <AppProviders services={value} queryClient={queryClient} env="test">
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </AppProviders>,
  );
  return { ...result, user, queryClient, services: value };
}
