import { screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import { SitesPage } from './SitesPage';

// Leaflet needs a real browser; the page only relies on the props it passes and onSelect.
vi.mock('./SitesMap', () => ({
  SitesMap: (props: { sites: { id: string }[]; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void }) => (
    <div>
      <output data-testid="map-sites">{props.sites.map((s) => s.id).join(',')}</output>
      <output data-testid="map-selected">{props.selectedId ?? 'none'}</output>
      <output data-testid="map-hovered">{props.hoveredId ?? 'none'}</output>
      <button type="button" onClick={() => props.onSelect('s2')}>
        fake pin click
      </button>
    </div>
  ),
}));

const sites = [site(), site({ id: 's2', name: 'Old yard', address: null, radiusM: 250, isActive: false })];
const renderPage = () => renderWithProviders(<SitesPage />, { api: { listSites: vi.fn(async () => sites) } });

test('lists every site beside the map, with distance, status and links', async () => {
  renderPage();
  const link = await screen.findByRole('link', { name: 'Plot 7' });
  expect(link).toHaveAttribute('href', '/sites/s1');
  expect(within(screen.getByTestId('site-row-s1')).getByText('100 m')).toBeInTheDocument();
  expect(within(screen.getByTestId('site-row-s1')).getByText('In use')).toBeInTheDocument();
  expect(within(screen.getByTestId('site-row-s2')).getByText('Not in use')).toBeInTheDocument();
  expect(within(screen.getByTestId('site-row-s2')).getByText('No address')).toBeInTheDocument();
  expect(screen.getByTestId('map-sites')).toHaveTextContent('s1,s2');
  expect(screen.getByRole('link', { name: 'Add site' })).toHaveAttribute('href', '/sites/new');
});

test('hovering a row lights it on the map; clicking shows it there without leaving the page', async () => {
  const { user } = renderPage();
  const row = await screen.findByTestId('site-row-s1');
  await user.hover(row);
  expect(screen.getByTestId('map-hovered')).toHaveTextContent('s1');
  await user.click(within(row).getByText('Hinjewadi Phase 1'));
  expect(screen.getByTestId('map-selected')).toHaveTextContent('s1');
  expect(row).toHaveAttribute('aria-current', 'true');
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
});

test('clicking a pin highlights its row', async () => {
  const { user } = renderPage();
  await screen.findByTestId('site-row-s2');
  await user.click(screen.getByRole('button', { name: 'fake pin click' }));
  expect(screen.getByTestId('site-row-s2')).toHaveAttribute('aria-current', 'true');
  expect(screen.getByTestId('site-row-s1')).not.toHaveAttribute('aria-current');
});

test('no sites yet says so', async () => {
  renderWithProviders(<SitesPage />, { api: { listSites: vi.fn(async () => []) } });
  expect(await screen.findByText('No sites yet')).toBeInTheDocument();
});
