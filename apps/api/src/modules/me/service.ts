import type { DayDto, MeTodayResponse, MyAttendanceQuery } from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import { AppError } from '../../lib/errors';
import { addDays, workDateOf } from '../../lib/workdate';
import { toDayDto } from '../attendance/dto';
import { findAssignedActiveSite, findDay, listDays } from '../attendance/repo';
import { getSettings } from '../settings/repo';
import { toSiteSummary } from '../sites/dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 31;

export async function getToday(deps: ResolvedDeps, employeeId: string): Promise<MeTodayResponse> {
  const now = deps.clock();
  const settings = await getSettings(deps.db);
  const workDate = workDateOf(now, settings.timezone);
  const [day, yesterday, site] = await Promise.all([
    findDay(deps.db, employeeId, workDate),
    findDay(deps.db, employeeId, addDays(workDate, -1)),
    findAssignedActiveSite(deps.db, employeeId),
  ]);
  return {
    serverTime: now.toISOString(),
    workDate,
    day: day ? toDayDto(day) : null,
    missedYesterday: yesterday?.status === 'MISSED_CHECKOUT',
    site: site ? toSiteSummary(site) : null,
    maxAccuracyM: settings.maxAccuracyM,
    reminderTime: settings.reminderTime,
  };
}

export async function getMyAttendance(
  deps: ResolvedDeps,
  employeeId: string,
  query: MyAttendanceQuery,
): Promise<DayDto[]> {
  const settings = await getSettings(deps.db);
  const to = query.to ?? workDateOf(deps.clock(), settings.timezone);
  const from = query.from ?? addDays(to, -29);
  const span = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
  if (span < 1 || span > MAX_RANGE_DAYS) {
    throw new AppError('VALIDATION_ERROR', 400, `Date range must be 1–${MAX_RANGE_DAYS} days`);
  }
  return (await listDays(deps.db, employeeId, from, to)).map(toDayDto);
}
