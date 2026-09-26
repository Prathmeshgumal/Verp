import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from './api/errors';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './lib/theme';
import { ServicesProvider, type Services } from './services';

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
  /** 'test' pins the light theme so tests do not depend on the machine's setting. */
  env?: 'default' | 'test';
  children: ReactNode;
}

export function AppProviders({ services, queryClient, env = 'default', children }: Props) {
  return (
    <ThemeProvider initial={env === 'test' ? 'light' : undefined}>
      <TooltipProvider delayDuration={200}>
        <QueryClientProvider client={queryClient}>
          <ServicesProvider value={services}>{children}</ServicesProvider>
        </QueryClientProvider>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
