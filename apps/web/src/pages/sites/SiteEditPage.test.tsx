import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Api } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import type { PlaceSearch } from './placeSearch';
import { SiteEditPage } from './SiteEditPage';

// Leaflet needs a real browser; the page only relies on the props it passes and onMove.
vi.mock('./SiteMapPicker', () => ({
  SiteMapPicker: (props: {
    center: { lat: number; lng: number } | null;
    radiusM: number;
    accuracy?: { accuracyM: number } | null;
    onMove: (p: { lat: number; lng: number }) => void;
  }) => (
    <div>
      <output data-testid="map-state">{props.center ? `${props.center.lat},${props.center.lng},${props.radiusM}` : 'none'}</output>
      <output data-testid="map-accuracy">{props.accuracy ? String(props.accuracy.accuracyM) : 'none'}</output>
      <button type="button" onClick={() => props.onMove({ lat: 18.6, lng: 73.7 })}>
        fake map drag
      </button>
    </div>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'geolocation');
});

function renderNew(api: Partial<Api> = {}, searchPlaces?: PlaceSearch) {
  const createSite = vi.fn(async () => site({ id: 's9' }));
  const utils = renderWithProviders(<SiteEditPage />, {
    route: '/sites/new',
    path: '/sites/new',
    api: { createSite, listSites: vi.fn(async () => []), ...api },
    services: searchPlaces ? { searchPlaces } : {},
  });
  return { ...utils, createSite };
}

const position = (latitude: number, longitude: number, accuracy: number) =>
  ({ coords: { latitude, longitude, accuracy } }) as GeolocationPosition;

/** `watch` receives the page's callbacks when it starts watching. */
function mockGeolocation(watch: (success: PositionCallback, failure?: PositionErrorCallback | null) => void) {
  const clearWatch = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (s: PositionCallback, f?: PositionErrorCallback | null) => {
        watch(s, f);
        return 1;
      },
      clearWatch,
    },
  });
  return clearWatch;
}

test('new site: no pin until one is placed, then saves the dragged pin', async () => {
  const { user, createSite } = renderNew();
  expect(screen.getByRole('heading', { name: 'New site' })).toBeInTheDocument();
  expect(screen.getByTestId('map-state')).toHaveTextContent('none');
  expect(screen.getByText('Set the location: search, paste from Google Maps, use my location, or tap the map.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
  await user.type(screen.getByLabelText('Site name'), ' Plot 9 ');
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.6,73.7,100');
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
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.5912,73.7389,100');
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
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  const radius = screen.getByLabelText('Allowed distance (metres)');
  await user.clear(radius);
  await user.type(radius, '1500');
  await user.click(screen.getByRole('button', { name: 'Save site' }));
  expect(screen.getByText('Enter the site name')).toBeInTheDocument();
  expect(screen.getByText('At most 1000 m')).toBeInTheDocument();
  expect(createSite).not.toHaveBeenCalled();
});

test('use my location: a precise reading moves the pin and shows its accuracy', async () => {
  const clearWatch = mockGeolocation((success) => success(position(18.7, 73.9, 12)));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Your location · accurate to ±12 m')).toBeInTheDocument();
  expect(screen.getByLabelText('Latitude')).toHaveValue('18.7');
  expect(screen.getByLabelText('Longitude')).toHaveValue('73.9');
  expect(screen.getByTestId('map-accuracy')).toHaveTextContent('12');
  expect(clearWatch).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  expect(screen.getByTestId('map-accuracy')).toHaveTextContent('none');
});

test('a poor reading does not move the pin and says why', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockGeolocation((success) => success(position(18.7, 73.9, 900)));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  await vi.advanceTimersByTimeAsync(20_000);
  expect(
    await screen.findByText(
      'Your location is only accurate to ±900 m, more than the ±50 m allowed. Laptops usually cannot tell their exact position. Search, paste from Google Maps, or drag the pin.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByTestId('map-state')).toHaveTextContent('none');
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
});

test('refused location permission explains what to do', async () => {
  mockGeolocation((_success, failure) => failure?.({ code: 1 } as GeolocationPositionError));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Location permission was refused. Allow it in the browser, or drag the pin.')).toBeInTheDocument();
});

test('pasted coordinates move the pin without asking the server', async () => {
  const resolvePlaceLink = vi.fn();
  const { user } = renderNew({ resolvePlaceLink });
  await user.type(screen.getByLabelText('Paste from Google Maps'), '17.416682, 78.366365');
  await user.click(screen.getByRole('button', { name: 'Go' }));
  expect(screen.getByTestId('map-state')).toHaveTextContent('17.416682,78.366365,100');
  expect(screen.getByText('From Google Maps · check the circle before saving.')).toBeInTheDocument();
  expect(screen.getByLabelText('Paste from Google Maps')).toHaveValue('');
  expect(resolvePlaceLink).not.toHaveBeenCalled();
});

test('a pasted link is read by the server', async () => {
  const resolvePlaceLink = vi.fn(async () => ({ lat: 17.3615636, lng: 78.4746832 }));
  const { user } = renderNew({ resolvePlaceLink });
  await user.type(screen.getByLabelText('Paste from Google Maps'), 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  await user.click(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText('From Google Maps · check the circle before saving.')).toBeInTheDocument();
  expect(resolvePlaceLink).toHaveBeenCalledWith('https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  expect(screen.getByTestId('map-state')).toHaveTextContent('17.361564,78.474683,100');
});

test('a link without a pin says why and leaves the pin alone', async () => {
  const message = 'This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.';
  const resolvePlaceLink = vi.fn(async () => {
    throw new ApiError(422, 'NO_EXACT_PIN', message);
  });
  const { user } = renderNew({ resolvePlaceLink });
  await user.type(screen.getByLabelText('Paste from Google Maps'), 'https://www.google.com/maps/@17.4167,78.3664,15z');
  await user.click(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(screen.getByTestId('map-state')).toHaveTextContent('none');
});

test('a late location reading does not undo a pin placed meanwhile', async () => {
  let send: PositionCallback = () => {};
  mockGeolocation((success) => {
    send = success;
  });
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  await act(async () => send(position(18.7, 73.9, 12)));
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.6,73.7,100');
  expect(screen.queryByText('Your location · accurate to ±12 m')).toBeNull();
});

test('a slow link lookup does not undo a pin placed meanwhile', async () => {
  let answer: (p: { lat: number; lng: number }) => void = () => {};
  const resolvePlaceLink = vi.fn(() => new Promise<{ lat: number; lng: number }>((resolve) => (answer = resolve)));
  const { user } = renderNew({ resolvePlaceLink });
  await user.type(screen.getByLabelText('Paste from Google Maps'), 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  await user.click(screen.getByRole('button', { name: 'Go' }));
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  await act(async () => answer({ lat: 17.3615636, lng: 78.4746832 }));
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.6,73.7,100');
});
