import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { auditLogs, users } from '../src/db/schema';
import { createTestApp } from './helpers/app';
import { testDb } from './helpers/db';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee, makeSite } from './helpers/factories';

let app: FastifyInstance;
let token: string;
afterEach(async () => app?.close());

async function setup() {
  ({ app } = await createTestApp());
  token = await adminToken(app, await makeAdmin());
}
const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: Record<string, unknown>) =>
  app.inject({ method, url, headers: bearer(token), ...(payload !== undefined ? { payload } : {}) });
const loginRes = (phone: string, pin: string) =>
  app.inject({ method: 'POST', url: '/auth/employee/login', payload: { phone, pin, deviceId: 'd' } });

describe('/admin/employees', () => {
  it('creates an employee, returns the PIN once, and the PIN works', async () => {
    await setup();
    const site = await makeSite({ name: 'Plot 7' });
    const res = await call('POST', '/admin/employees', { name: 'Ravi', phone: '98765 43210', employeeCode: 'E-001', siteId: site.id });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.pin).toMatch(/^\d{6}$/);
    expect(body.employee).toMatchObject({ name: 'Ravi', phone: '+919876543210', siteName: 'Plot 7', isActive: true });
    expect(JSON.stringify(body.employee)).not.toContain('Hash');
    expect((await loginRes('9876543210', body.pin)).statusCode).toBe(200);

    const detail = await call('GET', `/admin/employees/${body.employee.id}`);
    expect(detail.json()).not.toHaveProperty('pin');
    expect(detail.json().sessions).toHaveLength(1);

    const [audit] = await testDb.db.select().from(auditLogs);
    expect(audit).toMatchObject({ action: 'employee.create' });
    expect(JSON.stringify(audit)).not.toMatch(/argon2|pin/i);
  });

  it('rejects duplicate phone and employee code', async () => {
    await setup();
    await call('POST', '/admin/employees', { name: 'A', phone: '9876543210', employeeCode: 'E-1' });
    const dupPhone = await call('POST', '/admin/employees', { name: 'B', phone: '+91 98765 43210' });
    expect(dupPhone.statusCode).toBe(409);
    expect(dupPhone.json().code).toBe('PHONE_TAKEN');
    const dupCode = await call('POST', '/admin/employees', { name: 'C', phone: '9876543211', employeeCode: 'E-1' });
    expect(dupCode.json().code).toBe('EMPLOYEE_CODE_TAKEN');
  });

  it('rejects an unknown site', async () => {
    await setup();
    const res = await call('POST', '/admin/employees', { name: 'A', phone: '9876543210', siteId: '8f14e45f-ceea-4f6a-9d3b-9b5a1c2d3e4f' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('SITE_NOT_FOUND');
  });

  it('lists with search and filters, excluding admins', async () => {
    await setup();
    const site = await makeSite();
    await makeEmployee({ name: 'Ravi Kumar', siteId: site.id });
    await makeEmployee({ name: 'Sunita', isActive: false });
    const all = await call('GET', '/admin/employees');
    expect(all.json()).toHaveLength(2);
    expect((await call('GET', '/admin/employees?q=ravi')).json()).toHaveLength(1);
    expect((await call('GET', `/admin/employees?siteId=${site.id}`)).json()).toHaveLength(1);
    expect((await call('GET', '/admin/employees?isActive=false')).json()[0].name).toBe('Sunita');
  });

  it('treats % and _ in search literally', async () => {
    await setup();
    await makeEmployee({ name: 'Ravi' });
    expect((await call('GET', '/admin/employees?q=%25')).json()).toHaveLength(0);
  });

  it('reset-pin revokes sessions and only the new PIN works', async () => {
    await setup();
    const emp = await makeEmployee();
    const oldAccess = await employeeToken(app, emp);
    const res = await call('POST', `/admin/employees/${emp.user.id}/reset-pin`);
    expect(res.statusCode).toBe(200);
    const { pin } = res.json();
    expect((await app.inject({ method: 'GET', url: '/me', headers: bearer(oldAccess) })).statusCode).toBe(401);
    expect((await loginRes(emp.user.phone!, emp.pin)).statusCode).toBe(401);
    expect((await loginRes(emp.user.phone!, pin)).statusCode).toBe(200);
  });

  it('deactivation revokes sessions and blocks login', async () => {
    await setup();
    const emp = await makeEmployee();
    const access = await employeeToken(app, emp);
    const res = await call('PATCH', `/admin/employees/${emp.user.id}`, { isActive: false });
    expect(res.json().isActive).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/me', headers: bearer(access) })).statusCode).toBe(401);
    expect((await loginRes(emp.user.phone!, emp.pin)).statusCode).toBe(403);
  });

  it('updates site assignment and clears the employee code', async () => {
    await setup();
    const site = await makeSite({ name: 'New' });
    const emp = await makeEmployee({ employeeCode: 'X1' });
    const res = await call('PATCH', `/admin/employees/${emp.user.id}`, { siteId: site.id, employeeCode: null });
    expect(res.json()).toMatchObject({ siteId: site.id, siteName: 'New', employeeCode: null });
  });

  it('unlocks a locked employee', async () => {
    await setup();
    const emp = await makeEmployee();
    await testDb.db.update(users).set({ lockedUntil: new Date('2099-01-01') }).where(eq(users.id, emp.user.id));
    expect((await call('POST', `/admin/employees/${emp.user.id}/unlock`)).statusCode).toBe(204);
    expect((await loginRes(emp.user.phone!, emp.pin)).statusCode).toBe(200);
  });

  it('revoke-sessions logs the employee out everywhere', async () => {
    await setup();
    const emp = await makeEmployee();
    const access = await employeeToken(app, emp);
    expect((await call('POST', `/admin/employees/${emp.user.id}/revoke-sessions`)).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/me', headers: bearer(access) })).statusCode).toBe(401);
  });

  it('does not expose admins through employee endpoints', async () => {
    await setup();
    const other = await makeAdmin();
    expect((await call('GET', `/admin/employees/${other.user.id}`)).statusCode).toBe(404);
  });

  it('forbids employees', async () => {
    ({ app } = await createTestApp());
    const t = await employeeToken(app, await makeEmployee());
    const res = await app.inject({ method: 'POST', url: '/admin/employees', headers: bearer(t), payload: { name: 'x', phone: '9876543210' } });
    expect(res.statusCode).toBe(403);
  });
});
