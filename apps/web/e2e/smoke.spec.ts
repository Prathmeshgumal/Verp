import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { apiUrl, E2E } from './env';

test.beforeEach(async ({ page }) => {
  // OSM tile usage policy: no automated traffic to the public servers.
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204 }));
  await page.route(/nominatim\.openstreetmap\.org/, (route) => route.fulfill({ json: [] }));
});

test('log in, add a site and a worker, see their check-in, export CSV', async ({ page, request }) => {
  const stamp = String(Date.now()).slice(-6);
  const siteName = `Plot ${stamp}`;
  const workerName = `Ravi ${stamp}`;
  const mobile = `98${stamp}00`;

  // Log in; the session survives a reload through the refresh cookie.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(E2E.adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

  // Site.
  await page.getByRole('link', { name: 'Sites' }).click();
  await page.getByRole('link', { name: 'Add site' }).click();
  await page.getByLabel('Site name').fill(siteName);
  await page.getByLabel('Latitude').fill('18.5912');
  await page.getByLabel('Longitude').fill('73.7389');
  await page.getByRole('button', { name: 'Save site' }).click();
  await expect(page.getByRole('link', { name: siteName })).toBeVisible();

  // Worker; the PIN is shown once.
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.getByRole('button', { name: 'Add employee' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill(workerName);
  await dialog.getByLabel('Mobile number').fill(mobile);
  await dialog.getByLabel('Site').selectOption({ label: siteName });
  await dialog.getByRole('button', { name: 'Create employee' }).click();
  const pin = (await page.getByTestId('pin-value').textContent())?.trim() ?? '';
  expect(pin).toMatch(/^\d{6}$/);
  await page.getByRole('button', { name: 'Done' }).click();

  // The worker checks in at the site through the API, as the phone app would.
  const login = await request.post(`${apiUrl}/auth/employee/login`, { data: { phone: mobile, pin, deviceId: 'e2e-phone' } });
  expect(login.status()).toBe(200);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const checkIn = await request.post(`${apiUrl}/attendance/check-in`, {
    headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': randomUUID() },
    data: { lat: 18.5913, lng: 73.739, accuracyM: 8, isMock: false, deviceTime: new Date().toISOString(), deviceId: 'e2e-phone' },
  });
  expect(checkIn.status()).toBe(200);

  // Attendance shows the day; the drawer shows the attempt.
  await page.getByRole('link', { name: 'Attendance' }).click();
  await page.getByRole('button', { name: workerName }).click();
  const drawer = page.getByRole('dialog', { name: 'Attendance day' });
  await expect(drawer.getByText('Check-in · Saved')).toBeVisible();
  await drawer.getByRole('button', { name: 'Close' }).click();

  // CSV export of the current filter.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^attendance_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('Employee Code');
  expect(csv).toContain(workerName);
});
