import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import type { SiteDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { SitesScreen } from './SitesScreen';

const site: SiteDto = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100, address: 'Hinjewadi', isActive: true, createdAt: 'x', updatedAt: 'x' };

test('lists sites and opens create and edit', async () => {
  const navigation = fakeNavigation();
  await renderWithAuth(<SitesScreen navigation={navigation as never} route={{} as never} />, {
    api: fakeApi({ listSites: jest.fn(async () => [site, { ...site, id: 's2', name: 'Old yard', address: null, isActive: false }]) }),
    state: loggedIn(adminUser),
  });
  expect(await screen.findByText('Plot 7')).toBeOnTheScreen();
  expect(screen.getByText('Hinjewadi · 100 m')).toBeOnTheScreen();
  expect(screen.getByText('Inactive')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Plot 7/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('SiteEdit', { id: 's1' });
  await fireEvent.press(screen.getByRole('button', { name: 'Add site' }));
  expect(navigation.navigate).toHaveBeenCalledWith('SiteEdit', {});
});
