import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { auditLogs } from '../src/db/schema';
import { createTestApp } from './helpers/app';
import { testDb } from './helpers/db';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee } from './helpers/factories';

let app: FastifyInstance;
afterEach(async () => app?.close());

describe('/admin/settings', () => {
  it('returns defaults to admins', async () => {
    ({ app } = await createTestApp());
    const token = await adminToken(app, await makeAdmin());
    const res = await app.inject({ method: 'GET', url: '/admin/settings', headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      timezone: 'Asia/Kolkata',
      maxAccuracyM: 50,
      defaultRadiusM: 50,
      reminderTime: '19:00',
      clockMismatchMinutes: 10,
    });
  });

  it('updates settings and writes an audit entry', async () => {
    ({ app } = await createTestApp());
    const admin = await makeAdmin();
    const token = await adminToken(app, admin);
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/settings',
      headers: bearer(token),
      payload: { maxAccuracyM: 40, reminderTime: '20:15' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ maxAccuracyM: 40, reminderTime: '20:15' });
    const audits = await testDb.db.select().from(auditLogs);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId: admin.user.id, action: 'settings.update' });
    expect(audits[0]!.before).toMatchObject({ maxAccuracyM: 50 });
    expect(audits[0]!.after).toMatchObject({ maxAccuracyM: 40 });
  });

  it('rejects an unknown timezone', async () => {
    ({ app } = await createTestApp());
    const token = await adminToken(app, await makeAdmin());
    const res = await app.inject({ method: 'PATCH', url: '/admin/settings', headers: bearer(token), payload: { timezone: 'Mars/Base' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('forbids employees and anonymous users', async () => {
    ({ app } = await createTestApp());
    const token = await employeeToken(app, await makeEmployee());
    const asEmployee = await app.inject({ method: 'GET', url: '/admin/settings', headers: bearer(token) });
    expect(asEmployee.statusCode).toBe(403);
    expect(asEmployee.json().code).toBe('FORBIDDEN');
    expect((await app.inject({ method: 'GET', url: '/admin/settings' })).statusCode).toBe(401);
  });
});
