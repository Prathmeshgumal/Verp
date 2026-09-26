import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { Api } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { saveBlob } from '../../lib/download';
import { todayIn } from '../../lib/time';
import { adminDay, employee, site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import { AttendancePage } from './AttendancePage';

vi.mock('../../lib/download', () => ({ saveBlob: vi.fn() }));

function renderPage(route = '/attendance', api: Partial<Api> = {}, total = 1) {
  const listAttendance = vi.fn(async () => ({ items: [adminDay()], total, page: 1, pageSize: 50 }));
  const utils = renderWithProviders(<AttendancePage />, {
    route,
    path: '/attendance',
    api: {
      listAttendance,
      listEmployees: vi.fn(async () => [employee()]),
      listSites: vi.fn(async () => [site()]),
      ...api,
    },
  });
  return { ...utils, listAttendance };
}

test('defaults to today in company time and shows each day', async () => {
  const { listAttendance } = renderPage();
  const row = (await screen.findByRole('button', { name: 'Ravi Kumar' })).closest('tr')!;
  for (const text of ['Plot 7', '09:05', '17:40', '8h 35m', 'Completed']) {
    expect(within(row).getByText(text)).toBeInTheDocument();
  }
  const today = todayIn('Asia/Kolkata');
  expect(listAttendance).toHaveBeenCalledWith({ from: today, to: today, page: 1, pageSize: 50 });
  expect(screen.getByLabelText('From')).toHaveValue(today);
});

test('filters in the URL are used, as linked from the dashboard and employee pages', async () => {
  const { listAttendance } = renderPage('/attendance?from=2026-09-01&to=2026-09-25&employeeId=e1&needsReview=true');
  await screen.findByRole('button', { name: 'Ravi Kumar' });
  expect(listAttendance).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-25', employeeId: 'e1', needsReview: true, page: 1, pageSize: 50 });
  await waitFor(() => expect(screen.getByLabelText('Employee')).toHaveValue('e1'));
  expect(screen.getByLabelText('Needs review only')).toBeChecked();
});

test('changing a filter updates the URL and the query', async () => {
  const { user, listAttendance } = renderPage('/attendance?from=2026-09-01&to=2026-09-25');
  await screen.findByRole('button', { name: 'Ravi Kumar' });
  await user.selectOptions(screen.getByLabelText('Status'), 'Missed check-out');
  await waitFor(() => expect(listAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'MISSED_CHECKOUT', page: 1 })));
  expect(screen.getByTestId('location')).toHaveTextContent('status=MISSED_CHECKOUT');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-20' } });
  await waitFor(() => expect(listAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-20', to: '2026-09-25' })));
});

test('paging asks for the next page', async () => {
  const { user, listAttendance } = renderPage('/attendance?from=2026-09-01&to=2026-09-25', {}, 120);
  await screen.findByRole('button', { name: 'Ravi Kumar' });
  await user.click(screen.getByRole('button', { name: '2' }));
  await waitFor(() => expect(listAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  expect(screen.getByTestId('location')).toHaveTextContent('page=2');
});

test('export downloads the csv for the current filters', async () => {
  const blob = new Blob(['Employee Code\n']);
  const exportAttendanceCsv = vi.fn(async () => ({ blob, filename: 'attendance_2026-09-01_2026-09-25.csv' }));
  const { user } = renderPage('/attendance?from=2026-09-01&to=2026-09-25&siteId=s1&page=2', { exportAttendanceCsv });
  await screen.findByRole('button', { name: 'Ravi Kumar' });
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, 'attendance_2026-09-01_2026-09-25.csv'));
  expect(exportAttendanceCsv).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-25', siteId: 's1' });
});

test('export refused by the server shows why', async () => {
  const exportAttendanceCsv = vi.fn(async () => {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Export has 9000 rows, more than the 5000 limit; narrow the date range');
  });
  const { user } = renderPage('/attendance', { exportAttendanceCsv });
  await screen.findByRole('button', { name: 'Ravi Kumar' });
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(await screen.findByText('Export has 9000 rows, more than the 5000 limit; narrow the date range')).toBeInTheDocument();
  expect(saveBlob).not.toHaveBeenCalled();
});

test('clicking a name opens that day and keeps the filters', async () => {
  const { user } = renderPage('/attendance?from=2026-09-01&to=2026-09-25');
  await user.click(await screen.findByRole('button', { name: 'Ravi Kumar' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/attendance?from=2026-09-01&to=2026-09-25&day=d1');
});
