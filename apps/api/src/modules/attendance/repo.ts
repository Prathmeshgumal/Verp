import type { AttendanceStatus } from '@ve/shared';
import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm';
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

export interface DayFilters {
  from: string;
  to: string;
  employeeId?: string;
  siteId?: string;
  status?: AttendanceStatus;
  needsReview?: boolean;
}

export interface AdminDayRow {
  day: DayRow;
  employeeName: string;
  employeeCode: string | null;
  siteName: string;
}

function dayWhere(f: DayFilters) {
  return and(
    gte(attendanceDays.workDate, f.from),
    lte(attendanceDays.workDate, f.to),
    f.employeeId ? eq(attendanceDays.employeeId, f.employeeId) : undefined,
    f.siteId ? eq(attendanceDays.siteId, f.siteId) : undefined,
    f.status ? eq(attendanceDays.status, f.status) : undefined,
    f.needsReview !== undefined ? eq(attendanceDays.needsReview, f.needsReview) : undefined,
  );
}

function adminDaySelect(db: DbOrTx) {
  return db
    .select({ day: attendanceDays, employeeName: users.name, employeeCode: users.employeeCode, siteName: sites.name })
    .from(attendanceDays)
    .innerJoin(users, eq(users.id, attendanceDays.employeeId))
    .innerJoin(sites, eq(sites.id, attendanceDays.siteId));
}

export async function listAdminDays(db: DbOrTx, f: DayFilters, limit: number, offset: number): Promise<AdminDayRow[]> {
  return adminDaySelect(db)
    .where(dayWhere(f))
    .orderBy(desc(attendanceDays.workDate), asc(users.name))
    .limit(limit)
    .offset(offset);
}

export async function countAdminDays(db: DbOrTx, f: DayFilters): Promise<number> {
  const [row] = await db.select({ n: count() }).from(attendanceDays).where(dayWhere(f));
  return row?.n ?? 0;
}

export async function findAdminDay(db: DbOrTx, id: string): Promise<AdminDayRow | undefined> {
  const [row] = await adminDaySelect(db).where(eq(attendanceDays.id, id));
  return row;
}

export async function findDayByIdForUpdate(db: DbOrTx, id: string): Promise<DayRow | undefined> {
  const [row] = await db.select().from(attendanceDays).where(eq(attendanceDays.id, id)).for('update');
  return row;
}

export async function listEventsForDay(db: DbOrTx, employeeId: string, workDate: string): Promise<EventRow[]> {
  return db
    .select()
    .from(attendanceEvents)
    .where(and(eq(attendanceEvents.employeeId, employeeId), eq(attendanceEvents.workDate, workDate)))
    .orderBy(asc(attendanceEvents.serverTime));
}
