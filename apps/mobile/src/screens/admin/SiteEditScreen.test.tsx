import React from 'react';
import { PermissionsAndroid } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { SettingsDto, SiteDto } from '@ve/shared';
import { ApiError } from '../../api/errors';
import { fakeApi } from '../../testing/fakeApi';
import { fakeNative, fakeState } from '../../testing/fakeNative';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { injectedScripts } from '../../testing/webView';
import { SiteEditScreen } from './SiteEditScreen';

const site: SiteDto = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100, address: null, isActive: true, createdAt: 'x', updatedAt: 'x' };
const settings: SettingsDto = { timezone: 'Asia/Kolkata', maxAccuracyM: 50, defaultRadiusM: 100, reminderTime: '19:00', clockMismatchMinutes: 5 };
const moved = (lat: number, lng: number) => ({ nativeEvent: { data: JSON.stringify({ type: 'moved', lat, lng }) } });

async function renderEdit(params: { id?: string }, api = {}) {
  const navigation = fakeNavigation();
  const createSite = jest.fn(async () => site);
  const updateSite = jest.fn(async () => site);
  await renderWithAuth(<SiteEditScreen navigation={navigation as never} route={{ key: 'k', name: 'SiteEdit', params } as never} />, {
    api: fakeApi({
      createSite,
      updateSite,
      getSite: jest.fn(async () => site),
      getSettings: jest.fn(async () => settings),
      listSites: jest.fn(async () => [site]),
      ...api,
    }),
    state: loggedIn(adminUser),
  });
  return { navigation, createSite, updateSite };
}

beforeEach(() => {
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: 'granted',
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted',
  } as never);
});

test('new site: no pin at first, so Save waits for one', async () => {
  const { createSite } = await renderEdit({});
  expect(screen.getByText('Set the location: paste from Google Maps, use my location, or tap the map.')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Site name'), 'Plot 9');
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
  await fireEvent(screen.getByTestId('site-map'), 'message', { nativeEvent: { data: '{"type":"ready"}' } });
  await waitFor(() => expect(injectedScripts.at(-1)).toContain('"center":null'));
  expect(injectedScripts.at(-1)).toContain('"tapToPlace":true');
  expect(createSite).not.toHaveBeenCalled();
});

test('new site: name, tapped pin and larger radius are saved', async () => {
  const { createSite, navigation } = await renderEdit({});
  await fireEvent.changeText(screen.getByLabelText('Site name'), ' Plot 9 ');
  await fireEvent(screen.getByTestId('site-map'), 'message', moved(18.6, 73.7));
  await fireEvent.press(screen.getByRole('button', { name: 'Larger' }));
  expect(screen.getByText('110 m')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(createSite).toHaveBeenCalledWith({ name: 'Plot 9', address: undefined, lat: 18.6, lng: 73.7, radiusM: 110 }),
  );
  expect(navigation.goBack).toHaveBeenCalled();
});

test('radius never goes below 10 m', async () => {
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: '50 m' }));
  for (let i = 0; i < 10; i++) await fireEvent.press(screen.getByRole('button', { name: 'Smaller' }));
  expect(screen.getByText('10 m')).toBeOnTheScreen();
});

test('edit: loads the site and saves changes', async () => {
  const { updateSite } = await renderEdit({ id: 's1' });
  expect(await screen.findByDisplayValue('Plot 7')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '200 m' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(updateSite).toHaveBeenCalledWith('s1', { name: 'Plot 7', address: null, lat: 18.59, lng: 73.73, radiusM: 200, isActive: true }),
  );
});

test('use my location: a precise reading moves the pin and shows its accuracy', async () => {
  fakeState.fix = { lat: 18.7, lng: 73.9, accuracyM: 8, isMock: false };
  await renderEdit({});
  await fireEvent(screen.getByTestId('site-map'), 'message', { nativeEvent: { data: '{"type":"ready"}' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('18.70000, 73.90000 · ±8 m')).toBeOnTheScreen();
  expect(screen.getByText('Your location · accurate to ±8 m')).toBeOnTheScreen();
  await waitFor(() => expect(injectedScripts.at(-1)).toContain('"lat":18.7'));
});

test('use my location: a poor reading does not move the pin and says why', async () => {
  fakeState.fix = { lat: 18.7, lng: 73.9, accuracyM: 400, isMock: false };
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(
    await screen.findByText('Your location is only accurate to ±400 m, more than the ±50 m allowed. Paste from Google Maps, or tap the map.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/18\.70000/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
});

test('use my location with location off explains why', async () => {
  fakeState.locationEnabled = false;
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Turn on location')).toBeOnTheScreen();
});

test('pasted coordinates move the pin without asking the server', async () => {
  const resolvePlaceLink = jest.fn();
  await renderEdit({}, { resolvePlaceLink });
  await fireEvent.changeText(screen.getByLabelText('Paste from Google Maps'), '17.416682, 78.366365');
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText('17.41668, 78.36637')).toBeOnTheScreen();
  expect(screen.getByText('From Google Maps · check the circle before saving.')).toBeOnTheScreen();
  expect(resolvePlaceLink).not.toHaveBeenCalled();
});

test('a pasted link is read by the server', async () => {
  const resolvePlaceLink = jest.fn(async () => ({ lat: 17.3615636, lng: 78.4746832 }));
  await renderEdit({}, { resolvePlaceLink });
  await fireEvent.changeText(screen.getByLabelText('Paste from Google Maps'), 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText('17.36156, 78.47468')).toBeOnTheScreen();
  expect(resolvePlaceLink).toHaveBeenCalledWith('https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
});

test('a link without a pin says why and leaves the pin alone', async () => {
  const resolvePlaceLink = jest.fn(async () => {
    throw new ApiError(422, 'NO_EXACT_PIN', 'area', { code: 'NO_EXACT_PIN' });
  });
  await renderEdit({}, { resolvePlaceLink });
  await fireEvent.changeText(screen.getByLabelText('Paste from Google Maps'), 'https://www.google.com/maps/@17.4167,78.3664,15z');
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  expect(
    await screen.findByText('This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
});

test('a site needs a name', async () => {
  const { createSite } = await renderEdit({});
  await fireEvent(screen.getByTestId('site-map'), 'message', moved(18.6, 73.7));
  await fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  expect(await screen.findByText('Enter the name')).toBeOnTheScreen();
  expect(createSite).not.toHaveBeenCalled();
});

test('a late location reading does not undo a pin placed meanwhile', async () => {
  let answer: (fix: { lat: number; lng: number; accuracyM: number; isMock: boolean }) => void = () => {};
  jest.spyOn(fakeNative, 'getCurrentPosition').mockImplementation(() => new Promise((resolve) => (answer = resolve)));
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await waitFor(() => expect(fakeNative.getCurrentPosition).toHaveBeenCalled());
  await fireEvent(screen.getByTestId('site-map'), 'message', moved(18.6, 73.7));
  await act(async () => answer({ lat: 18.7, lng: 73.9, accuracyM: 8, isMock: false }));
  expect(screen.getByText('18.60000, 73.70000')).toBeOnTheScreen();
  expect(screen.queryByText('Your location · accurate to ±8 m')).toBeNull();
});

test('a slow link lookup does not undo a pin placed meanwhile', async () => {
  let answer: (p: { lat: number; lng: number }) => void = () => {};
  const resolvePlaceLink = jest.fn(() => new Promise<{ lat: number; lng: number }>((resolve) => (answer = resolve)));
  await renderEdit({}, { resolvePlaceLink });
  await fireEvent.changeText(screen.getByLabelText('Paste from Google Maps'), 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  await fireEvent(screen.getByTestId('site-map'), 'message', moved(18.6, 73.7));
  await act(async () => answer({ lat: 17.3615636, lng: 78.4746832 }));
  expect(screen.getByText('18.60000, 73.70000')).toBeOnTheScreen();
});
