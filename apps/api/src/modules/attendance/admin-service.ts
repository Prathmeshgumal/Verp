import type {
  AdminDayDetailDto,
  AdminDayDto,
  AttendanceListQuery,
  FixCheckout,
  Paginated,
} from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import type { DbOrTx } from '../../db/client';
import { writeAudit } from '../../lib/audit';
import { toCsv, type CsvCell } from '../../lib/csv';
import { AppError } from '../../lib/errors';
import { formatLocal, workDateOf } from '../../lib/workdate';
import { getSettings } from '../settings/repo';
import { toSiteSummary } from '../sites/dto';
import { findSiteById } from '../sites/repo';
import { toAdminDayDto, toDayDto, toEventDto } from './dto';
import { mergeFlags } from './flags';
import * as repo from './repo';

const CSV_ROW_LIMIT = 10_000;
const notFound = () => new AppError('NOT_FOUND', 404, 'Attendance record not found');

function filtersOf(q: AttendanceListQuery): repo.DayFilters {
  const { from, to, employeeId, siteId, status, needsReview } = q;
  return { from, to, employeeId, siteId, status, needsReview };
}

async function requireAdminDay(db: DbOrTx, id: string): Promise<AdminDayDto> {
  const row = await repo.findAdminDay(db, id);
  if (!row) throw notFound();
  return toAdminDayDto(row);
}

export async function listAttendance(deps: ResolvedDeps, q: AttendanceListQuery): Promise<Paginated<AdminDayDto>> {
  const filters = filtersOf(q);
  const [rows, total] = await Promise.all([
    repo.listAdminDays(deps.db, filters, q.pageSize, (q.page - 1) * q.pageSize),
    repo.countAdminDays(deps.db, filters),
  ]);
  return { items: rows.map(toAdminDayDto), total, page: q.page, pageSize: q.pageSize };
}

export async function getAttendanceDetail(deps: ResolvedDeps, id: string): Promise<AdminDayDetailDto> {
  const row = await repo.findAdminDay(deps.db, id);
  if (!row) throw notFound();
  const [site, events] = await Promise.all([
    findSiteById(deps.db, row.day.siteId),
    repo.listEventsForDay(deps.db, row.day.employeeId, row.day.workDate),
  ]);
  return { day: toAdminDayDto(row), site: toSiteSummary(site!), events: events.map(toEventDto) };
}

export async function fixCheckout(
  deps: ResolvedDeps,
  actorId: string,
  id: string,
  input: FixCheckout,
): Promise<AdminDayDto> {
  const now = deps.clock();
  const { timezone } = await getSettings(deps.db);
  const checkOutAt = new Date(input.checkOutAt);
  return deps.db.transaction(async (tx) => {
    const day = await repo.findDayByIdForUpdate(tx, id);
    if (!day) throw notFound();
    if (day.status === 'CHECKED_IN') {
      throw new AppError('INVALID_STATE', 409, 'Employee is still checked in');
    }
    if (checkOutAt <= day.checkInAt || checkOutAt > now || workDateOf(checkOutAt, timezone) !== day.workDate) {
      throw new AppError(
        'INVALID_CHECKOUT_TIME',
        400,
        'Checkout must be after check-in, on the same day, and not in the future',
      );
    }
    const updated = await repo.updateDay(tx, id, {
      status: 'COMPLETED',
      checkOutAt,
      workedMinutes: Math.floor((checkOutAt.getTime() - day.checkInAt.getTime()) / 60_000),
      flags: mergeFlags(day.flags, ['ADMIN_CORRECTED']),
      needsReview: false,
      reviewedBy: actorId,
      reviewedAt: now,
      updatedAt: now,
    });
    await writeAudit(
      tx,
      {
        actorId,
        action: 'attendance.fix_checkout',
        entityType: 'attendance_day',
        entityId: id,
        before: toDayDto(day),
        after: toDayDto(updated),
        reason: input.reason,
      },
      now,
    );
    return requireAdminDay(tx, id);
  });
}

export async function markReviewed(deps: ResolvedDeps, actorId: string, id: string): Promise<AdminDayDto> {
  const now = deps.clock();
  return deps.db.transaction(async (tx) => {
    const day = await repo.findDayByIdForUpdate(tx, id);
    if (!day) throw notFound();
    await repo.updateDay(tx, id, { needsReview: false, reviewedBy: actorId, reviewedAt: now, updatedAt: now });
    await writeAudit(tx, { actorId, action: 'attendance.review', entityType: 'attendance_day', entityId: id }, now);
    return requireAdminDay(tx, id);
  });
}

const CSV_HEADER = [
  'Employee Code',
  'Employee',
  'Site',
  'Date',
  'Status',
  'Check In',
  'Check Out',
  'Hours',
  'Check In Distance (m)',
  'Check Out Distance (m)',
  'Flags',
  'Needs Review',
];

export async function exportAttendanceCsv(deps: ResolvedDeps, q: AttendanceListQuery): Promise<string> {
  const { timezone } = await getSettings(deps.db);
  const filters = filtersOf(q);
  const total = await repo.countAdminDays(deps.db, filters);
  if (total > CSV_ROW_LIMIT) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `Export has ${total} rows, more than the ${CSV_ROW_LIMIT} limit; narrow the date range`,
    );
  }
  const rows = await repo.listAdminDays(deps.db, filters, CSV_ROW_LIMIT, 0);
  const lines: CsvCell[][] = rows.map(({ day, employeeName, employeeCode, siteName }) => [
    employeeCode,
    employeeName,
    siteName,
    day.workDate,
    day.status,
    formatLocal(day.checkInAt, timezone),
    day.checkOutAt ? formatLocal(day.checkOutAt, timezone) : null,
    day.workedMinutes !== null ? (day.workedMinutes / 60).toFixed(2) : null,
    Math.round(day.checkInDistanceM),
    day.checkOutDistanceM !== null ? Math.round(day.checkOutDistanceM) : null,
    day.flags.join(' '),
    day.needsReview ? 'yes' : 'no',
  ]);
  // BOM so Excel opens UTF-8 names correctly.
  return '\uFEFF' + toCsv([CSV_HEADER, ...lines]);
}
