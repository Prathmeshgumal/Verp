import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';
import { sites, users, type SiteRow, type UserRow } from '../../src/db/schema';
import { hashSecret } from '../../src/lib/password';
import { testDb } from './db';

let seq = 0;
const next = () => ++seq;

export const SITE_LOCATION = { lat: 18.5204, lng: 73.8567 };

export async function makeSite(overrides: Partial<typeof sites.$inferInsert> = {}): Promise<SiteRow> {
  const n = next();
  const [site] = await testDb.db
    .insert(sites)
    .values({ name: `Site ${n}`, ...SITE_LOCATION, radiusM: 50, ...overrides })
    .returning();
  return site!;
}

export interface TestEmployee {
  user: UserRow;
  pin: string;
}

export async function makeEmployee(
  o: { pin?: string; phone?: string; name?: string; siteId?: string | null; isActive?: boolean; employeeCode?: string } = {},
): Promise<TestEmployee> {
  const n = next();
  const pin = o.pin ?? '123456';
  const [user] = await testDb.db
    .insert(users)
    .values({
      role: 'employee',
      name: o.name ?? `Worker ${n}`,
      phone: o.phone ?? `+9198${String(n).padStart(8, '0')}`,
      employeeCode: o.employeeCode ?? null,
      pinHash: await hashSecret(pin),
      siteId: o.siteId ?? null,
      isActive: o.isActive ?? true,
    })
    .returning();
  return { user: user!, pin };
}

export interface TestAdmin {
  user: UserRow;
  password: string;
}

export async function makeAdmin(o: { email?: string; password?: string } = {}): Promise<TestAdmin> {
  const n = next();
  const password = o.password ?? 'admin-password-123';
  const [user] = await testDb.db
    .insert(users)
    .values({ role: 'admin', name: `Admin ${n}`, email: o.email ?? `admin${n}@ve.test`, passwordHash: await hashSecret(password) })
    .returning();
  return { user: user!, password };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export async function employeeToken(app: FastifyInstance, e: TestEmployee): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/employee/login',
    payload: { phone: e.user.phone, pin: e.pin, deviceId: 'test-device' },
  });
  expect(res.statusCode).toBe(200);
  return res.json().accessToken as string;
}

export async function adminToken(app: FastifyInstance, a: TestAdmin): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/admin/login',
    payload: { email: a.user.email, password: a.password, client: 'mobile' },
  });
  expect(res.statusCode).toBe(200);
  return res.json().accessToken as string;
}
