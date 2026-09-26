import { QueryClient } from '@tanstack/react-query';
import { createApiClient, type ApiClient, type FetchLike } from './api/client';
import { createApi, type Api } from './api/endpoints';
import { NetworkError } from './api/errors';
import { secureTokenStore } from './api/tokenStore';

export interface Services {
  client: ApiClient;
  api: Api;
  queryClient: QueryClient;
}

export function createServices(baseUrl: string, fetchImpl?: FetchLike): Services {
  const client = createApiClient({ baseUrl, tokenStore: secureTokenStore, fetchImpl });
  const queryClient = new QueryClient({
    defaultOptions: {
      // Only network trouble is worth retrying; a 4xx will not change on its own.
      queries: { retry: (count, err) => err instanceof NetworkError && count < 2, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  return { client, api: createApi(client), queryClient };
}
