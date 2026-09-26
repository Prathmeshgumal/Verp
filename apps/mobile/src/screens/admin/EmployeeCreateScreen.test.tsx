import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { CreatedEmployeeDto, SiteDto } from '@ve/shared';
import { ApiError } from '../../api/errors';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { EmployeeCreateScreen } from './EmployeeCreateScreen';

const site: SiteDto = {
  id: 's1',
  name: 'Plot 7',
  lat: 18.59,
  lng: 73.73,
  radiusM: 100,
  address: null,
  isActive: true,
  createdAt: 'x',
  updatedAt: 'x',
};
const created: CreatedEmployeeDto = {
  employee: { id: 'e9', name: 'Sunita Jadhav', phone: '+919812345678', employeeCode: null, siteId: 's1', siteName: 'Plot 7', isActive: true, lockedUntil: null, createdAt: 'x' },
  pin: '482913',
};

async function renderCreate(createEmployee = jest.fn(async () => created)) {
  const navigation = fakeNavigation();
  await renderWithAuth(<EmployeeCreateScreen navigation={navigation as never} route={{} as never} />, {
    api: fakeApi({ createEmployee, listSites: jest.fn(async () => [site, { ...site, id: 's2', name: 'Old site', isActive: false }]) }),
    state: loggedIn(adminUser),
  });
  return { createEmployee, navigation };
}

async function fill() {
  await fireEvent.changeText(screen.getByLabelText('Full name'), ' Sunita Jadhav ');
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '98123 45678');
  await fireEvent.press(await screen.findByRole('radio', { name: 'Plot 7' }));
}

test('creates the employee and shows the PIN once', async () => {
  const { createEmployee, navigation } = await renderCreate();
  await fill();
  expect(screen.queryByRole('radio', { name: 'Old site' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Create employee' }));
  expect(await screen.findByText('482913')).toBeOnTheScreen();
  expect(screen.getByText('PIN for Sunita Jadhav')).toBeOnTheScreen();
  expect(createEmployee).toHaveBeenCalledWith({ name: 'Sunita Jadhav', phone: '98123 45678', employeeCode: undefined, siteId: 's1' });
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(navigation.goBack).toHaveBeenCalled();
});

test('a phone number already in use is explained', async () => {
  await renderCreate(
    jest.fn(async () => {
      throw new ApiError(409, 'PHONE_TAKEN', 'x', null);
    }),
  );
  await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Create employee' }));
  expect(await screen.findByText('This phone number is already used')).toBeOnTheScreen();
});

test('a bad phone number is caught on the phone', async () => {
  const { createEmployee } = await renderCreate();
  await fireEvent.changeText(screen.getByLabelText('Full name'), 'Sunita');
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '123');
  await fireEvent.press(screen.getByRole('button', { name: 'Create employee' }));
  expect(await screen.findByText('Enter a valid phone number')).toBeOnTheScreen();
  await waitFor(() => expect(createEmployee).not.toHaveBeenCalled());
});
