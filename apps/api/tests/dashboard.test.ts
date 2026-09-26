import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app';
import { insertDay } from './helpers/attendance';
import { adminToken, bearer, makeAdmin, makeEmployee, makeSite } from './helpers/factories';

let app: FastifyInstance;
afterEach(async () => app?.close());

describe('GET /admin/dashboard/today', () => {
  it('summarizes today in IST', async () => {
    ({ app } = await createTestApp()); // 2026-09-25 09:30 IST
    const token = await adminToken(app, await makeAdmin());
    const site = await makeSite({ name: 'Plot 7' });
    const [a, b, c] = await Promise.all([
      makeEmployee({ name: 'Anil', siteId: site.id }),
      makeEmployee({ name: 'Bina', siteId: site.id }),
      makeEmployee({ name: 'Chetan', siteId: site.id }),
      makeEmployee({ name: 'Deepa', siteId: site.id }),
      makeEmployee({ name: 'Inactive', isActive: false }),
    ]);
    await insertDay({ employeeId: a.user.id, siteId: site.id, workDate: '2026-09-25', checkInAt: new Date('2026-09-25T03:35:00Z') });
    await insertDay({ employeeId: b.user.id, siteId: site.id, workDate: '2026-09-25', status: 'COMPLETED', needsReview: true, checkOutAt: new Date('2026-09-25T12:10:00Z') });
    await insertDay({ employeeId: c.user.id, siteId: site.id, workDate: '2026-09-24', status: 'MISSED_CHECKOUT', needsReview: true });

    const res = await app.inject({ method: 'GET', url: '/admin/dashboard/today', headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      workDate: '2026-09-25',
      activeEmployees: 4,
      checkedInToday: 2,
      workingNow: 1,
      completedToday: 1,
      notYetIn: 2,
      missedCheckouts: 1,
      needsReview: 2,
      working: [{ employeeId: a.user.id, name: 'Anil', siteName: 'Plot 7', checkInAt: '2026-09-25T03:35:00.000Z' }],
    });
    // Ordered by check-in time; yesterday's missed day is not on today's map.
    expect(body.mapDays).toEqual([
      {
        dayId: expect.any(String),
        employeeId: b.user.id,
        name: 'Bina',
        siteId: site.id,
        siteName: 'Plot 7',
        status: 'COMPLETED',
        checkInAt: '2026-09-25T03:30:00.000Z',
        checkOutAt: '2026-09-25T12:10:00.000Z',
        checkInLat: 18.5204,
        checkInLng: 73.8567,
        needsReview: true,
      },
      {
        dayId: expect.any(String),
        employeeId: a.user.id,
        name: 'Anil',
        siteId: site.id,
        siteName: 'Plot 7',
        status: 'CHECKED_IN',
        checkInAt: '2026-09-25T03:35:00.000Z',
        checkOutAt: null,
        checkInLat: 18.5204,
        checkInLng: 73.8567,
        needsReview: false,
      },
    ]);
  });
});
