import type {
  AdminDayDetailDto,
  AdminDayDto,
  AttendanceResult,
  AttendanceSubmit,
  AuthTokens,
  CreatedEmployeeDto,
  DashboardTodayDto,
  DayDto,
  EmployeeDetailDto,
  EmployeeDto,
  MeResponse,
  MeTodayResponse,
  Paginated,
  SiteDto,
} from '@ve/shared';
import type { ApiClient, Query } from './client';
import { ApiError } from './errors';

/** Outcomes the attendance endpoints report with a 403/409/422 but a normal AttendanceResult body. */
export const ATTENDANCE_RESULT_CODES: ReadonlySet<string> = new Set([
  'NO_SITE',
  'LOW_ACCURACY',
  'OUTSIDE_SITE',
  'ALREADY_CHECKED_IN',
  'ALREADY_CHECKED_OUT',
  'NOT_CHECKED_IN',
]);

export interface EmployeeLoginBody {
  phone: string;
  pin: string;
  deviceId: string;
  deviceModel?: string;
}

export interface AdminLoginBody {
  email: string;
  password: string;
  client: 'mobile';
  deviceId?: string;
  deviceModel?: string;
}

export interface EmployeeCreateBody {
  name: string;
  phone: string;
  employeeCode?: string;
  siteId?: string | null;
}

export interface SiteBody {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface SiteUpdateBody extends Partial<Omit<SiteBody, 'address'>> {
  /** null clears the address. */
  address?: string | null;
  isActive?: boolean;
}

export interface AttendanceListParams {
  from: string;
  to: string;
  employeeId?: string;
  page?: number;
  pageSize?: number;
}

export function createApi(client: ApiClient) {
  const get = <T>(path: string, query?: Query) => client.request<T>('GET', path, query ? { query } : undefined);

  async function submit(path: string, key: string, body: AttendanceSubmit): Promise<AttendanceResult> {
    try {
      return await client.request<AttendanceResult>('POST', path, { body, headers: { 'Idempotency-Key': key } });
    } catch (err) {
      if (err instanceof ApiError && ATTENDANCE_RESULT_CODES.has(err.code)) return err.body as AttendanceResult;
      throw err;
    }
  }

  return {
    loginEmployee: (body: EmployeeLoginBody) =>
      client.request<AuthTokens>('POST', '/auth/employee/login', { auth: false, body }),
    loginAdmin: (body: AdminLoginBody) => client.request<AuthTokens>('POST', '/auth/admin/login', { auth: false, body }),
    logout: (refreshToken: string) =>
      client.request<void>('POST', '/auth/logout', { auth: false, body: { refreshToken } }),

    me: () => get<MeResponse>('/me'),
    today: () => get<MeTodayResponse>('/me/today'),
    myAttendance: (from: string, to: string) => get<DayDto[]>('/me/attendance', { from, to }),
    checkIn: (key: string, body: AttendanceSubmit) => submit('/attendance/check-in', key, body),
    checkOut: (key: string, body: AttendanceSubmit) => submit('/attendance/check-out', key, body),

    dashboard: () => get<DashboardTodayDto>('/admin/dashboard/today'),
    listEmployees: (params: { q?: string; siteId?: string; isActive?: boolean }) =>
      get<EmployeeDto[]>('/admin/employees', {
        q: params.q?.trim() || undefined,
        siteId: params.siteId,
        isActive: params.isActive === undefined ? undefined : String(params.isActive),
      }),
    getEmployee: (id: string) => get<EmployeeDetailDto>(`/admin/employees/${id}`),
    createEmployee: (body: EmployeeCreateBody) =>
      client.request<CreatedEmployeeDto>('POST', '/admin/employees', { body }),
    resetPin: (id: string) => client.request<{ pin: string }>('POST', `/admin/employees/${id}/reset-pin`),

    listSites: () => get<SiteDto[]>('/admin/sites'),
    getSite: (id: string) => get<SiteDto>(`/admin/sites/${id}`),
    createSite: (body: SiteBody) => client.request<SiteDto>('POST', '/admin/sites', { body }),
    updateSite: (id: string, body: SiteUpdateBody) => client.request<SiteDto>('PATCH', `/admin/sites/${id}`, { body }),

    listAttendance: (params: AttendanceListParams) =>
      get<Paginated<AdminDayDto>>('/admin/attendance', { ...params }),
    getAttendance: (id: string) => get<AdminDayDetailDto>(`/admin/attendance/${id}`),
  };
}

export type Api = ReturnType<typeof createApi>;
