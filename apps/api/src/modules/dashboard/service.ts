import { and, asc, count, eq } from 'drizzle-orm';
import type { DashboardTodayDto } from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import { attendanceDays, sites, users } from '../../db/schema';
import { workDateOf } from '../../lib/workdate';
import { getSettings } from '../settings/repo';

export async function getDashboardToday(deps: ResolvedDeps): Promise<DashboardTodayDto> {
  const { db } = deps;
  const { timezone } = await getSettings(db);
  const workDate = workDateOf(deps.clock(), timezone);

  const [activeRows, statusRows, missedRows, reviewRows, working] = await Promise.all([
    db.select({ n: count() }).from(users).where(and(eq(users.role, 'employee'), eq(users.isActive, true))),
    db
      .select({ status: attendanceDays.status, n: count() })
      .from(attendanceDays)
      .where(eq(attendanceDays.workDate, workDate))
      .groupBy(attendanceDays.status),
    db.select({ n: count() }).from(attendanceDays).where(eq(attendanceDays.status, 'MISSED_CHECKOUT')),
    db.select({ n: count() }).from(attendanceDays).where(eq(attendanceDays.needsReview, true)),
    db
      .select({ employeeId: users.id, name: users.name, siteName: sites.name, checkInAt: attendanceDays.checkInAt })
      .from(attendanceDays)
      .innerJoin(users, eq(users.id, attendanceDays.employeeId))
      .innerJoin(sites, eq(sites.id, attendanceDays.siteId))
      .where(and(eq(attendanceDays.workDate, workDate), eq(attendanceDays.status, 'CHECKED_IN')))
      .orderBy(asc(attendanceDays.checkInAt)),
  ]);

  const byStatus = new Map(statusRows.map((r) => [r.status, r.n]));
  const activeEmployees = activeRows[0]?.n ?? 0;
  const checkedInToday = statusRows.reduce((sum, r) => sum + r.n, 0);

  return {
    workDate,
    activeEmployees,
    checkedInToday,
    workingNow: byStatus.get('CHECKED_IN') ?? 0,
    completedToday: byStatus.get('COMPLETED') ?? 0,
    notYetIn: Math.max(0, activeEmployees - checkedInToday),
    missedCheckouts: missedRows[0]?.n ?? 0,
    needsReview: reviewRows[0]?.n ?? 0,
    working: working.map((w) => ({ ...w, checkInAt: w.checkInAt.toISOString() })),
  };
}
