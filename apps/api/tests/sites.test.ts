import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { auditLogs } from '../src/db/schema';
import { createTestApp } from './helpers/app';
import { testDb } from './helpers/db';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee } from './helpers/factories';

let app: FastifyInstance;
let token: string;
afterEach(async () => app?.close());

async function setup() {
  ({ app } = await createTestApp());
  token = await adminToken(app, await makeAdmin());
}
const post = (payload: unknown) => app.inject({ method: 'POST', url: '/admin/sites', headers: bearer(token), payload: payload as Record<string, unknown> });

describe('/admin/sites', () => {
  it('creates a site with the default radius from settings', async () => {
    await setup();
    const res = await post({ name: 'Plot 7', address: 'Baner, Pune', lat: 18.559, lng: 73.786 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Plot 7', radiusM: 50, isActive: true, address: 'Baner, Pune' });
    const audits = await testDb.db.select().from(auditLogs);
    expect(audits[0]).toMatchObject({ action: 'site.create', entityId: res.json().id });
  });

  it('validates radius and coordinates', async () => {
    await setup();
    expect((await post({ name: 'x', lat: 18.5, lng: 73.8, radiusM: 5 })).statusCode).toBe(400);
    expect((await post({ name: 'x', lat: 95, lng: 73.8 })).statusCode).toBe(400);
  });

  it('lists, gets and updates sites', async () => {
    await setup();
    const created = (await post({ name: 'B site', lat: 18.5, lng: 73.8, radiusM: 80 })).json();
    await post({ name: 'A site', lat: 18.6, lng: 73.9 });

    const list = await app.inject({ method: 'GET', url: '/admin/sites', headers: bearer(token) });
    expect(list.json().map((s: { name: string }) => s.name)).toEqual(['A site', 'B site']);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/admin/sites/${created.id}`,
      headers: bearer(token),
      payload: { radiusM: 120, isActive: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ radiusM: 120, isActive: false });

    const got = await app.inject({ method: 'GET', url: `/admin/sites/${created.id}`, headers: bearer(token) });
    expect(got.json().radiusM).toBe(120);
  });

  it('returns 404 for unknown ids and 400 for malformed ids', async () => {
    await setup();
    const missing = await app.inject({ method: 'GET', url: '/admin/sites/8f14e45f-ceea-4f6a-9d3b-9b5a1c2d3e4f', headers: bearer(token) });
    expect(missing.statusCode).toBe(404);
    const bad = await app.inject({ method: 'GET', url: '/admin/sites/123', headers: bearer(token) });
    expect(bad.statusCode).toBe(400);
  });

  it('forbids employees', async () => {
    ({ app } = await createTestApp());
    const t = await employeeToken(app, await makeEmployee());
    expect((await app.inject({ method: 'GET', url: '/admin/sites', headers: bearer(t) })).statusCode).toBe(403);
  });
});
