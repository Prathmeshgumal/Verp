import { useQuery } from '@tanstack/react-query';
import { useServices } from '../services';
import { queryKeys } from './queryKeys';

export function useCompanySettings() {
  const { api } = useServices();
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api.settings(), staleTime: 5 * 60_000 });
}

/** Company time zone. Only used below AppLayout, which waits for settings before showing a page. */
export function useCompanyTz(): string {
  const { data } = useCompanySettings();
  if (!data) throw new Error('Company settings are not loaded yet');
  return data.timezone;
}
