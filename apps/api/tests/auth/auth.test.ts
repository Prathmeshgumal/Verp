import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { users } from '../../src/db/schema';
import { createTestApp, type FakeClock } from '../helpers/app';
import { testDb } from '../helpers/db';
import { bearer, makeAdmin, makeEmployee } from '../helpers/factories';

const DAY = 24 * 60 * 60 * 1000;
let app: FastifyInstance;
let clock: FakeClock;
afterEach(async () => app?.close());

const employeeLogin = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/auth/employee/login', payload });
const refresh = (refreshToken: string) =>
  app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });

describe('employee login', () => {
  it('accepts the phone typed in a different format', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee({ phone: '+919876543210' });
    const res = await employeeLogin({ phone: '098765 43210', pin: emp.pin, deviceId: 'd1', deviceModel: 'Redmi 9' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.user).toEqual({
      id: emp.user.id,
      role: 'employee',
      name: emp.user.name,
      phone: '+919876543210',
      email: null,
      siteId: null,
    });
  });

  it('returns the same error for a wrong PIN and an unknown phone', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee();
    const wrongPin = await employeeLogin({ phone: emp.user.phone, pin: '000000', deviceId: 'd' });
    const unknown = await employeeLogin({ phone: '9000000000', pin: '123456', deviceId: 'd' });
    for (const res of [wrongPin, unknown]) {
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('locks the account for 15 minutes after 5 failures', async () => {
    ({ app, clock } = await createTestApp());
    const emp = await makeEmployee();
    const attempt = (pin: string) => employeeLogin({ phone: emp.user.phone, pin, deviceId: 'd' });
    for (let i = 0; i < 5; i++) expect((await attempt('000000')).statusCode).toBe(401);
    const locked = await attempt(emp.pin);
    expect(locked.statusCode).toBe(423);
    expect(locked.json().code).toBe('ACCOUNT_LOCKED');
    clock.advance(15 * 60_000 + 1000);
    expect((await attempt(emp.pin)).statusCode).toBe(200);
  });

  it('checks at most 5 PINs from a parallel burst of wrong guesses', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee();
    const results = await Promise.all(
      Array.from({ length: 25 }, () => employeeLogin({ phone: emp.user.phone, pin: '000000', deviceId: 'd' })),
    );
    const codes = results.map((r) => r.json().code as string);
    expect(codes.filter((c) => c === 'INVALID_CREDENTIALS')).toHaveLength(5);
    expect(codes.filter((c) => c === 'ACCOUNT_LOCKED')).toHaveLength(20);
    expect((await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' })).statusCode).toBe(423);
  });

  it('resets the failure counter on success', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee();
    const attempt = (pin: string) => employeeLogin({ phone: emp.user.phone, pin, deviceId: 'd' });
    for (let i = 0; i < 4; i++) await attempt('000000');
    expect((await attempt(emp.pin)).statusCode).toBe(200);
    for (let i = 0; i < 4; i++) await attempt('000000');
    expect((await attempt(emp.pin)).statusCode).toBe(200);
  });

  it('rejects inactive employees', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee({ isActive: false });
    const res = await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('ACCOUNT_INACTIVE');
  });
});

describe('admin login', () => {
  it('gives web clients an HttpOnly cookie and no refresh token in the body', async () => {
    ({ app } = await createTestApp());
    const admin = await makeAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      payload: { email: admin.user.email!.toUpperCase(), password: admin.password, client: 'web' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().refreshToken).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/ve_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/auth/);

    const value = /ve_rt=([^;]+)/.exec(cookie)![1];
    const refreshed = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: `ve_rt=${value}` },
      payload: {},
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().accessToken).toEqual(expect.any(String));
    expect(refreshed.json().refreshToken).toBeUndefined();
    expect(String(refreshed.headers['set-cookie'])).toMatch(/ve_rt=/);
  });

  it('rejects a wrong password', async () => {
    ({ app } = await createTestApp());
    const admin = await makeAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      payload: { email: admin.user.email, password: 'wrong-password-1' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_CREDENTIALS');
  });
});

describe('refresh rotation', () => {
  it('rotates tokens and revokes the session when an old token is reused later', async () => {
    ({ app, clock } = await createTestApp());
    const emp = await makeEmployee();
    const login = await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' });
    const rt1 = login.json().refreshToken as string;

    clock.advance(60_000);
    const r2 = await refresh(rt1);
    expect(r2.statusCode).toBe(200);
    const rt2 = r2.json().refreshToken as string;
    expect(rt2).not.toBe(rt1);
    const rt3 = (await refresh(rt2)).json().refreshToken as string;

    // Reusing an old token after the grace window is treated as theft: the whole session dies.
    clock.advance(2 * 60_000);
    const reuse = await refresh(rt2);
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().code).toBe('SESSION_EXPIRED');
    expect((await refresh(rt3)).statusCode).toBe(401);
  });

  it('recovers when the refresh response was lost on the way to the phone', async () => {
    ({ app, clock } = await createTestApp());
    const emp = await makeEmployee();
    const rt1 = (await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' })).json().refreshToken as string;

    clock.advance(60_000);
    expect((await refresh(rt1)).statusCode).toBe(200); // server rotated, phone never got the reply

    clock.advance(20_000);
    const retry = await refresh(rt1);
    expect(retry.statusCode).toBe(200);
    const rt3 = retry.json().refreshToken as string;
    expect(rt3).not.toBe(rt1);
    expect((await refresh(rt3)).statusCode).toBe(200);
  });

  it('does not extend the grace window by retrying the old token', async () => {
    ({ app, clock } = await createTestApp());
    const emp = await makeEmployee();
    const rt1 = (await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' })).json().refreshToken as string;
    await refresh(rt1);
    clock.advance(50_000);
    expect((await refresh(rt1)).statusCode).toBe(200);
    clock.advance(20_000); // 70 s after the first rotation
    expect((await refresh(rt1)).statusCode).toBe(401);
  });

  it('slides the 180-day employee session and expires when unused', async () => {
    ({ app, clock } = await createTestApp());
    const emp = await makeEmployee();
    const login = await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' });
    let rt = login.json().refreshToken as string;
    clock.advance(170 * DAY);
    let res = await refresh(rt);
    expect(res.statusCode).toBe(200);
    rt = res.json().refreshToken;
    clock.advance(170 * DAY);
    res = await refresh(rt);
    expect(res.statusCode).toBe(200);
    rt = res.json().refreshToken;
    clock.advance(181 * DAY);
    expect((await refresh(rt)).statusCode).toBe(401);
  });

  it('rejects malformed tokens', async () => {
    ({ app } = await createTestApp());
    expect((await refresh('garbage')).statusCode).toBe(401);
  });
});

describe('authenticated requests', () => {
  it('returns the current user from /me', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee();
    const login = await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' });
    const res = await app.inject({ method: 'GET', url: '/me', headers: bearer(login.json().accessToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(emp.user.id);
  });

  it('rejects missing and invalid tokens', async () => {
    ({ app } = await createTestApp());
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    const bad = await app.inject({ method: 'GET', url: '/me', headers: bearer('nope') });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().code).toBe('UNAUTHORIZED');
  });

  it('rejects the access token right after logout', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee();
    const login = (await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' })).json();
    const out = await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: login.refreshToken } });
    expect(out.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/me', headers: bearer(login.accessToken) })).statusCode).toBe(401);
    expect((await refresh(login.refreshToken)).statusCode).toBe(401);
  });

  it('blocks a deactivated user immediately', async () => {
    ({ app } = await createTestApp());
    const emp = await makeEmployee();
    const token = (await employeeLogin({ phone: emp.user.phone, pin: emp.pin, deviceId: 'd' })).json().accessToken;
    await testDb.db.update(users).set({ isActive: false }).where(eq(users.id, emp.user.id));
    const res = await app.inject({ method: 'GET', url: '/me', headers: bearer(token) });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('ACCOUNT_INACTIVE');
  });
});
