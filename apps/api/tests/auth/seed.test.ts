import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { seedAdmin } from '../../src/modules/auth/seed';
import { createTestApp } from '../helpers/app';
import { testDb } from '../helpers/db';

let app: FastifyInstance;
afterEach(async () => app?.close());

describe('seedAdmin', () => {
  it('creates an admin who can log in', async () => {
    ({ app } = await createTestApp());
    const admin = await seedAdmin(testDb.db, { email: 'Owner@VE.test', name: 'Owner', password: 'long-enough-pw' });
    expect(admin).toMatchObject({ role: 'admin', email: 'owner@ve.test' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      payload: { email: 'owner@ve.test', password: 'long-enough-pw' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('refuses duplicates and short passwords', async () => {
    await seedAdmin(testDb.db, { email: 'a@ve.test', name: 'A', password: 'long-enough-pw' });
    await expect(seedAdmin(testDb.db, { email: 'a@ve.test', name: 'B', password: 'long-enough-pw' })).rejects.toThrow(/already exists/);
    await expect(seedAdmin(testDb.db, { email: 'b@ve.test', name: 'B', password: 'short' })).rejects.toThrow();
  });
});
