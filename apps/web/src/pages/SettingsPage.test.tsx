import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { NetworkError } from '../api/errors';
import { queryKeys } from '../lib/queryKeys';
import { testSettings } from '../testing/fakes';
import { renderWithProviders } from '../testing/render';
import { SettingsPage } from './SettingsPage';

test('shows the current settings', () => {
  renderWithProviders(<SettingsPage />);
  expect(screen.getByLabelText('Time zone')).toHaveValue('Asia/Kolkata');
  expect(screen.getByLabelText('Required GPS accuracy (metres)')).toHaveValue('50');
  expect(screen.getByLabelText('Check-out reminder time')).toHaveValue('19:00');
});

test('saving sends the new values and updates the whole app', async () => {
  const saved = { ...testSettings, maxAccuracyM: 30, reminderTime: '18:30' };
  const updateSettings = vi.fn(async () => saved);
  const { user, queryClient } = renderWithProviders(<SettingsPage />, { api: { updateSettings } });
  const accuracy = screen.getByLabelText('Required GPS accuracy (metres)');
  await user.clear(accuracy);
  await user.type(accuracy, '30');
  fireEvent.change(screen.getByLabelText('Check-out reminder time'), { target: { value: '18:30' } });
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() =>
    expect(updateSettings).toHaveBeenCalledWith({
      timezone: 'Asia/Kolkata',
      maxAccuracyM: 30,
      defaultRadiusM: 100,
      reminderTime: '18:30',
      clockMismatchMinutes: 10,
    }),
  );
  expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  expect(queryClient.getQueryData(queryKeys.settings)).toEqual(saved);
});

test('values outside the allowed range are caught before sending', async () => {
  const updateSettings = vi.fn();
  const { user } = renderWithProviders(<SettingsPage />, { api: { updateSettings } });
  const accuracy = screen.getByLabelText('Required GPS accuracy (metres)');
  await user.clear(accuracy);
  await user.type(accuracy, '2');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(screen.getByText('At least 5 m')).toBeInTheDocument();
  expect(updateSettings).not.toHaveBeenCalled();
});

test('a failed save says why and keeps the typed values', async () => {
  const updateSettings = vi.fn(async () => {
    throw new NetworkError('offline');
  });
  const { user } = renderWithProviders(<SettingsPage />, { api: { updateSettings } });
  const accuracy = screen.getByLabelText('Required GPS accuracy (metres)');
  await user.clear(accuracy);
  await user.type(accuracy, '40');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(await screen.findByText('Cannot reach the server. Check your internet')).toBeInTheDocument();
  expect(accuracy).toHaveValue('40');
});
