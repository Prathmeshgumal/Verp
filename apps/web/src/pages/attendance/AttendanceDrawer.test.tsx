import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AdminDayDetailDto, AdminDayDto, AttendanceEventDto } from '@ve/shared';
import { expect, test, vi } from 'vitest';
import type { Api } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { adminDay } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import { AttendanceDrawer } from './AttendanceDrawer';

vi.mock('./DayMap', () => ({ DayMap: () => <div data-testid="day-map" /> }));

const baseEvent: AttendanceEventDto = {
  id: 'ev1',
  type: 'IN',
  result: 'OUTSIDE_SITE',
  serverTime: '2026-09-25T03:30:00.000Z',
  deviceTime: '2026-09-25T03:30:00.000Z',
  lat: 18.594,
  lng: 73.741,
  accuracyM: 30,
  distanceM: 240.4,
  isMock: false,
  deviceId: 'dev1',
  deviceModel: 'Redmi 9A',
  appVersion: '0.1.0',
};

function detail(day: AdminDayDto = adminDay()): AdminDayDetailDto {
  return {
    day,
    site: { id: 's1', name: 'Plot 7', lat: 18.5912, lng: 73.7389, radiusM: 100 },
    events: [baseEvent, { ...baseEvent, id: 'ev2', result: 'ACCEPTED', serverTime: '2026-09-25T03:35:00.000Z', accuracyM: 12, distanceM: 14 }],
  };
}

function renderDrawer(api: Partial<Api>) {
  const onClose = vi.fn();
  const utils = renderWithProviders(<AttendanceDrawer dayId="d1" onClose={onClose} />, { api });
  return { ...utils, onClose };
}

const missed = adminDay({ status: 'MISSED_CHECKOUT', checkOutAt: null, workedMinutes: null, checkOutLat: null, checkOutLng: null, checkOutAccuracyM: null, checkOutDistanceM: null });

test('shows the day, its flags and every attempt in company time', async () => {
  renderDrawer({ getAttendance: vi.fn(async () => detail(adminDay({ flags: ['MOCK_LOCATION'], needsReview: true }))) });
  expect(await screen.findByRole('heading', { name: 'Ravi Kumar' })).toBeInTheDocument();
  expect(screen.getByText('Fake GPS app')).toBeInTheDocument();
  expect(screen.getByText('Needs review')).toBeInTheDocument();
  expect(screen.getByTestId('day-map')).toBeInTheDocument();
  expect(screen.getByText('Check-in · Outside the site')).toBeInTheDocument();
  expect(screen.getByText('25 Sep 2026, 09:00')).toBeInTheDocument();
  expect(screen.getByText('Check-in · Saved')).toBeInTheDocument();
  expect(screen.getByText(/240 m from the centre/)).toBeInTheDocument();
  expect(screen.getByText('8h 35m')).toBeInTheDocument();
});

test('mark reviewed clears the review flag', async () => {
  const getAttendance = vi
    .fn()
    .mockResolvedValueOnce(detail(adminDay({ needsReview: true })))
    .mockResolvedValue(detail(adminDay({ needsReview: false, reviewedAt: '2026-09-25T06:00:00.000Z' })));
  const markReviewed = vi.fn(async () => adminDay({ needsReview: false }));
  const { user } = renderDrawer({ getAttendance, markReviewed });
  await user.click(await screen.findByRole('button', { name: 'Mark reviewed' }));
  expect(markReviewed).toHaveBeenCalledWith('d1');
  expect(await screen.findByText('Marked as reviewed')).toBeInTheDocument();
  expect(await screen.findByText('Reviewed 25 Sep 2026, 11:30')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark reviewed' })).not.toBeInTheDocument();
});

test('fix check-out sends the typed time as company time', async () => {
  const fixCheckout = vi.fn(async () => adminDay());
  const { user } = renderDrawer({ getAttendance: vi.fn(async () => detail(missed)), fixCheckout });
  await user.click(await screen.findByRole('button', { name: 'Fix check-out' }));
  const time = screen.getByLabelText('Check-out time');
  expect(time).toHaveValue('2026-09-25T18:00');
  fireEvent.change(time, { target: { value: '2026-09-25T18:30' } });
  await user.type(screen.getByLabelText('Reason'), 'Supervisor confirmed');
  await user.click(screen.getByRole('button', { name: 'Save check-out' }));
  await waitFor(() =>
    expect(fixCheckout).toHaveBeenCalledWith('d1', { checkOutAt: '2026-09-25T18:30:00+05:30', reason: 'Supervisor confirmed' }),
  );
  expect(await screen.findByText('Check-out fixed')).toBeInTheDocument();
  expect(screen.queryByLabelText('Check-out time')).not.toBeInTheDocument();
});

test('rejected check-out time shows the reason and keeps the form', async () => {
  const fixCheckout = vi.fn(async () => {
    throw new ApiError(400, 'INVALID_CHECKOUT_TIME', 'x');
  });
  const { user } = renderDrawer({ getAttendance: vi.fn(async () => detail(missed)), fixCheckout });
  await user.click(await screen.findByRole('button', { name: 'Fix check-out' }));
  fireEvent.change(screen.getByLabelText('Check-out time'), { target: { value: '2026-09-25T08:00' } });
  await user.type(screen.getByLabelText('Reason'), 'Left early');
  await user.click(screen.getByRole('button', { name: 'Save check-out' }));
  expect(await screen.findByText('Check-out must be after check-in, on the same day, and not in the future')).toBeInTheDocument();
  expect(screen.getByLabelText('Check-out time')).toHaveValue('2026-09-25T08:00');
  expect(screen.queryByText('Check-out fixed')).not.toBeInTheDocument();
});

test('a reason is required', async () => {
  const fixCheckout = vi.fn();
  const { user } = renderDrawer({ getAttendance: vi.fn(async () => detail(missed)), fixCheckout });
  await user.click(await screen.findByRole('button', { name: 'Fix check-out' }));
  await user.click(screen.getByRole('button', { name: 'Save check-out' }));
  expect(screen.getByText('Say why, in a few words')).toBeInTheDocument();
  expect(fixCheckout).not.toHaveBeenCalled();
});

test('a day still in progress cannot be fixed yet', async () => {
  renderDrawer({
    getAttendance: vi.fn(async () =>
      detail(adminDay({ status: 'CHECKED_IN', checkOutAt: null, workedMinutes: null, checkOutLat: null, checkOutLng: null, checkOutAccuracyM: null, checkOutDistanceM: null })),
    ),
  });
  expect(await screen.findByText('Still checked in. The check-out can be fixed once the day is closed.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Fix check-out' })).not.toBeInTheDocument();
});
