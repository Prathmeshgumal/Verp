import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client';
import { sessions, users, type SessionRow, type UserRow } from '../../db/schema';

export async function findUserById(db: DbOrTx, id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

export async function findUserByPhone(db: DbOrTx, phone: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.phone, phone));
  return row;
}

export async function findUserByEmail(db: DbOrTx, email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email));
  return row;
}

/** Atomically increments failures; on reaching maxAttempts, locks and resets the counter. */
export async function recordFailedLogin(
  db: DbOrTx,
  userId: string,
  now: Date,
  maxAttempts: number,
  lockMs: number,
): Promise<void> {
  const nextCount = sql`${users.failedLogins} + 1`;
  const lockUntil = new Date(now.getTime() + lockMs).toISOString();
  await db
    .update(users)
    .set({
      failedLogins: sql`CASE WHEN ${nextCount} >= ${maxAttempts} THEN 0 ELSE ${nextCount} END`,
      lockedUntil: sql`CASE WHEN ${nextCount} >= ${maxAttempts} THEN ${lockUntil}::timestamptz ELSE ${users.lockedUntil} END`,
    })
    .where(eq(users.id, userId));
}

export async function resetFailedLogins(db: DbOrTx, userId: string): Promise<void> {
  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, userId));
}

export async function createSession(db: DbOrTx, values: typeof sessions.$inferInsert): Promise<SessionRow> {
  const [row] = await db.insert(sessions).values(values).returning();
  return row!;
}

export async function findSessionWithUser(
  db: DbOrTx,
  sessionId: string,
): Promise<{ session: SessionRow; user: UserRow } | undefined> {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId));
  return row;
}

export async function findSessionForUpdate(db: DbOrTx, sessionId: string): Promise<SessionRow | undefined> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).for('update');
  return row;
}

export async function rotateSession(
  db: DbOrTx,
  id: string,
  values: Pick<SessionRow, 'refreshTokenHash' | 'prevRefreshTokenHash' | 'rotatedAt' | 'lastUsedAt' | 'expiresAt'>,
): Promise<void> {
  await db.update(sessions).set(values).where(eq(sessions.id, id));
}

export async function revokeSession(db: DbOrTx, id: string, now: Date): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
}

export async function revokeAllSessions(db: DbOrTx, userId: string, now: Date): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
