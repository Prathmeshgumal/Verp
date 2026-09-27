import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { fakeNavigation, renderWithAuth } from '../../testing/render';
import { WorkerLoginScreen } from './WorkerLoginScreen';

const loggedOut = (reason: string | null = null) => ({ status: 'loggedOut' as const, reason });

async function renderLogin(loginEmployee = jest.fn(async () => {}), reason: string | null = null) {
  const navigation = fakeNavigation();
  await renderWithAuth(<WorkerLoginScreen navigation={navigation as never} route={{} as never} />, {
    state: loggedOut(reason),
    auth: { loginEmployee },
  });
  return { navigation, loginEmployee };
}

/** The PIN is a real text box (the phone's own number keyboard), typed into one digit at a time. */
async function typePin(pin: string) {
  let typed = '';
  for (const digit of pin) {
    typed += digit;
    await fireEvent.changeText(screen.getByLabelText('PIN'), typed);
  }
}

test('phone plus six digits logs in', async () => {
  const { loginEmployee } = await renderLogin();
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '98765 43210');
  await typePin('123456');
  await waitFor(() => expect(loginEmployee).toHaveBeenCalledWith('98765 43210', '123456'));
});

test('an invalid phone number is caught before calling the server', async () => {
  const { loginEmployee } = await renderLogin();
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '12345');
  await typePin('123456');
  expect(await screen.findByText('Enter a valid phone number')).toBeOnTheScreen();
  expect(loginEmployee).not.toHaveBeenCalled();
});

test('a wrong PIN shows a plain message and clears the PIN', async () => {
  await renderLogin(
    jest.fn(async () => {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid phone or PIN', null);
    }),
  );
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
  await typePin('111111');
  expect(await screen.findByText('Wrong phone or PIN')).toBeOnTheScreen();
  expect(screen.getByLabelText('0 of 6 digits entered')).toBeOnTheScreen();
});

test('the PIN uses the phone number keyboard, keeps digits only and shows how many are typed', async () => {
  await renderLogin();
  const pin = screen.getByLabelText('PIN');
  expect(pin.props.keyboardType).toBe('number-pad');
  expect(screen.queryByRole('button', { name: '5' })).toBeNull();
  await fireEvent.changeText(pin, '1a2-');
  expect(screen.getByLabelText('2 of 6 digits entered')).toBeOnTheScreen();
  await fireEvent.changeText(pin, '1');
  expect(screen.getByLabelText('1 of 6 digits entered')).toBeOnTheScreen();
});

test('Next on the phone keyboard moves to the PIN', async () => {
  await renderLogin();
  const phone = screen.getByLabelText('Phone number');
  expect(phone.props.returnKeyType).toBe('next');
});

test('shows why the worker was logged out', async () => {
  await renderLogin(undefined, 'ACCOUNT_INACTIVE');
  expect(screen.getByText('Please contact your supervisor')).toBeOnTheScreen();
});

test('admin login link opens the admin screen', async () => {
  const { navigation } = await renderLogin();
  await fireEvent.press(screen.getByRole('button', { name: 'Admin login' }));
  expect(navigation.navigate).toHaveBeenCalledWith('AdminLogin');
});
