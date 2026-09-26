import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './Button';

test('calls onPress when tapped', async () => {
  const onPress = jest.fn();
  await render(<Button label="CHECK IN" variant="checkIn" size="big" icon="checkIn" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'CHECK IN' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a disabled button ignores taps and says so to screen readers', async () => {
  const onPress = jest.fn();
  await render(<Button label="Save" onPress={onPress} disabled />);
  const button = screen.getByRole('button', { name: 'Save' });
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  expect(button).toBeDisabled();
});
