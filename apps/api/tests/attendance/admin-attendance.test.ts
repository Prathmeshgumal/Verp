import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { auditLogs } from '../../src/db/schema';
import { createTestApp, type FakeClock } from '../helpers/app';
import { insertDay, OUTSIDE, submit, submitBody } from '../helpers/attendance';
import { testDb } from '../helpers/db';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee, makeSite } from '../helpers/factories';

let app: FastifyInstance;
let clock: FakeClock;
let token: string;
afterEach(async () => app?.close());

async function setup() {
  ({ app, clock } = await createTestApp()); // now = 2026-09-25 09:30 IST
  const admin = await makeAdmin();
  token = await adminToken(app, admin);
  return admin;
}
const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: Record<string, unknown>) =>
  app.inject({ method, url, headers: bearer(token), ...(payload !== undefined ? { payload } : {}) });

describe('GET /admin/attendance', () => {
  it('filters by date, status, review flag and employee, with paging', async () => {
    await setup();
    const site = await makeSite({ name: 'Plot 7' });
    const [a, b, c] = await Promise.all([
      makeEmployee({ name: 'Anil', siteId: site.id }),
      makeEmployee({ name: 'Bina', siteId: site.id }),
      makeEmployee({ name: 'Chetan', siteId: site.id }),
    ]);
    await insertDay({ employeeId: a.user.id, siteId: site.id, workDate: '2026-09-25' });
    await insertDay({ employeeId: b.user.id, siteId: site.id, workDate: '2026-09-25', status: 'COMPLETED', workedMinutes: 480, checkOutAt: new Date('2026-09-25T11:30:00Z') });
    await insertDay({ employeeId: c.user.id, siteId: site.id, workDate: '2026-09-24', status: 'MISSED_CHECKOUT', needsReview: true });

    const today = (await call('GET', '/admin/attendance?from=2026-09-25&to=2026-09-25')).json();
    expect(today.total).toBe(2);
    expect(today.items.map((d: { employeeName: string }) => d.employeeName)).toEqual(['Anil', 'Bina']);
    expect(today.items[0]).toMatchObject({ siteName: 'Plot 7', checkInLat: expect.any(Number) });

    const range = '/admin/attendance?from=2026-09-24&to=2026-09-25';
    expect((await call('GET', `${range}&status=COMPLETED`)).json().total).toBe(1);
    expect((await call('GET', `${range}&needsReview=true`)).json().items[0].employeeName).toBe('Chetan');
    expect((await call('GET', `${range}&employeeId=${a.user.id}`)).json().total).toBe(1);

    const paged = (await call('GET', `${range}&page=2&pageSize=2`)).json();
    expect(paged).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(paged.items).toHaveLength(1);
  });

  it('requires from and to', async () => {
    await setup();
    expect((await call('GET', '/admin/attendance')).statusCode).toBe(400);
  });
});

describe('GET /admin/attendance/:id', () => {
  it('includes the site and every attempt, including rejected ones', async () => {
    await setup();
    const site = await makeSite();
    const emp = await makeEmployee({ siteId: site.id });
    const t = await employeeToken(app, emp);
    await submit(app, t, 'check-in', submitBody(clock, OUTSIDE));
    clock.advance(1000);
    const ok = await submit(app, t, 'check-in', submitBody(clock));
    const res = await call('GET', `/admin/attendance/${ok.json().day.id}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.site).toMatchObject({ id: site.id, radiusM: 50 });
    expect(body.events.map((e: { result: string }) => e.result)).toEqual(['OUTSIDE_SITE', 'ACCEPTED']);
  });
});

describe('PATCH /admin/attendance/:id/checkout', () => {
  async function missedDay() {
    const site = await makeSite();
    const emp = await makeEmployee({ siteId: site.id });
    return insertDay({ employeeId: emp.user.id, siteId: site.id, workDate: '2026-09-24', status: 'MISSED_CHECKOUT', needsReview: true });
  }

  it('fixes a missed checkout, computes hours and audits the reason', async () => {
    const admin = await setup();
    const day = await missedDay();
    const res = await call('PATCH', `/admin/attendance/${day.id}/checkout`, {
      checkOutAt: '2026-09-24T18:00:00+05:30',
      reason: 'Supervisor confirmed he left at 6 PM',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'COMPLETED',
      workedMinutes: 540,
      checkOutAt: '2026-09-24T12:30:00.000Z',
      needsReview: false,
    });
    expect(res.json().flags).toContain('ADMIN_CORRECTED');
    const [audit] = await testDb.db.select().from(auditLogs);
    expect(audit).toMatchObject({
      actorId: admin.user.id,
      action: 'attendance.fix_checkout',
      entityId: day.id,
      reason: 'Supervisor confirmed he left at 6 PM',
    });
  });

  it.each([
    ['before check-in', '2026-09-24T08:00:00+05:30'],
    ['on another day', '2026-09-25T01:00:00+05:30'],
  ])('rejects a checkout %s', async (_label, checkOutAt) => {
    await setup();
    const day = await missedDay();
    const res = await call('PATCH', `/admin/attendance/${day.id}/checkout`, { checkOutAt, reason: 'fix it' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_CHECKOUT_TIME');
  });

  it('rejects a checkout in the future', async () => {
    await setup();
    const site = await makeSite();
    const emp = await makeEmployee({ siteId: site.id });
    const day = await insertDay({ employeeId: emp.user.id, siteId: site.id, workDate: '2026-09-25', status: 'MISSED_CHECKOUT' });
    const res = await call('PATCH', `/admin/attendance/${day.id}/checkout`, { checkOutAt: '2026-09-25T20:00:00+05:30', reason: 'fix it' });
    expect(res.json().code).toBe('INVALID_CHECKOUT_TIME');
  });

  it('refuses to fix a day that is still checked in', async () => {
    await setup();
    const site = await makeSite();
    const emp = await makeEmployee({ siteId: site.id });
    const day = await insertDay({ employeeId: emp.user.id, siteId: site.id, workDate: '2026-09-25' });
    const res = await call('PATCH', `/admin/attendance/${day.id}/checkout`, { checkOutAt: '2026-09-25T09:20:00+05:30', reason: 'fix it' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('INVALID_STATE');
  });
});

describe('POST /admin/attendance/:id/review', () => {
  it('clears the review flag', async () => {
    const admin = await setup();
    const site = await makeSite();
    const emp = await makeEmployee({ siteId: site.id });
    const day = await insertDay({ employeeId: emp.user.id, siteId: site.id, workDate: '2026-09-25', needsReview: true, flags: ['MOCK_LOCATION'] });
    const res = await call('POST', `/admin/attendance/${day.id}/review`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ needsReview: false, reviewedAt: clock.now.toISOString() });
    const [audit] = await testDb.db.select().from(auditLogs);
    expect(audit).toMatchObject({ actorId: admin.user.id, action: 'attendance.review' });
  });
});

describe('GET /admin/attendance/export.csv', () => {
  it('exports IST times and neutralizes formulas in names', async () => {
    await setup();
    const site = await makeSite({ name: 'Plot 7' });
    const emp = await makeEmployee({ name: '=HYPERLINK("http://evil")', employeeCode: 'E-9', siteId: site.id });
    await insertDay({
      employeeId: emp.user.id,
      siteId: site.id,
      workDate: '2026-09-24',
      status: 'COMPLETED',
      checkInAt: new Date('2026-09-24T03:32:00Z'),
      checkOutAt: new Date('2026-09-24T12:45:00Z'),
      workedMinutes: 553,
    });
    const res = await call('GET', '/admin/attendance/export.csv?from=2026-09-24&to=2026-09-24');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('attendance_2026-09-24_2026-09-24.csv');
    const lines = res.body.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'Employee Code,Employee,Site,Date,Status,Check In,Check Out,Hours,Check In Distance (m),Check Out Distance (m),Flags,Needs Review',
    );
    expect(lines[1]).toBe(
      `E-9,"'=HYPERLINK(""http://evil"")",Plot 7,2026-09-24,COMPLETED,2026-09-24 09:02,2026-09-24 18:15,9.22,5,,,no`,
    );
  });
});

describe('authorization', () => {
  it('forbids employees', async () => {
    ({ app } = await createTestApp());
    const t = await employeeToken(app, await makeEmployee());
    const res = await app.inject({ method: 'GET', url: '/admin/attendance?from=2026-09-25&to=2026-09-25', headers: bearer(t) });
    expect(res.statusCode).toBe(403);
  });
});
