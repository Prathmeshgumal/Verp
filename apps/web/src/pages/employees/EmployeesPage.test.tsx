import { screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { employee, site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import { EmployeesPage } from './EmployeesPage';

const sites = [site(), site({ id: 's2', name: 'Old yard', isActive: false })];

function renderPage(api = {}) {
  const listEmployees = vi.fn(async () => [employee(), employee({ id: 'e2', name: 'Meena Shinde', employeeCode: null, siteId: null, siteName: null, lockedUntil: '2099-01-01T00:00:00Z' })]);
  const utils = renderWithProviders(<EmployeesPage />, { api: { listEmployees, listSites: vi.fn(async () => sites), ...api } });
  return { ...utils, listEmployees };
}

test('lists employees with site, code, mobile and status', async () => {
  const { listEmployees } = renderPage();
  const row = (await screen.findByRole('link', { name: 'Ravi Kumar' })).closest('tr')!;
  expect(within(row).getByText('+91 98765 43210')).toBeInTheDocument();
  expect(within(row).getByText('VE-014')).toBeInTheDocument();
  expect(within(row).getByText('Plot 7')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ravi Kumar' })).toHaveAttribute('href', '/employees/e1');
  expect(within(screen.getByRole('link', { name: 'Meena Shinde' }).closest('tr')!).getByText('Locked')).toBeInTheDocument();
  expect(listEmployees).toHaveBeenCalledWith({ q: undefined, siteId: undefined, isActive: true });
});

test('search waits for typing to stop and sends one query', async () => {
  const { user, listEmployees } = renderPage();
  await screen.findByRole('link', { name: 'Ravi Kumar' });
  await user.type(screen.getByLabelText('Search'), 'ravi');
  await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: 'ravi', siteId: undefined, isActive: true }));
  const searched = listEmployees.mock.calls.map((call) => (call as unknown as [{ q?: string }])[0].q);
  expect(searched).not.toContain('r');
  expect(searched).not.toContain('rav');
});

test('site and status filters change the query', async () => {
  const { user, listEmployees } = renderPage();
  await screen.findByRole('link', { name: 'Ravi Kumar' });
  await user.selectOptions(screen.getByLabelText('Site'), 'Plot 7');
  await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: undefined, siteId: 's1', isActive: true }));
  await user.selectOptions(screen.getByLabelText('Status'), 'All');
  await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: undefined, siteId: 's1', isActive: undefined }));
});

test('adding an employee shows the PIN once and refreshes the list', async () => {
  const createEmployee = vi.fn(async () => ({ employee: employee({ id: 'e3', name: 'Sunil Patil' }), pin: '482913' }));
  const { user, listEmployees } = renderPage({ createEmployee });
  await screen.findByRole('link', { name: 'Ravi Kumar' });
  await user.click(screen.getByRole('button', { name: 'Add employee' }));
  const dialog = screen.getByRole('dialog', { name: 'Add employee' });
  await user.type(within(dialog).getByLabelText('Name'), ' Sunil Patil ');
  await user.type(within(dialog).getByLabelText(/Mobile number/), '98123 45678');
  expect(within(dialog).queryByRole('option', { name: /Old yard/ })).not.toBeInTheDocument();
  await user.selectOptions(within(dialog).getByLabelText('Site'), 'Plot 7');
  await user.click(within(dialog).getByRole('button', { name: 'Create employee' }));

  expect(await screen.findByTestId('pin-value')).toHaveTextContent('482913');
  expect(createEmployee).toHaveBeenCalledWith({ name: 'Sunil Patil', phone: '+919812345678', employeeCode: undefined, siteId: 's1' });
  await waitFor(() => expect(listEmployees).toHaveBeenCalledTimes(2));
  await user.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByTestId('pin-value')).not.toBeInTheDocument();
});

test('a wrong mobile number is caught before sending', async () => {
  const createEmployee = vi.fn();
  const { user } = renderPage({ createEmployee });
  await screen.findByRole('link', { name: 'Ravi Kumar' });
  await user.click(screen.getByRole('button', { name: 'Add employee' }));
  const dialog = screen.getByRole('dialog', { name: 'Add employee' });
  await user.type(within(dialog).getByLabelText('Name'), 'Sunil');
  await user.type(within(dialog).getByLabelText(/Mobile number/), '12345');
  await user.click(within(dialog).getByRole('button', { name: 'Create employee' }));
  expect(within(dialog).getByText('Enter a 10-digit mobile number')).toBeInTheDocument();
  expect(createEmployee).not.toHaveBeenCalled();
});

test('a taken mobile number is explained and the form stays open', async () => {
  const createEmployee = vi.fn(async () => {
    throw new ApiError(409, 'PHONE_TAKEN', 'x');
  });
  const { user } = renderPage({ createEmployee });
  await screen.findByRole('link', { name: 'Ravi Kumar' });
  await user.click(screen.getByRole('button', { name: 'Add employee' }));
  const dialog = screen.getByRole('dialog', { name: 'Add employee' });
  await user.type(within(dialog).getByLabelText('Name'), 'Sunil');
  await user.type(within(dialog).getByLabelText(/Mobile number/), '9876543210');
  await user.click(within(dialog).getByRole('button', { name: 'Create employee' }));
  expect(await within(dialog).findByText('Another employee already has this mobile number')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Name')).toHaveValue('Sunil');
});
