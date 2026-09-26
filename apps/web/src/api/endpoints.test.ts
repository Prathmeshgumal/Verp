// @vitest-environment node
import { expect, test, vi } from 'vitest';
import type { ApiClient } from './client';
import { createApi } from './endpoints';

function fakeClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    request: vi.fn(async () => undefined),
    requestRaw: vi.fn(async () => new Response('')),
    login: vi.fn(),
    restore: vi.fn(),
    logout: vi.fn(),
    onAuthLost: vi.fn(() => () => {}),
    ...overrides,
  } as ApiClient;
}

test('attendance list sends filters and leaves out "any" values', async () => {
  const client = fakeClient();
  await createApi(client).listAttendance({ from: '2026-09-01', to: '2026-09-25', needsReview: false, page: 2, pageSize: 50 });
  expect(client.request).toHaveBeenCalledWith('GET', '/admin/attendance', {
    query: { from: '2026-09-01', to: '2026-09-25', employeeId: undefined, siteId: undefined, status: undefined, needsReview: undefined, page: 2, pageSize: 50 },
  });
});

test('needs review true is sent as the string true', async () => {
  const client = fakeClient();
  await createApi(client).listAttendance({ from: '2026-09-01', to: '2026-09-25', needsReview: true, page: 1, pageSize: 50 });
  expect(vi.mocked(client.request).mock.calls[0]![2]).toMatchObject({ query: { needsReview: 'true' } });
});

test('actions without a body send none', async () => {
  const client = fakeClient();
  const api = createApi(client);
  await api.resetPin('e1');
  await api.markReviewed('d1');
  expect(client.request).toHaveBeenNthCalledWith(1, 'POST', '/admin/employees/e1/reset-pin', {});
  expect(client.request).toHaveBeenNthCalledWith(2, 'POST', '/admin/attendance/d1/review', {});
});

test('csv export returns the file with the same name the server gives it', async () => {
  const client = fakeClient({ requestRaw: vi.fn(async () => new Response('Employee Code,Employee\n', { status: 200 })) });
  const file = await createApi(client).exportAttendanceCsv({ from: '2026-09-01', to: '2026-09-25', siteId: 's1' });
  expect(client.requestRaw).toHaveBeenCalledWith('GET', '/admin/attendance/export.csv', {
    query: { from: '2026-09-01', to: '2026-09-25', employeeId: undefined, siteId: 's1', status: undefined, needsReview: undefined },
  });
  expect(file.filename).toBe('attendance_2026-09-01_2026-09-25.csv');
  await expect(file.blob.text()).resolves.toBe('Employee Code,Employee\n');
});
