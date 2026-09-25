import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client';
import {
  attendanceDays,
  attendanceEvents,
  sites,
  users,
  type DayRow,
  type EventRow,
  type SiteRow,
} from '../../db/schema';

export async function findEventByKey(db: DbOrTx, key: string): Promise<EventRow | undefined> {
  const [row] = await db.select().from(attendanceEvents).where(eq(attendanceEvents.idempotencyKey, key));
  return row;
}

export async function insertEvent(db: DbOrTx, values: typeof attendanceEvents.$inferInsert): Promise<void> {
  await db.insert(attendanceEvents).values(values);
}

export async function findDay(db: DbOrTx, employeeId: string, workDate: string): Promise<DayRow | undefined> {
  const [row] = await db
    .select()
    .from(attendanceDays)
    .where(and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.workDate, workDate)));
  return row;
}

export async function findDayForUpdate(db: DbOrTx, employeeId: string, workDate: string): Promise<DayRow | undefined> {
  const [row] = await db
    .select()
    .from(attendanceDays)
    .where(and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.workDate, workDate)))
    .for('update');
  return row;
}

/** Returns undefined when a row for (employee, date) already exists. */
export async function insertDayIfAbsent(
  db: DbOrTx,
  values: typeof attendanceDays.$inferInsert,
): Promise<DayRow | undefined> {
  const [row] = await db
    .insert(attendanceDays)
    .values(values)
    .onConflictDoNothing({ target: [attendanceDays.employeeId, attendanceDays.workDate] })
    .returning();
  return row;
}

export async function updateDay(
  db: DbOrTx,
  id: string,
  values: Partial<typeof attendanceDays.$inferInsert>,
): Promise<DayRow> {
  const [row] = await db.update(attendanceDays).set(values).where(eq(attendanceDays.id, id)).returning();
  return row!;
}

export async function findAssignedActiveSite(db: DbOrTx, employeeId: string): Promise<SiteRow | undefined> {
  const [row] = await db
    .select({ site: sites })
    .from(users)
    .innerJoin(sites, eq(sites.id, users.siteId))
    .where(and(eq(users.id, employeeId), eq(sites.isActive, true)));
  return row?.site;
}

export async function listDays(db: DbOrTx, employeeId: string, from: string, to: string): Promise<DayRow[]> {
  return db
    .select()
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, employeeId),
        gte(attendanceDays.workDate, from),
        lte(attendanceDays.workDate, to),
      ),
    )
    .orderBy(desc(attendanceDays.workDate));
}
