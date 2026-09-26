import type { ErrorCode } from './errors';

export type Role = 'admin' | 'employee';
export type AttendanceStatus = 'CHECKED_IN' | 'COMPLETED' | 'MISSED_CHECKOUT';

export interface PublicUser {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  email: string | null;
  siteId: string | null;
}

/** refreshToken is omitted for web clients (it is set as an HttpOnly cookie instead). */
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}

export interface SiteSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface SiteDto extends SiteSummary {
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DayDto {
  id: string;
  workDate: string;
  siteId: string;
  status: AttendanceStatus;
  checkInAt: string;
  checkOutAt: string | null;
  workedMinutes: number | null;
  flags: string[];
  needsReview: boolean;
}

export interface AttendanceResult {
  code: 'OK' | ErrorCode;
  message: string;
  serverTime: string;
  day?: DayDto;
  distanceM?: number;
}

export interface MeTodayResponse {
  serverTime: string;
  workDate: string;
  day: DayDto | null;
  missedYesterday: boolean;
  site: SiteSummary | null;
  maxAccuracyM: number;
  reminderTime: string;
  /** IANA zone of the company; work dates and reminder time are in this zone. */
  timezone: string;
}

export interface EmployeeDto {
  id: string;
  name: string;
  phone: string;
  employeeCode: string | null;
  siteId: string | null;
  siteName: string | null;
  isActive: boolean;
  lockedUntil: string | null;
  createdAt: string;
}

export interface EmployeeSessionDto {
  id: string;
  deviceId: string | null;
  deviceModel: string | null;
  createdAt: string;
  lastUsedAt: string;
}

export interface EmployeeDetailDto extends EmployeeDto {
  sessions: EmployeeSessionDto[];
}

export interface CreatedEmployeeDto {
  employee: EmployeeDto;
  /** Shown to the admin exactly once. */
  pin: string;
}

export interface AdminDayDto extends DayDto {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  siteName: string;
  checkInLat: number;
  checkInLng: number;
  checkInAccuracyM: number;
  checkInDistanceM: number;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracyM: number | null;
  checkOutDistanceM: number | null;
  reviewedAt: string | null;
}

export interface AttendanceEventDto {
  id: string;
  type: 'IN' | 'OUT';
  result: string;
  serverTime: string;
  deviceTime: string | null;
  lat: number;
  lng: number;
  accuracyM: number;
  distanceM: number | null;
  isMock: boolean;
  deviceId: string | null;
  deviceModel: string | null;
  appVersion: string | null;
}

export interface AdminDayDetailDto {
  day: AdminDayDto;
  site: SiteSummary;
  events: AttendanceEventDto[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardTodayDto {
  workDate: string;
  activeEmployees: number;
  checkedInToday: number;
  workingNow: number;
  completedToday: number;
  notYetIn: number;
  missedCheckouts: number;
  needsReview: number;
  working: Array<{ employeeId: string; name: string; siteName: string; checkInAt: string }>;
}

export interface SettingsDto {
  timezone: string;
  maxAccuracyM: number;
  defaultRadiusM: number;
  reminderTime: string;
  clockMismatchMinutes: number;
}
