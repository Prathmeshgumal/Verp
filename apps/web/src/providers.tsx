import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from './api/errors';
import { ServicesProvider, type Services } from './services';
import { theme } from './theme';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry only what may pass next time: network trouble and 5xx, never 4xx.
        retry: (failures, err) => failures < 2 && !(err instanceof ApiError && err.status < 500),
      },
    },
  });
}

interface Props {
  services: Services;
  queryClient: QueryClient;
  /** 'test' turns off portals and transitions (Testing Library). */
  env?: 'default' | 'test';
  children: ReactNode;
}

export function AppProviders({ services, queryClient, env = 'default', children }: Props) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light" env={env}>
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <ServicesProvider value={services}>{children}</ServicesProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
