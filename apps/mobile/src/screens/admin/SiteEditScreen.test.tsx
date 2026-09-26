import React from 'react';
import { PermissionsAndroid } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { SiteDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { fakeState } from '../../testing/fakeNative';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { injectedScripts } from '../../testing/webView';
import { SiteEditScreen } from './SiteEditScreen';

const site: SiteDto = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100, address: null, isActive: true, createdAt: 'x', updatedAt: 'x' };
const moved = (lat: number, lng: number) => ({ nativeEvent: { data: JSON.stringify({ type: 'moved', lat, lng }) } });

async function renderEdit(params: { id?: string }, api = {}) {
  const navigation = fakeNavigation();
  const createSite = jest.fn(async () => site);
  const updateSite = jest.fn(async () => site);
  await renderWithAuth(<SiteEditScreen navigation={navigation as never} route={{ key: 'k', name: 'SiteEdit', params } as never} />, {
    api: fakeApi({ createSite, updateSite, getSite: jest.fn(async () => site), ...api }),
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

test('new site: name, dragged pin and larger radius are saved', async () => {
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

test('use my location moves the pin to the phone position', async () => {
  fakeState.fix = { lat: 18.7, lng: 73.9, accuracyM: 8, isMock: false };
  await renderEdit({});
  await fireEvent(screen.getByTestId('site-map'), 'message', { nativeEvent: { data: '{"type":"ready"}' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('18.70000, 73.90000')).toBeOnTheScreen();
  await waitFor(() => expect(injectedScripts.at(-1)).toContain('"lat":18.7'));
});

test('use my location with location off explains why', async () => {
  fakeState.locationEnabled = false;
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Turn on location')).toBeOnTheScreen();
});

test('a site needs a name', async () => {
  const { createSite } = await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  expect(await screen.findByText('Enter the name')).toBeOnTheScreen();
  expect(createSite).not.toHaveBeenCalled();
});
