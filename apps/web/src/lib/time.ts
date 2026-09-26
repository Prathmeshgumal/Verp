import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/** '09:05' in the company zone. */
export function formatTime(iso: string, tz: string): string {
  return dayjs(iso).tz(tz).format('HH:mm');
}

/** '25 Sep 2026, 09:05' in the company zone. */
export function formatDateTime(iso: string, tz: string): string {
  return dayjs(iso).tz(tz).format('D MMM YYYY, HH:mm');
}

/** Work dates are plain calendar dates ('2026-09-25'), so no zone conversion. */
export function formatWorkDate(workDate: string): string {
  return dayjs(workDate).format('ddd D MMM YYYY');
}

export function todayIn(tz: string, now: Date = new Date()): string {
  return dayjs(now).tz(tz).format('YYYY-MM-DD');
}

export function addDays(date: string, days: number): string {
  return dayjs(date).add(days, 'day').format('YYYY-MM-DD');
}

export function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—';
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Value for <input type="datetime-local"> showing `iso` in company time. */
export function isoToCompanyInput(iso: string, tz: string): string {
  return dayjs(iso).tz(tz).format('YYYY-MM-DDTHH:mm');
}

const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Reads a datetime-local value as company time; returns ISO 8601 with the company offset. */
export function companyInputToIso(value: string, tz: string): string | null {
  if (!LOCAL_INPUT.test(value)) return null;
  const parsed = dayjs.tz(value, tz);
  return parsed.isValid() ? parsed.format() : null;
}
