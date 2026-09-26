import { screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Api } from '../../api/endpoints';
import { site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import type { PlaceSearch } from './placeSearch';
import { SiteEditPage } from './SiteEditPage';

// Leaflet needs a real browser; the page only relies on the props it passes and onMove.
vi.mock('./SiteMapPicker', () => ({
  SiteMapPicker: (props: { center: { lat: number; lng: number }; radiusM: number; onMove: (p: { lat: number; lng: number }) => void }) => (
    <div>
      <output data-testid="map-state">{`${props.center.lat},${props.center.lng},${props.radiusM}`}</output>
      <button type="button" onClick={() => props.onMove({ lat: 18.6, lng: 73.7 })}>
        fake map drag
      </button>
    </div>
  ),
}));

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation');
});

function renderNew(api: Partial<Api> = {}, searchPlaces?: PlaceSearch) {
  const createSite = vi.fn(async () => site({ id: 's9' }));
  const utils = renderWithProviders(<SiteEditPage />, {
    route: '/sites/new',
    path: '/sites/new',
    api: { createSite, ...api },
    services: searchPlaces ? { searchPlaces } : {},
  });
  return { ...utils, createSite };
}

function mockGeolocation(getCurrentPosition: Geolocation['getCurrentPosition']) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
}

test('new site: starts from the company default distance, saves the dragged pin', async () => {
  const { user, createSite } = renderNew();
  expect(screen.getByRole('heading', { name: 'New site' })).toBeInTheDocument();
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.5204,73.8567,100');
  await user.type(screen.getByLabelText('Site name'), ' Plot 9 ');
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  const radius = screen.getByLabelText('Allowed distance (metres)');
  await user.clear(radius);
  await user.type(radius, '150');
  await user.click(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() => expect(createSite).toHaveBeenCalledWith({ name: 'Plot 9', address: undefined, lat: 18.6, lng: 73.7, radiusM: 150 }));
  expect(await screen.findByText('Site saved')).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/sites$/);
});

test('place search moves the pin to the chosen result', async () => {
  const searchPlaces = vi.fn<PlaceSearch>(async () => [{ name: 'Hinjewadi Phase 1, Pune, Maharashtra', lat: 18.5912, lng: 73.7389 }]);
  const { user } = renderNew({}, searchPlaces);
  await user.type(screen.getByLabelText('Search for a place'), 'Hinjewadi');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(searchPlaces).toHaveBeenCalledWith('Hinjewadi');
  expect(screen.getByText('Search by Nominatim · © OpenStreetMap contributors')).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: 'Hinjewadi Phase 1, Pune, Maharashtra' }));
  expect(screen.getByLabelText('Latitude')).toHaveValue('18.5912');
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.5912,73.7389,100');
});

test('edit: loads the site and saves it as not in use', async () => {
  const updateSite = vi.fn(async () => site({ isActive: false }));
  const { user } = renderWithProviders(<SiteEditPage />, {
    route: '/sites/s1',
    path: '/sites/:id',
    api: { getSite: vi.fn(async () => site()), updateSite },
  });
  expect(await screen.findByRole('heading', { name: 'Edit site' })).toBeInTheDocument();
  expect(screen.getByLabelText('Site name')).toHaveValue('Plot 7');
  await user.click(screen.getByLabelText('Site is in use'));
  await user.click(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(updateSite).toHaveBeenCalledWith('s1', {
      name: 'Plot 7',
      address: 'Hinjewadi Phase 1',
      lat: 18.5912,
      lng: 73.7389,
      radiusM: 100,
      isActive: false,
    }),
  );
});

test('a missing name and too large a distance are caught before sending', async () => {
  const { user, createSite } = renderNew();
  const radius = screen.getByLabelText('Allowed distance (metres)');
  await user.clear(radius);
  await user.type(radius, '1500');
  await user.click(screen.getByRole('button', { name: 'Save site' }));
  expect(screen.getByText('Enter the site name')).toBeInTheDocument();
  expect(screen.getByText('At most 1000 m')).toBeInTheDocument();
  expect(createSite).not.toHaveBeenCalled();
});

test('use my location moves the pin to the browser position', async () => {
  mockGeolocation((success) => success({ coords: { latitude: 18.7, longitude: 73.9 } } as GeolocationPosition));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(screen.getByLabelText('Latitude')).toHaveValue('18.7');
  expect(screen.getByLabelText('Longitude')).toHaveValue('73.9');
});

test('refused location permission explains what to do', async () => {
  mockGeolocation((_success, failure) => failure?.({ code: 1 } as GeolocationPositionError));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(screen.getByText('Location permission was refused. Allow it in the browser, or drag the pin.')).toBeInTheDocument();
});
