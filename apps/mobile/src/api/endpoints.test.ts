import type { AttendanceSubmit } from '@ve/shared';
import type { ApiClient } from './client';
import { createApi } from './endpoints';
import { ApiError } from './errors';

function clientReturning(impl: ApiClient['request']): ApiClient & { request: jest.Mock } {
  return {
    request: jest.fn(impl),
    startSession: jest.fn(),
    endSession: jest.fn(),
    getRefreshToken: jest.fn(),
    onAuthLost: jest.fn(),
  } as unknown as ApiClient & { request: jest.Mock };
}

const body: AttendanceSubmit = {
  lat: 18.59,
  lng: 73.73,
  accuracyM: 12,
  isMock: false,
  deviceTime: '2026-09-25T09:02:00.000+05:30',
  deviceId: 'device-1',
};

test('checkIn sends the idempotency key header', async () => {
  const client = clientReturning(async () => ({ code: 'OK', message: 'ok', serverTime: 'x' }) as never);
  await createApi(client).checkIn('key-1', body);
  expect(client.request).toHaveBeenCalledWith('POST', '/attendance/check-in', {
    body,
    headers: { 'Idempotency-Key': 'key-1' },
  });
});

test('business rejections come back as results, not errors', async () => {
  const result = { code: 'OUTSIDE_SITE', message: 'far', serverTime: 'x', distanceM: 120 };
  const client = clientReturning(async () => {
    throw new ApiError(422, 'OUTSIDE_SITE', 'far', result);
  });
  await expect(createApi(client).checkOut('key-1', body)).resolves.toEqual(result);
});

test('other API errors still throw', async () => {
  const client = clientReturning(async () => {
    throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'conflict', {});
  });
  await expect(createApi(client).checkIn('key-1', body)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
});

test('listEmployees sends isActive as the string the API expects and drops empty search', async () => {
  const client = clientReturning(async () => [] as never);
  await createApi(client).listEmployees({ q: '', isActive: false });
  expect(client.request).toHaveBeenCalledWith('GET', '/admin/employees', {
    query: { q: undefined, siteId: undefined, isActive: 'false' },
  });
});

test('login endpoints are public', async () => {
  const client = clientReturning(async () => ({}) as never);
  await createApi(client).loginEmployee({ phone: '9876543210', pin: '123456', deviceId: 'd' });
  expect(client.request).toHaveBeenCalledWith('POST', '/auth/employee/login', {
    auth: false,
    body: { phone: '9876543210', pin: '123456', deviceId: 'd' },
  });
});
