import { and, count, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import type { Paginated, RefusedAttemptDto, RefusedListQuery } from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import type { Db } from '../../db/client';
import { attendanceEvents, sites, users } from '../../db/schema';

const REFUSED = ['OUTSIDE_SITE', 'LOW_ACCURACY'] as const;

/** Refused check-ins and check-outs matching `where`, newest first, with the employee's assigned site. */
export async function selectRefused(db: Db, where: SQL | undefined, limit?: number, offset = 0): Promise<RefusedAttemptDto[]> {
  const q = db
    .select({
      id: attendanceEvents.id,
      employeeId: users.id,
      name: users.name,
      siteId: sites.id,
      siteName: sites.name,
      workDate: attendanceEvents.workDate,
      type: attendanceEvents.type,
      result: attendanceEvents.result,
      serverTime: attendanceEvents.serverTime,
      lat: attendanceEvents.lat,
      lng: attendanceEvents.lng,
      accuracyM: attendanceEvents.accuracyM,
      distanceM: attendanceEvents.distanceM,
    })
    .from(attendanceEvents)
    .innerJoin(users, eq(users.id, attendanceEvents.employeeId))
    .leftJoin(sites, eq(sites.id, users.siteId))
    .where(and(inArray(attendanceEvents.result, [...REFUSED]), where))
    .orderBy(desc(attendanceEvents.serverTime))
    .offset(offset);
  const rows = await (limit == null ? q : q.limit(limit));
  return rows.map((r) => ({ ...r, result: r.result as RefusedAttemptDto['result'], serverTime: r.serverTime.toISOString() }));
}

function filtersOf(q: RefusedListQuery): SQL | undefined {
  return and(
    gte(attendanceEvents.workDate, q.from),
    lte(attendanceEvents.workDate, q.to),
    q.employeeId ? eq(attendanceEvents.employeeId, q.employeeId) : undefined,
    q.siteId ? eq(users.siteId, q.siteId) : undefined,
  );
}

export async function listRefused(deps: ResolvedDeps, q: RefusedListQuery): Promise<Paginated<RefusedAttemptDto>> {
  const where = filtersOf(q);
  const [items, totalRows] = await Promise.all([
    selectRefused(deps.db, where, q.pageSize, (q.page - 1) * q.pageSize),
    deps.db
      .select({ n: count() })
      .from(attendanceEvents)
      .innerJoin(users, eq(users.id, attendanceEvents.employeeId))
      .where(and(inArray(attendanceEvents.result, [...REFUSED]), where)),
  ]);
  return { items, total: totalRows[0]?.n ?? 0, page: q.page, pageSize: q.pageSize };
}
