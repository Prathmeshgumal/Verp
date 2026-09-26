import { screen, waitFor, within } from '@testing-library/react';
import type { EmployeeDetailDto } from '@ve/shared';
import { expect, test, vi } from 'vitest';
import type { Api } from '../../api/endpoints';
import { NetworkError } from '../../api/errors';
import { addDays, todayIn } from '../../lib/time';
import { adminDay, employee, site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import { EmployeeDetailPage } from './EmployeeDetailPage';

function detail(overrides: Partial<EmployeeDetailDto> = {}): EmployeeDetailDto {
  return {
    ...employee(),
    sessions: [{ id: 'ss1', deviceId: 'a1b2c3d4e5', deviceModel: 'Redmi 9A', createdAt: '2026-09-20T04:00:00.000Z', lastUsedAt: '2026-09-25T03:30:00.000Z' }],
    ...overrides,
  };
}

function renderPage(api: Partial<Api> = {}, emp = detail()) {
  const listAttendance = vi.fn(async () => ({ items: [adminDay()], total: 1, page: 1, pageSize: 100 }));
  const utils = renderWithProviders(<EmployeeDetailPage />, {
    route: '/employees/e1',
    path: '/employees/:id',
    api: { getEmployee: vi.fn(async () => emp), listSites: vi.fn(async () => [site()]), listAttendance, ...api },
  });
  return { ...utils, listAttendance };
}

const dialog = () => screen.getByRole('dialog');

test('shows the profile, phones and the last 30 days in company time', async () => {
  const { listAttendance } = renderPage();
  expect(await screen.findByRole('heading', { name: 'Ravi Kumar' })).toBeInTheDocument();
  expect(screen.getByText('Redmi 9A')).toBeInTheDocument();
  expect(screen.getByText('25 Sep 2026, 09:00')).toBeInTheDocument();
  const day = await screen.findByRole('row', { name: /Fri 25 Sep 2026/ });
  expect(within(day).getByText('09:05')).toBeInTheDocument();
  expect(within(day).getByText('17:40')).toBeInTheDocument();
  expect(within(day).getByText('8h 35m')).toBeInTheDocument();
  const today = todayIn('Asia/Kolkata');
  expect(listAttendance).toHaveBeenCalledWith({ from: addDays(today, -29), to: today, employeeId: 'e1', page: 1, pageSize: 100 });
  expect(screen.getByRole('link', { name: 'Open in Attendance' })).toHaveAttribute(
    'href',
    `/attendance?from=${addDays(today, -29)}&to=${today}&employeeId=e1`,
  );
});

test('reset PIN asks first, then shows the new PIN once', async () => {
  const resetPin = vi.fn(async () => ({ pin: '604211' }));
  const { user } = renderPage({ resetPin });
  await user.click(await screen.findByRole('button', { name: 'Reset PIN' }));
  expect(resetPin).not.toHaveBeenCalled();
  await user.click(within(dialog()).getByRole('button', { name: 'Reset PIN' }));
  expect(await screen.findByTestId('pin-value')).toHaveTextContent('604211');
  expect(resetPin).toHaveBeenCalledWith('e1');
});

test('deactivate asks first and turns the account off', async () => {
  const updateEmployee = vi.fn(async () => employee({ isActive: false }));
  const { user } = renderPage({ updateEmployee });
  await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
  await user.click(within(dialog()).getByRole('button', { name: 'Deactivate' }));
  await waitFor(() => expect(updateEmployee).toHaveBeenCalledWith('e1', { isActive: false }));
  expect(await screen.findByText('Employee deactivated')).toBeInTheDocument();
});

test('unlock only shows for a locked account', async () => {
  renderPage();
  await screen.findByRole('heading', { name: 'Ravi Kumar' });
  expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
});

test('a locked account can be unlocked', async () => {
  const unlockEmployee = vi.fn(async () => undefined);
  const { user } = renderPage({ unlockEmployee }, detail({ lockedUntil: '2099-01-01T00:00:00Z' }));
  await user.click(await screen.findByRole('button', { name: 'Unlock' }));
  expect(unlockEmployee).toHaveBeenCalledWith('e1');
  expect(await screen.findByText('Unlocked')).toBeInTheDocument();
});

test('editing sends the cleaned-up mobile number', async () => {
  const updateEmployee = vi.fn(async () => employee({ phone: '+919812345678' }));
  const { user } = renderPage({ updateEmployee });
  const phone = await screen.findByLabelText(/Mobile number/);
  await user.clear(phone);
  await user.type(phone, '98123 45678');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(updateEmployee).toHaveBeenCalledWith('e1', { name: 'Ravi Kumar', phone: '+919812345678', employeeCode: 'VE-014', siteId: 's1' }),
  );
  expect(await screen.findByText('Saved')).toBeInTheDocument();
});

test('a failed action says why', async () => {
  const revokeSessions = vi.fn(async () => {
    throw new NetworkError('offline');
  });
  const { user } = renderPage({ revokeSessions });
  await user.click(await screen.findByRole('button', { name: 'Log out everywhere' }));
  await user.click(within(dialog()).getByRole('button', { name: 'Log out everywhere' }));
  expect(await screen.findByText('Cannot reach the server. Check your internet')).toBeInTheDocument();
});
