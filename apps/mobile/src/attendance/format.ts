import type { TFunction } from 'i18next';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const list = (t: TFunction, key: string) => t(key).split(',');

/** Local time, 12-hour: "9:02 AM". */
export function formatTime(iso: string, t: TFunction, withSuffix = true): string {
  const d = new Date(iso);
  const h = d.getHours();
  const clock = `${h % 12 || 12}:${pad(d.getMinutes())}`;
  return withSuffix ? `${clock} ${h >= 12 ? t('date.pm') : t('date.am')}` : clock;
}

/** "9 h 13 min", or "9h 04m" when short. */
export function formatDuration(minutes: number, t: TFunction, short = false): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return short ? t('date.hoursMinutesShort', { h, m: pad(m) }) : t('date.hoursMinutes', { h, m });
}

export function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
}

/** "Friday, 25 September" */
export function formatLongDate(date: Date, t: TFunction): string {
  return `${list(t, 'date.weekdays')[date.getDay()]}, ${date.getDate()} ${list(t, 'date.months')[date.getMonth()]}`;
}

const utcDate = (workDate: string) => new Date(`${workDate}T00:00:00Z`);

/** "Fri 25" */
export function formatWorkDateShort(workDate: string, t: TFunction): string {
  const d = utcDate(workDate);
  return `${list(t, 'date.weekdaysShort')[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** "Fri 25 Sep" */
export function formatWorkDateMedium(workDate: string, t: TFunction): string {
  const d = utcDate(workDate);
  return `${formatWorkDateShort(workDate, t)} ${list(t, 'date.monthsShort')[d.getUTCMonth()]}`;
}

export function addDays(workDate: string, n: number): string {
  const d = utcDate(workDate);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO 8601 with the phone's UTC offset, e.g. 2026-09-25T09:02:00.000+05:30. */
export function toIsoWithOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Company clock time "19:00" → "7:00 PM". */
export function formatHhMm(hhmm: string, t: TFunction): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? t('date.pm') : t('date.am')}`;
}
