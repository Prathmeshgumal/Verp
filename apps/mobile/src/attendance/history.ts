import type { DayDto } from '@ve/shared';
import { addDays } from './format';

export type HistoryRow = {
  workDate: string;
  kind: 'completed' | 'working' | 'missed' | 'absent';
  checkInAt?: string;
  checkOutAt?: string | null;
  workedMinutes?: number | null;
};

/** One row per calendar day, newest first; days without a record are "absent". */
export function buildHistoryRows(today: string, days: DayDto[], count = 30): HistoryRow[] {
  const byDate = new Map(days.map((d) => [d.workDate, d]));
  return Array.from({ length: count }, (_, i) => {
    const workDate = addDays(today, -i);
    const d = byDate.get(workDate);
    if (!d) return { workDate, kind: 'absent' };
    const kind = d.status === 'COMPLETED' ? 'completed' : d.status === 'CHECKED_IN' ? 'working' : 'missed';
    return { workDate, kind, checkInAt: d.checkInAt, checkOutAt: d.checkOutAt, workedMinutes: d.workedMinutes };
  });
}
