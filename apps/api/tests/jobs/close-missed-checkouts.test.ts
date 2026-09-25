import { describe, expect, it } from 'vitest';
import { auditLogs, attendanceDays } from '../../src/db/schema';
import { closeMissedCheckouts } from '../../src/jobs/close-missed-checkouts';
import { FakeClock } from '../helpers/app';
import { insertDay } from '../helpers/attendance';
import { testDb } from '../helpers/db';
import { makeEmployee, makeSite } from '../helpers/factories';

const { db } = testDb;

async function scenario() {
  const site = await makeSite();
  const [a, b, c] = await Promise.all([makeEmployee(), makeEmployee(), makeEmployee()]);
  await insertDay({ employeeId: a.user.id, siteId: site.id, workDate: '2026-09-24' }); // open yesterday
  await insertDay({ employeeId: b.user.id, siteId: site.id, workDate: '2026-09-25' }); // open today
  await insertDay({ employeeId: c.user.id, siteId: site.id, workDate: '2026-09-24', status: 'COMPLETED' });
}
const statuses = async () =>
  Object.fromEntries((await db.select().from(attendanceDays)).map((d) => [`${d.workDate}:${d.status}`, d.needsReview]));

describe('closeMissedCheckouts', () => {
  it('closes open days from earlier dates only, and is idempotent', async () => {
    await scenario();
    const clock = new FakeClock('2026-09-25T06:00:00Z');
    expect(await closeMissedCheckouts({ db, clock: clock.fn })).toBe(1);
    expect(await statuses()).toEqual({
      '2026-09-24:MISSED_CHECKOUT': true,
      '2026-09-25:CHECKED_IN': false,
      '2026-09-24:COMPLETED': false,
    });
    expect(await closeMissedCheckouts({ db, clock: clock.fn })).toBe(0);
    const audits = await db.select().from(auditLogs);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId: null, action: 'attendance.auto_missed_checkout' });
  });

  it('uses the IST date boundary', async () => {
    await scenario();
    // 2026-09-25T18:35Z is 00:05 IST on the 26th, so the 25th is now "yesterday".
    expect(await closeMissedCheckouts({ db, clock: new FakeClock('2026-09-25T18:35:00Z').fn })).toBe(2);
  });

  it('leaves today open just before IST midnight', async () => {
    await scenario();
    expect(await closeMissedCheckouts({ db, clock: new FakeClock('2026-09-25T18:25:00Z').fn })).toBe(1);
  });
});
