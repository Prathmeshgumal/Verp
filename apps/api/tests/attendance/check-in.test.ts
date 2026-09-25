import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { attendanceDays, attendanceEvents, sites } from '../../src/db/schema';
import { createTestApp, FakeClock } from '../helpers/app';
import { OUTSIDE, submit, submitBody } from '../helpers/attendance';
import { testDb } from '../helpers/db';
import { adminToken, employeeToken, makeAdmin, makeEmployee, makeSite } from '../helpers/factories';

let app: FastifyInstance;
let clock: FakeClock;
afterEach(async () => app?.close());

async function setup(opts: { withSite?: boolean } = {}) {
  ({ app, clock } = await createTestApp());
  const site = await makeSite();
  const emp = await makeEmployee({ siteId: opts.withSite === false ? null : site.id });
  const token = await employeeToken(app, emp);
  return { site, emp, token };
}
const events = () => testDb.db.select().from(attendanceEvents);
const days = () => testDb.db.select().from(attendanceDays);

describe('POST /attendance/check-in', () => {
  it('records a check-in with the server time, not the device time', async () => {
    const { site, emp, token } = await setup();
    const res = await submit(app, token, 'check-in', submitBody(clock, { deviceTime: '2020-01-01T00:00:00Z' }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ code: 'OK', serverTime: clock.now.toISOString() });
    expect(body.day).toMatchObject({
      status: 'CHECKED_IN',
      workDate: '2026-09-25',
      siteId: site.id,
      checkInAt: clock.now.toISOString(),
      flags: ['CLOCK_MISMATCH'],
      needsReview: false,
    });
    const [day] = await days();
    expect(day).toMatchObject({ employeeId: emp.user.id, checkInDistanceM: expect.closeTo(11.1, 0) });
    const [ev] = await events();
    expect(ev).toMatchObject({ type: 'IN', result: 'ACCEPTED', attendanceDayId: day!.id, deviceModel: 'Redmi 9A' });
  });

  it('uses the IST date for a check-in just after midnight IST', async () => {
    ({ app, clock } = await createTestApp({ clock: new FakeClock('2026-09-25T19:00:00Z') })); // 00:30 IST on the 26th
    const site = await makeSite();
    const token = await employeeToken(app, await makeEmployee({ siteId: site.id }));
    const res = await submit(app, token, 'check-in', submitBody(clock));
    expect(res.statusCode).toBe(200);
    expect(res.json().day.workDate).toBe('2026-09-26');
  });

  it('rejects a check-in outside the radius and logs the attempt', async () => {
    const { token } = await setup();
    const res = await submit(app, token, 'check-in', submitBody(clock, OUTSIDE));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'OUTSIDE_SITE', distanceM: 111 });
    expect(await days()).toHaveLength(0);
    const [ev] = await events();
    expect(ev).toMatchObject({ result: 'OUTSIDE_SITE', attendanceDayId: null });
  });

  it('rejects poor GPS accuracy', async () => {
    const { token } = await setup();
    const res = await submit(app, token, 'check-in', submitBody(clock, { accuracyM: 80 }));
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('LOW_ACCURACY');
  });

  it('rejects employees without an active site', async () => {
    const { token } = await setup({ withSite: false });
    const res = await submit(app, token, 'check-in', submitBody(clock));
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('NO_SITE');
  });

  it('treats a deactivated site as no site', async () => {
    const { site, token } = await setup();
    await testDb.db.update(sites).set({ isActive: false }).where(eq(sites.id, site.id));
    expect((await submit(app, token, 'check-in', submitBody(clock))).json().code).toBe('NO_SITE');
  });

  it('refuses a second check-in on the same day', async () => {
    const { token } = await setup();
    await submit(app, token, 'check-in', submitBody(clock));
    const again = await submit(app, token, 'check-in', submitBody(clock, OUTSIDE));
    expect(again.statusCode).toBe(409);
    expect(again.json().code).toBe('ALREADY_CHECKED_IN');
    expect(again.json().day.status).toBe('CHECKED_IN');
  });

  it('replays the stored response for a repeated idempotency key', async () => {
    const { token } = await setup();
    const key = randomUUID();
    const first = await submit(app, token, 'check-in', submitBody(clock), key);
    clock.advance(5_000);
    const second = await submit(app, token, 'check-in', submitBody(clock), key);
    expect(second.statusCode).toBe(first.statusCode);
    expect(second.json()).toEqual(first.json());
    expect(await events()).toHaveLength(1);
  });

  it('creates exactly one day under concurrent check-ins', async () => {
    const { token } = await setup();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => submit(app, token, 'check-in', submitBody(clock))),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 409, 409, 409, 409]);
    expect(await days()).toHaveLength(1);
    expect(await events()).toHaveLength(5);
  });

  it('returns one result for concurrent requests with the same key', async () => {
    const { token } = await setup();
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 3 }, () => submit(app, token, 'check-in', submitBody(clock), key)),
    );
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    // Compare parsed JSON: replays come from jsonb, which may reorder keys.
    const [first, ...rest] = results.map((r) => r.json());
    for (const body of rest) expect(body).toEqual(first);
    expect(await events()).toHaveLength(1);
  });

  it("rejects another employee's idempotency key", async () => {
    const { site, token } = await setup();
    const other = await makeEmployee({ siteId: site.id });
    const otherToken = await employeeToken(app, other);
    const key = randomUUID();
    await submit(app, token, 'check-in', submitBody(clock), key);
    const res = await submit(app, otherToken, 'check-in', submitBody(clock), key);
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('requires an Idempotency-Key header', async () => {
    const { token } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/attendance/check-in',
      headers: { authorization: `Bearer ${token}` },
      payload: submitBody(clock),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects a body that tries to name another employee', async () => {
    const { token } = await setup();
    const res = await submit(app, token, 'check-in', submitBody(clock, { employeeId: randomUUID() }));
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('flags mock locations for review without blocking', async () => {
    const { token } = await setup();
    const res = await submit(app, token, 'check-in', submitBody(clock, { isMock: true }));
    expect(res.statusCode).toBe(200);
    expect(res.json().day).toMatchObject({ flags: ['MOCK_LOCATION'], needsReview: true });
  });

  it('forbids admins', async () => {
    ({ app, clock } = await createTestApp());
    const token = await adminToken(app, await makeAdmin());
    expect((await submit(app, token, 'check-in', submitBody(clock))).statusCode).toBe(403);
  });
});
