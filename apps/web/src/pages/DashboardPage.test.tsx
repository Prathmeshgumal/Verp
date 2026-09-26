import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { NetworkError } from '../api/errors';
import { dashboardToday } from '../testing/fakes';
import { renderWithProviders } from '../testing/render';
import { DashboardPage } from './DashboardPage';

afterEach(() => {
  vi.useRealTimers();
});

test('shows the numbers and who is working, in company time', async () => {
  renderWithProviders(<DashboardPage />, { api: { dashboard: vi.fn(async () => dashboardToday()) } });
  expect(await screen.findByText('Fri 25 Sep 2026')).toBeInTheDocument();
  expect(within(screen.getByText('Active employees').parentElement!).getByText('42')).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Ravi Kumar/ })).getByText('09:05')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Needs review/ })).toHaveAttribute(
    'href',
    '/attendance?from=2020-01-01&to=2026-09-25&needsReview=true',
  );
  expect(screen.getByRole('link', { name: /Missed check-outs/ })).toHaveAttribute(
    'href',
    '/attendance?from=2020-01-01&to=2026-09-25&status=MISSED_CHECKOUT',
  );
});

test('nobody working says so', async () => {
  renderWithProviders(<DashboardPage />, { api: { dashboard: vi.fn(async () => dashboardToday({ working: [] })) } });
  expect(await screen.findByText('Nobody is checked in right now.')).toBeInTheDocument();
});

test('refreshes every minute', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const dashboard = vi.fn(async () => dashboardToday());
  renderWithProviders(<DashboardPage />, { api: { dashboard } });
  await screen.findByText('Fri 25 Sep 2026');
  await vi.advanceTimersByTimeAsync(60_000);
  await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(2));
});

test('a failed load explains and can be retried', async () => {
  const dashboard = vi.fn().mockRejectedValueOnce(new NetworkError('offline')).mockResolvedValue(dashboardToday());
  const { user } = renderWithProviders(<DashboardPage />, { api: { dashboard } });
  expect(await screen.findByText('Cannot reach the server. Check your internet')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Fri 25 Sep 2026')).toBeInTheDocument();
});
