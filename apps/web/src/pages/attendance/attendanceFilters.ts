import type { AttendanceStatus } from '@ve/shared';
import type { AttendanceQuery } from '../../api/endpoints';

export interface AttendanceFilters extends AttendanceQuery {
  page: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['CHECKED_IN', 'COMPLETED', 'MISSED_CHECKOUT'] satisfies AttendanceStatus[];

export function filtersFromParams(params: URLSearchParams, today: string): AttendanceFilters {
  const date = (key: string) => {
    const value = params.get(key) ?? '';
    return DATE.test(value) ? value : today;
  };
  let from = date('from');
  let to = date('to');
  if (from > to) [from, to] = [to, from];
  const status = params.get('status') ?? '';
  const page = Number(params.get('page'));
  return {
    from,
    to,
    employeeId: params.get('employeeId') || undefined,
    siteId: params.get('siteId') || undefined,
    status: STATUSES.includes(status) ? (status as AttendanceStatus) : undefined,
    needsReview: params.get('needsReview') === 'true' || undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function filtersToParams(f: AttendanceFilters): URLSearchParams {
  const params = new URLSearchParams({ from: f.from, to: f.to });
  if (f.employeeId) params.set('employeeId', f.employeeId);
  if (f.siteId) params.set('siteId', f.siteId);
  if (f.status) params.set('status', f.status);
  if (f.needsReview) params.set('needsReview', 'true');
  if (f.page > 1) params.set('page', String(f.page));
  return params;
}
