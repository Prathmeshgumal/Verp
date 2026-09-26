import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { EmployeeDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { EmployeesScreen } from './EmployeesScreen';

const emp: EmployeeDto = {
  id: 'e1',
  name: 'Anil Pawar',
  phone: '+919876543210',
  employeeCode: 'E-7',
  siteId: 's1',
  siteName: 'Plot 7',
  isActive: true,
  lockedUntil: null,
  createdAt: '2026-09-01T00:00:00Z',
};

async function renderEmployees() {
  const listEmployees = jest.fn(async () => [emp]);
  const navigation = fakeNavigation();
  await renderWithAuth(<EmployeesScreen navigation={navigation as never} route={{} as never} />, {
    api: fakeApi({ listEmployees }),
    state: loggedIn(adminUser),
  });
  return { listEmployees, navigation };
}

test('lists active employees with phone, code and site', async () => {
  const { listEmployees } = await renderEmployees();
  expect(await screen.findByText('Anil Pawar')).toBeOnTheScreen();
  expect(screen.getByText('+919876543210 · E-7 · Plot 7')).toBeOnTheScreen();
  expect(listEmployees).toHaveBeenCalledWith({ q: '', isActive: true });
});

test('search waits for typing to stop, then asks the server', async () => {
  const { listEmployees } = await renderEmployees();
  await screen.findByText('Anil Pawar');
  await fireEvent.changeText(screen.getByLabelText('Name, phone or code'), 'anil');
  await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: 'anil', isActive: true }));
});

test('Inactive shows deactivated employees', async () => {
  const { listEmployees } = await renderEmployees();
  await fireEvent.press(await screen.findByRole('button', { name: 'Inactive' }));
  await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: '', isActive: false }));
});

test('add and open', async () => {
  const { navigation } = await renderEmployees();
  await fireEvent.press(await screen.findByRole('button', { name: /Anil Pawar/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('EmployeeDetail', { id: 'e1' });
  await fireEvent.press(screen.getByRole('button', { name: 'Add employee' }));
  expect(navigation.navigate).toHaveBeenCalledWith('EmployeeCreate');
});
