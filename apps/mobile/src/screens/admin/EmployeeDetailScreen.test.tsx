import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { EmployeeDetailDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { EmployeeDetailScreen } from './EmployeeDetailScreen';

const detail: EmployeeDetailDto = {
  id: 'e1',
  name: 'Anil Pawar',
  phone: '+919876543210',
  employeeCode: 'E-7',
  siteId: 's1',
  siteName: 'Plot 7',
  isActive: true,
  lockedUntil: null,
  createdAt: '2026-09-01T00:00:00Z',
  sessions: [{ id: 'x1', deviceId: 'dev', deviceModel: 'Redmi 9A', createdAt: '2026-09-01T00:00:00Z', lastUsedAt: '2026-09-25T03:32:00Z' }],
};

async function renderDetail(resetPin = jest.fn(async () => ({ pin: '555123' }))) {
  const parent = { navigate: jest.fn() };
  const navigation = { ...fakeNavigation(), getParent: () => parent };
  await renderWithAuth(
    <EmployeeDetailScreen navigation={navigation as never} route={{ key: 'k', name: 'EmployeeDetail', params: { id: 'e1' } } as never} />,
    { api: fakeApi({ getEmployee: jest.fn(async () => detail), resetPin }), state: loggedIn(adminUser) },
  );
  return { parent, resetPin };
}

test('shows the profile and phones used', async () => {
  await renderDetail();
  expect(await screen.findByText('Anil Pawar')).toBeOnTheScreen();
  expect(screen.getByText('Redmi 9A')).toBeOnTheScreen();
  expect(screen.getByText('Active')).toBeOnTheScreen();
});

test('reset PIN asks first, then shows the new PIN once', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { resetPin } = await renderDetail();
  await fireEvent.press(await screen.findByRole('button', { name: 'Reset PIN' }));
  expect(resetPin).not.toHaveBeenCalled();
  await act(async () => alert.mock.calls[0]?.[2]?.[1]?.onPress?.());
  expect(await screen.findByText('555123')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByText('555123')).toBeNull();
});

test('View attendance opens the Attendance tab filtered to this employee', async () => {
  const { parent } = await renderDetail();
  await fireEvent.press(await screen.findByRole('button', { name: 'View attendance' }));
  expect(parent.navigate).toHaveBeenCalledWith('AttendanceTab', {
    screen: 'AttendanceList',
    params: { employeeId: 'e1', employeeName: 'Anil Pawar' },
  });
});
