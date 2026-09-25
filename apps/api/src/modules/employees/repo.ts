import { and, asc, desc, eq, gt, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { EmployeeDto, EmployeeListQuery, EmployeeSessionDto } from '@ve/shared';
import type { DbOrTx } from '../../db/client';
import { sessions, sites, users, type UserRow } from '../../db/schema';
import { toEmployeeDto } from './dto';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

export async function listEmployees(db: DbOrTx, q: EmployeeListQuery): Promise<EmployeeDto[]> {
  const conds: SQL[] = [eq(users.role, 'employee')];
  if (q.q) {
    const like = `%${escapeLike(q.q)}%`;
    conds.push(or(ilike(users.name, like), ilike(users.phone, like), ilike(users.employeeCode, like))!);
  }
  if (q.siteId) conds.push(eq(users.siteId, q.siteId));
  if (q.isActive !== undefined) conds.push(eq(users.isActive, q.isActive));
  const rows = await db
    .select({ user: users, siteName: sites.name })
    .from(users)
    .leftJoin(sites, eq(sites.id, users.siteId))
    .where(and(...conds))
    .orderBy(asc(users.name));
  return rows.map((r) => toEmployeeDto(r.user, r.siteName));
}

export async function getEmployeeDto(db: DbOrTx, id: string): Promise<EmployeeDto | undefined> {
  const [row] = await db
    .select({ user: users, siteName: sites.name })
    .from(users)
    .leftJoin(sites, eq(sites.id, users.siteId))
    .where(and(eq(users.id, id), eq(users.role, 'employee')));
  return row ? toEmployeeDto(row.user, row.siteName) : undefined;
}

export async function insertEmployee(db: DbOrTx, values: typeof users.$inferInsert): Promise<UserRow> {
  const [row] = await db.insert(users).values(values).returning();
  return row!;
}

export async function updateUser(db: DbOrTx, id: string, values: Partial<typeof users.$inferInsert>): Promise<void> {
  await db.update(users).set(values).where(eq(users.id, id));
}

export async function listActiveSessions(db: DbOrTx, userId: string, now: Date): Promise<EmployeeSessionDto[]> {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastUsedAt));
  return rows.map((s) => ({
    id: s.id,
    deviceId: s.deviceId,
    deviceModel: s.deviceModel,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
  }));
}
