import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { fakeNavigation, renderWithAuth } from '../../testing/render';
import { AdminLoginScreen } from './AdminLoginScreen';

async function renderAdmin(loginAdmin = jest.fn(async () => {})) {
  const navigation = fakeNavigation();
  await renderWithAuth(<AdminLoginScreen navigation={navigation as never} route={{} as never} />, {
    state: { status: 'loggedOut', reason: null },
    auth: { loginAdmin },
  });
  return { navigation, loginAdmin };
}

test('logs in with email and password', async () => {
  const { loginAdmin } = await renderAdmin();
  await fireEvent.changeText(screen.getByLabelText('Email'), 'admin@ve.test');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'long-password-1');
  await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(loginAdmin).toHaveBeenCalledWith('admin@ve.test', 'long-password-1'));
});

test('wrong credentials show a plain message', async () => {
  await renderAdmin(
    jest.fn(async () => {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'x', null);
    }),
  );
  await fireEvent.changeText(screen.getByLabelText('Email'), 'admin@ve.test');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'nope-nope-nope');
  await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByText('Wrong email or password')).toBeOnTheScreen();
});

test('worker login link goes back', async () => {
  const { navigation } = await renderAdmin();
  await fireEvent.press(screen.getByRole('button', { name: 'Worker login' }));
  expect(navigation.goBack).toHaveBeenCalled();
});
