import { screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import { SitesPage } from './SitesPage';

test('lists sites with distance and status, and links to edit and add', async () => {
  renderWithProviders(<SitesPage />, {
    api: { listSites: vi.fn(async () => [site(), site({ id: 's2', name: 'Old yard', address: null, radiusM: 250, isActive: false })]) },
  });
  const link = await screen.findByRole('link', { name: 'Plot 7' });
  expect(link).toHaveAttribute('href', '/sites/s1');
  expect(within(link.closest('tr')!).getByText('100 m')).toBeInTheDocument();
  const oldYard = screen.getByRole('link', { name: 'Old yard' }).closest('tr')!;
  expect(within(oldYard).getByText('Not in use')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add site' })).toHaveAttribute('href', '/sites/new');
});
