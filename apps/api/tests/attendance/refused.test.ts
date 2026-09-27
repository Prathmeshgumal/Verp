import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp, FakeClock } from '../helpers/app';
import { OUTSIDE, submit, submitBody } from '../helpers/attendance';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee, makeSite } from '../helpers/factories';

let app: FastifyInstance;
afterEach(async () => app?.close());

describe('GET /admin/attendance/refused', () => {
  it('lists refused attempts from earlier days, newest first, filtered by employee', async () => {
    const clock = new FakeClock('2026-09-23T04:00:00.000Z'); // 23 Sep, 09:30 IST
    ({ app } = await createTestApp({ clock }));
    const site = await makeSite({ name: 'Plot 7', radiusM: 50 });
    const anil = await makeEmployee({ name: 'Anil', siteId: site.id });
    const bina = await makeEmployee({ name: 'Bina', siteId: site.id });
    const anilToken = await employeeToken(app, anil);

    await submit(app, anilToken, 'check-in', submitBody(clock, OUTSIDE));
    await submit(app, anilToken, 'check-in', submitBody(clock)); // accepted: not listed
    clock.set('2026-09-24T04:00:00.000Z'); // tokens expire overnight, so log in again
    const anilToken2 = await employeeToken(app, anil);
    const binaToken = await employeeToken(app, bina);
    await submit(app, anilToken2, 'check-in', submitBody(clock, { accuracyM: 900 }));
    clock.advance(60_000);
    await submit(app, binaToken, 'check-in', submitBody(clock, OUTSIDE));
    const token = await adminToken(app, await makeAdmin());

    const res = await app.inject({ method: 'GET', url: '/admin/attendance/refused?from=2026-09-01&to=2026-09-25', headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.items.map((r: { name: string; workDate: string; result: string }) => [r.name, r.workDate, r.result])).toEqual([
      ['Bina', '2026-09-24', 'OUTSIDE_SITE'],
      ['Anil', '2026-09-24', 'LOW_ACCURACY'],
      ['Anil', '2026-09-23', 'OUTSIDE_SITE'],
    ]);
    expect(body.items[2]).toMatchObject({ employeeId: anil.user.id, siteId: site.id, siteName: 'Plot 7', type: 'IN', lat: OUTSIDE.lat, lng: OUTSIDE.lng });

    const one = (
      await app.inject({ method: 'GET', url: `/admin/attendance/refused?from=2026-09-24&to=2026-09-24&employeeId=${anil.user.id}`, headers: bearer(token) })
    ).json();
    expect(one.items.map((r: { result: string }) => r.result)).toEqual(['LOW_ACCURACY']);
  });

  it('is admin only and checks the dates', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee();
    const empRes = await app.inject({ method: 'GET', url: '/admin/attendance/refused?from=2026-09-01&to=2026-09-25', headers: bearer(await employeeToken(app, emp)) });
    expect(empRes.statusCode).toBe(403);
    const token = await adminToken(app, await makeAdmin());
    const bad = await app.inject({ method: 'GET', url: '/admin/attendance/refused?from=2026-09-25&to=2026-09-01', headers: bearer(token) });
    expect(bad.statusCode).toBe(400);
  });
});
