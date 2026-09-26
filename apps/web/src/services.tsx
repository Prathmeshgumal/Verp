import { createContext, useContext, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from './api/client';
import { createApi, type Api } from './api/endpoints';
import { config } from './config';
import { createPlaceSearch, type PlaceSearch } from './pages/sites/placeSearch';

export interface Services {
  client: ApiClient;
  api: Api;
  searchPlaces: PlaceSearch;
}

const ServicesContext = createContext<Services | null>(null);

export function createServices(baseUrl: string = config.apiUrl): Services {
  const client = createApiClient({ baseUrl });
  return { client, api: createApi(client), searchPlaces: createPlaceSearch() };
}

export function ServicesProvider({ value, children }: { value: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside ServicesProvider');
  return services;
}
