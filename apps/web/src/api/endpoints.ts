import type {
  AdminDayDetailDto,
  AdminDayDto,
  AttendanceStatus,
  CreatedEmployeeDto,
  DashboardTodayDto,
  EmployeeCreate,
  EmployeeDetailDto,
  EmployeeDto,
  EmployeeUpdate,
  FixCheckout,
  Paginated,
  SettingsDto,
  SettingsUpdate,
  SiteCreate,
  SiteDto,
  SiteUpdate,
} from '@ve/shared';
import type { ApiClient, Query } from './client';

export interface EmployeeListParams {
  q?: string;
  siteId?: string;
  isActive?: boolean;
}

export interface AttendanceQuery {
  from: string;
  to: string;
  employeeId?: string;
  siteId?: string;
  status?: AttendanceStatus;
  /** true = only days that need review; false/undefined = any. */
  needsReview?: boolean;
}

export interface AttendancePageQuery extends AttendanceQuery {
  page: number;
  pageSize: number;
}

function attendanceParams(q: AttendanceQuery): Query {
  return {
    from: q.from,
    to: q.to,
    employeeId: q.employeeId,
    siteId: q.siteId,
    status: q.status,
    needsReview: q.needsReview ? 'true' : undefined,
  };
}

export function createApi(client: ApiClient) {
  const get = <T>(path: string, query?: Query) => client.request<T>('GET', path, { query });
  const send = <T>(method: 'POST' | 'PATCH', path: string, body?: unknown) =>
    client.request<T>(method, path, body === undefined ? {} : { body });

  return {
    dashboard: () => get<DashboardTodayDto>('/admin/dashboard/today'),
    settings: () => get<SettingsDto>('/admin/settings'),
    updateSettings: (body: SettingsUpdate) => send<SettingsDto>('PATCH', '/admin/settings', body),

    listEmployees: (params: EmployeeListParams = {}) => get<EmployeeDto[]>('/admin/employees', { ...params }),
    getEmployee: (id: string) => get<EmployeeDetailDto>(`/admin/employees/${id}`),
    createEmployee: (body: EmployeeCreate) => send<CreatedEmployeeDto>('POST', '/admin/employees', body),
    updateEmployee: (id: string, body: EmployeeUpdate) => send<EmployeeDto>('PATCH', `/admin/employees/${id}`, body),
    resetPin: (id: string) => send<{ pin: string }>('POST', `/admin/employees/${id}/reset-pin`),
    revokeSessions: (id: string) => send<void>('POST', `/admin/employees/${id}/revoke-sessions`),
    unlockEmployee: (id: string) => send<void>('POST', `/admin/employees/${id}/unlock`),

    listSites: () => get<SiteDto[]>('/admin/sites'),
    getSite: (id: string) => get<SiteDto>(`/admin/sites/${id}`),
    createSite: (body: SiteCreate) => send<SiteDto>('POST', '/admin/sites', body),
    updateSite: (id: string, body: SiteUpdate) => send<SiteDto>('PATCH', `/admin/sites/${id}`, body),

    listAttendance: (q: AttendancePageQuery) =>
      get<Paginated<AdminDayDto>>('/admin/attendance', { ...attendanceParams(q), page: q.page, pageSize: q.pageSize }),
    getAttendance: (id: string) => get<AdminDayDetailDto>(`/admin/attendance/${id}`),
    fixCheckout: (id: string, body: FixCheckout) => send<AdminDayDto>('PATCH', `/admin/attendance/${id}/checkout`, body),
    markReviewed: (id: string) => send<AdminDayDto>('POST', `/admin/attendance/${id}/review`),

    /** Goes through the refreshing client (a plain link would carry no token). */
    async exportAttendanceCsv(q: AttendanceQuery): Promise<{ blob: Blob; filename: string }> {
      const res = await client.requestRaw('GET', '/admin/attendance/export.csv', { query: attendanceParams(q) });
      // The API's Content-Disposition is not exposed to cross-origin JS, so we rebuild the same name.
      return { blob: await res.blob(), filename: `attendance_${q.from}_${q.to}.csv` };
    },
  };
}

export type Api = ReturnType<typeof createApi>;
