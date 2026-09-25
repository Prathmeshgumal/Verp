import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { attendanceDays, users } from '../../src/db/schema';
import { createTestApp, type FakeClock } from '../helpers/app';
import { INSIDE, OUTSIDE, submit, submitBody } from '../helpers/attendance';
import { testDb } from '../helpers/db';
import { employeeToken, makeEmployee, makeSite, type TestEmployee } from '../helpers/factories';

const HOUR = 60 * 60 * 1000;
let app: FastifyInstance;
let clock: FakeClock;
let emp: TestEmployee;
afterEach(async () => app?.close());

async function setup() {
  ({ app, clock } = await createTestApp());
  const site = await makeSite();
  emp = await makeEmployee({ siteId: site.id });
  return { site, token: await employeeToken(app, emp) };
}
/** Access tokens last 15 minutes, so log in again after moving the clock. */
const freshToken = () => employeeToken(app, emp);

describe('POST /attendance/check-out', () => {
  it('completes the day and computes worked minutes from server times', async () => {
    const { token } = await setup();
    await submit(app, token, 'check-in', submitBody(clock));
    clock.advance(8.5 * HOUR);
    const res = await submit(app, await freshToken(), 'check-out', submitBody(clock));
    expect(res.statusCode).toBe(200);
    expect(res.json().day).toMatchObject({
      status: 'COMPLETED',
      workedMinutes: 510,
      checkOutAt: clock.now.toISOString(),
    });
  });

  it('refuses check-out without a check-in', async () => {
    const { token } = await setup();
    const res = await submit(app, token, 'check-out', submitBody(clock));
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('NOT_CHECKED_IN');
  });

  it('refuses a second check-out', async () => {
    const { token } = await setup();
    await submit(app, token, 'check-in', submitBody(clock));
    clock.advance(HOUR);
    const t = await freshToken();
    await submit(app, t, 'check-out', submitBody(clock));
    const again = await submit(app, t, 'check-out', submitBody(clock));
    expect(again.statusCode).toBe(409);
    expect(again.json().code).toBe('ALREADY_CHECKED_OUT');
  });

  it('refuses check-out from outside the site and keeps the day open', async () => {
    const { token } = await setup();
    await submit(app, token, 'check-in', submitBody(clock));
    const res = await submit(app, token, 'check-out', submitBody(clock, OUTSIDE));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'OUTSIDE_SITE', day: { status: 'CHECKED_IN' } });
  });

  it('judges check-out against the site of the day even after reassignment', async () => {
    const { token } = await setup();
    await submit(app, token, 'check-in', submitBody(clock));
    const far = await makeSite({ lat: 19.5, lng: 74.8 });
    await testDb.db.update(users).set({ siteId: far.id }).where(eq(users.id, emp.user.id));
    const res = await submit(app, token, 'check-out', submitBody(clock, INSIDE));
    expect(res.statusCode).toBe(200);
  });

  it('replays the original check-in result after the worker has checked out', async () => {
    const { token } = await setup();
    const key = randomUUID();
    const first = await submit(app, token, 'check-in', submitBody(clock), key);
    clock.advance(8 * HOUR);
    const t = await freshToken();
    await submit(app, t, 'check-out', submitBody(clock));
    const replay = await submit(app, t, 'check-in', submitBody(clock), key);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
  });

  it('rejects a check-in key reused on the check-out endpoint', async () => {
    const { token } = await setup();
    const key = randomUUID();
    await submit(app, token, 'check-in', submitBody(clock), key);
    const res = await submit(app, token, 'check-out', submitBody(clock), key);
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('adds the mock flag at check-out', async () => {
    const { token } = await setup();
    await submit(app, token, 'check-in', submitBody(clock));
    const res = await submit(app, token, 'check-out', submitBody(clock, { isMock: true }));
    expect(res.json().day).toMatchObject({ flags: ['MOCK_LOCATION'], needsReview: true });
  });

  it('does not let a day cross IST midnight', async () => {
    ({ app, clock } = await createTestApp());
    clock.set('2026-09-25T17:00:00Z'); // 22:30 IST
    const site = await makeSite();
    emp = await makeEmployee({ siteId: site.id });
    await submit(app, await freshToken(), 'check-in', submitBody(clock));
    clock.set('2026-09-25T19:00:00Z'); // 00:30 IST next day
    const res = await submit(app, await freshToken(), 'check-out', submitBody(clock));
    expect(res.json().code).toBe('NOT_CHECKED_IN');
    const [day] = await testDb.db.select().from(attendanceDays);
    expect(day!.status).toBe('CHECKED_IN');
  });
});
