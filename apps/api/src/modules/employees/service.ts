import type {
  CreatedEmployeeDto,
  EmployeeCreate,
  EmployeeDetailDto,
  EmployeeDto,
  EmployeeListQuery,
  EmployeeUpdate,
} from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import type { DbOrTx } from '../../db/client';
import { writeAudit } from '../../lib/audit';
import { AppError, uniqueViolation } from '../../lib/errors';
import { generatePin, hashSecret } from '../../lib/password';
import { revokeAllSessions } from '../auth/repo';
import { findSiteById } from '../sites/repo';
import * as repo from './repo';

const notFound = () => new AppError('NOT_FOUND', 404, 'Employee not found');

function mapUniqueError(err: unknown): unknown {
  const constraint = uniqueViolation(err);
  if (constraint === 'users_phone_unique') return new AppError('PHONE_TAKEN', 409, 'Phone number already used');
  if (constraint === 'users_employee_code_unique') {
    return new AppError('EMPLOYEE_CODE_TAKEN', 409, 'Employee code already used');
  }
  return err;
}

async function assertSiteExists(db: DbOrTx, siteId: string | null | undefined): Promise<void> {
  if (siteId && !(await findSiteById(db, siteId))) throw new AppError('SITE_NOT_FOUND', 400, 'Site not found');
}

async function requireEmployee(db: DbOrTx, id: string): Promise<EmployeeDto> {
  const emp = await repo.getEmployeeDto(db, id);
  if (!emp) throw notFound();
  return emp;
}

export function listEmployees(deps: ResolvedDeps, query: EmployeeListQuery): Promise<EmployeeDto[]> {
  return repo.listEmployees(deps.db, query);
}

export async function getEmployee(deps: ResolvedDeps, id: string): Promise<EmployeeDetailDto> {
  const emp = await requireEmployee(deps.db, id);
  return { ...emp, sessions: await repo.listActiveSessions(deps.db, id, deps.clock()) };
}

export async function createEmployee(
  deps: ResolvedDeps,
  actorId: string,
  input: EmployeeCreate,
): Promise<CreatedEmployeeDto> {
  const now = deps.clock();
  await assertSiteExists(deps.db, input.siteId);
  const pin = generatePin();
  const pinHash = await hashSecret(pin);
  try {
    return await deps.db.transaction(async (tx) => {
      const row = await repo.insertEmployee(tx, {
        role: 'employee',
        name: input.name,
        phone: input.phone,
        employeeCode: input.employeeCode ?? null,
        siteId: input.siteId ?? null,
        pinHash,
        createdAt: now,
        updatedAt: now,
      });
      const employee = await requireEmployee(tx, row.id);
      await writeAudit(tx, { actorId, action: 'employee.create', entityType: 'user', entityId: row.id, after: employee }, now);
      return { employee, pin };
    });
  } catch (err) {
    throw mapUniqueError(err);
  }
}

export async function updateEmployee(
  deps: ResolvedDeps,
  actorId: string,
  id: string,
  patch: EmployeeUpdate,
): Promise<EmployeeDto> {
  const now = deps.clock();
  await assertSiteExists(deps.db, patch.siteId);
  try {
    return await deps.db.transaction(async (tx) => {
      const before = await requireEmployee(tx, id);
      await repo.updateUser(tx, id, { ...patch, updatedAt: now });
      if (patch.isActive === false) await revokeAllSessions(tx, id, now);
      const after = await requireEmployee(tx, id);
      await writeAudit(tx, { actorId, action: 'employee.update', entityType: 'user', entityId: id, before, after }, now);
      return after;
    });
  } catch (err) {
    throw mapUniqueError(err);
  }
}

export async function resetPin(deps: ResolvedDeps, actorId: string, id: string): Promise<{ pin: string }> {
  const now = deps.clock();
  const pin = generatePin();
  const pinHash = await hashSecret(pin);
  await deps.db.transaction(async (tx) => {
    await requireEmployee(tx, id);
    await repo.updateUser(tx, id, { pinHash, failedLogins: 0, lockedUntil: null, updatedAt: now });
    await revokeAllSessions(tx, id, now);
    await writeAudit(tx, { actorId, action: 'employee.reset_pin', entityType: 'user', entityId: id }, now);
  });
  return { pin };
}

export async function revokeEmployeeSessions(deps: ResolvedDeps, actorId: string, id: string): Promise<void> {
  const now = deps.clock();
  await deps.db.transaction(async (tx) => {
    await requireEmployee(tx, id);
    await revokeAllSessions(tx, id, now);
    await writeAudit(tx, { actorId, action: 'employee.revoke_sessions', entityType: 'user', entityId: id }, now);
  });
}

export async function unlockEmployee(deps: ResolvedDeps, actorId: string, id: string): Promise<void> {
  const now = deps.clock();
  await deps.db.transaction(async (tx) => {
    await requireEmployee(tx, id);
    await repo.updateUser(tx, id, { failedLogins: 0, lockedUntil: null, updatedAt: now });
    await writeAudit(tx, { actorId, action: 'employee.unlock', entityType: 'user', entityId: id }, now);
  });
}
