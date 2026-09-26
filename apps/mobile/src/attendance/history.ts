import type { DayDto } from '@ve/shared';
import { addDays } from './format';

/** "none": before the worker joined, today with nothing yet, or in the future — never counted as absent. */
export type DayKind = 'completed' | 'working' | 'missed' | 'absent' | 'none';

export type DayCell = {
  workDate: string;
  date: number;
  kind: DayKind;
  checkInAt?: string;
  checkOutAt?: string | null;
  workedMinutes?: number | null;
};

export type MonthGrid = { month: string; weeks: (DayCell | null)[][] };

/** "2026-09-25" → "2026-09" */
export const monthOf = (workDate: string) => workDate.slice(0, 7);

export function shiftMonth(month: string, n: number): string {
  const [y = 0, m = 1] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function lastDay(month: string): string {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

/** The dates to fetch for a month: its first day up to its last, or up to today. At most 31 days. */
export function monthRange(month: string, today: string): { from: string; to: string } {
  const last = lastDay(month);
  return { from: `${month}-01`, to: last < today ? last : today };
}

function kindOf(d: DayDto): DayKind {
  return d.status === 'COMPLETED' ? 'completed' : d.status === 'CHECKED_IN' ? 'working' : 'missed';
}

/** A Monday-first calendar of one month; blank slots are null. */
export function buildMonth(month: string, today: string, joinedOn: string, days: DayDto[]): MonthGrid {
  const byDate = new Map(days.map((d) => [d.workDate, d]));
  const first = `${month}-01`;
  const last = lastDay(month);
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null);
  for (let workDate = first; workDate <= last; workDate = addDays(workDate, 1)) {
    const date = Number(workDate.slice(8));
    const d = byDate.get(workDate);
    if (d) cells.push({ workDate, date, kind: kindOf(d), checkInAt: d.checkInAt, checkOutAt: d.checkOutAt, workedMinutes: d.workedMinutes });
    else cells.push({ workDate, date, kind: workDate < joinedOn || workDate >= today ? 'none' : 'absent' });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return { month, weeks };
}

export function monthSummary(grid: MonthGrid): { present: number; absent: number; missed: number; minutes: number } {
  const sum = { present: 0, absent: 0, missed: 0, minutes: 0 };
  for (const c of grid.weeks.flat()) {
    if (!c) continue;
    if (c.kind === 'absent') sum.absent += 1;
    if (c.kind === 'completed' || c.kind === 'working' || c.kind === 'missed') sum.present += 1;
    if (c.kind === 'missed') sum.missed += 1;
    sum.minutes += c.workedMinutes ?? 0;
  }
  return sum;
}
