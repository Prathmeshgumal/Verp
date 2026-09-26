import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp, type FakeClock } from './helpers/app';
import { insertDay, submit, submitBody } from './helpers/attendance';
import { eq } from 'drizzle-orm';
import { users } from '../src/db/schema';
import { testDb } from './helpers/db';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee, makeSite } from './helpers/factories';

let app: FastifyInstance;
let clock: FakeClock;
afterEach(async () => app?.close());

const get = (url: string, token: string) => app.inject({ method: 'GET', url, headers: bearer(token) });

describe('GET /me/today', () => {
  it('returns site, settings and no day before check-in', async () => {
    ({ app, clock } = await createTestApp());
    const site = await makeSite({ name: 'Plot 7', radiusM: 60 });
    const token = await employeeToken(app, await makeEmployee({ siteId: site.id }));
    const res = await get('/me/today', token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      serverTime: clock.now.toISOString(),
      workDate: '2026-09-25',
      day: null,
      missedYesterday: false,
      site: { id: site.id, name: 'Plot 7', lat: site.lat, lng: site.lng, radiusM: 60 },
      maxAccuracyM: 50,
      reminderTime: '19:00',
      timezone: 'Asia/Kolkata',
      joinedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('says which work day the account was created on, in company time', async () => {
    ({ app, clock } = await createTestApp());
    const emp = await makeEmployee();
    // 20:00 UTC on the 10th is already the 11th in India.
    await testDb.db.update(users).set({ createdAt: new Date('2026-09-10T20:00:00Z') }).where(eq(users.id, emp.user.id));
    const token = await employeeToken(app, emp);
    expect((await get('/me/today', token)).json().joinedOn).toBe('2026-09-11');
  });

  it("returns the day after check-in and flags yesterday's missed checkout", async () => {
    ({ app, clock } = await createTestApp());
    const site = await makeSite();
    const emp = await makeEmployee({ siteId: site.id });
    await insertDay({ employeeId: emp.user.id, siteId: site.id, workDate: '2026-09-24', status: 'MISSED_CHECKOUT' });
    const token = await employeeToken(app, emp);
    await submit(app, token, 'check-in', submitBody(clock));
    const body = (await get('/me/today', token)).json();
    expect(body.day.status).toBe('CHECKED_IN');
    expect(body.missedYesterday).toBe(true);
  });

  it('is employee-only', async () => {
    ({ app } = await createTestApp());
    const token = await adminToken(app, await makeAdmin());
    expect((await get('/me/today', token)).statusCode).toBe(403);
  });
});

describe('GET /me/attendance', () => {
  it('returns only my last 30 days, newest first', async () => {
    ({ app } = await createTestApp());
    const site = await makeSite();
    const me = await makeEmployee({ siteId: site.id });
    const other = await makeEmployee({ siteId: site.id });
    for (const workDate of ['2026-08-20', '2026-08-27', '2026-09-20', '2026-09-24']) {
      await insertDay({ employeeId: me.user.id, siteId: site.id, workDate, status: 'COMPLETED' });
    }
    await insertDay({ employeeId: other.user.id, siteId: site.id, workDate: '2026-09-24' });
    const token = await employeeToken(app, me);
    const res = await get('/me/attendance', token);
    expect(res.json().map((d: { workDate: string }) => d.workDate)).toEqual(['2026-09-24', '2026-09-20', '2026-08-27']);
  });

  it('accepts an explicit range up to 31 days and rejects longer', async () => {
    ({ app } = await createTestApp());
    const token = await employeeToken(app, await makeEmployee());
    expect((await get('/me/attendance?from=2026-09-01&to=2026-09-30', token)).statusCode).toBe(200);
    const tooLong = await get('/me/attendance?from=2026-08-01&to=2026-09-30', token);
    expect(tooLong.statusCode).toBe(400);
    expect((await get('/me/attendance?from=2026-09-30&to=2026-09-01', token)).statusCode).toBe(400);
  });
});
