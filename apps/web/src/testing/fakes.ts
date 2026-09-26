import type { AdminDayDto, DashboardTodayDto, EmployeeDto, PublicUser, SettingsDto, SiteDto } from '@ve/shared';
import type { ApiClient } from '../api/client';
import type { Api } from '../api/endpoints';

/** An Api whose un-stubbed methods reject loudly, so a test never passes by accident. */
export function fakeApi(overrides: Partial<Api> = {}): Api {
  return new Proxy(overrides, {
    get(target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      if (prop in target) return target[prop as keyof Api];
      return () => Promise.reject(new Error(`fakeApi.${prop} not stubbed`));
    },
  }) as Api;
}

export function fakeClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    request: () => Promise.reject(new Error('fakeClient.request not stubbed')),
    requestRaw: () => Promise.reject(new Error('fakeClient.requestRaw not stubbed')),
    login: () => Promise.reject(new Error('fakeClient.login not stubbed')),
    restore: async () => null,
    logout: async () => {},
    onAuthLost: () => () => {},
    ...overrides,
  };
}

export const adminUser: PublicUser = { id: 'a1', role: 'admin', name: 'Asha Admin', phone: null, email: 'asha@example.com', siteId: null };

export const testSettings: SettingsDto = {
  timezone: 'Asia/Kolkata',
  maxAccuracyM: 50,
  defaultRadiusM: 100,
  reminderTime: '19:00',
  clockMismatchMinutes: 10,
};

export function site(overrides: Partial<SiteDto> = {}): SiteDto {
  return {
    id: 's1',
    name: 'Plot 7',
    lat: 18.5912,
    lng: 73.7389,
    radiusM: 100,
    address: 'Hinjewadi Phase 1',
    isActive: true,
    createdAt: '2026-09-01T04:30:00.000Z',
    updatedAt: '2026-09-01T04:30:00.000Z',
    ...overrides,
  };
}

export function employee(overrides: Partial<EmployeeDto> = {}): EmployeeDto {
  return {
    id: 'e1',
    name: 'Ravi Kumar',
    phone: '+919876543210',
    employeeCode: 'VE-014',
    siteId: 's1',
    siteName: 'Plot 7',
    isActive: true,
    lockedUntil: null,
    createdAt: '2026-09-01T04:30:00.000Z',
    ...overrides,
  };
}

/** A completed day: in 09:05 IST, out 17:40 IST, 8h 35m. */
export function adminDay(overrides: Partial<AdminDayDto> = {}): AdminDayDto {
  return {
    id: 'd1',
    workDate: '2026-09-25',
    siteId: 's1',
    status: 'COMPLETED',
    checkInAt: '2026-09-25T03:35:00.000Z',
    checkOutAt: '2026-09-25T12:10:00.000Z',
    workedMinutes: 515,
    flags: [],
    needsReview: false,
    employeeId: 'e1',
    employeeName: 'Ravi Kumar',
    employeeCode: 'VE-014',
    siteName: 'Plot 7',
    checkInLat: 18.5913,
    checkInLng: 73.739,
    checkInAccuracyM: 12,
    checkInDistanceM: 14,
    checkOutLat: 18.5911,
    checkOutLng: 73.7388,
    checkOutAccuracyM: 9,
    checkOutDistanceM: 11,
    reviewedAt: null,
    ...overrides,
  };
}

export function dashboardToday(overrides: Partial<DashboardTodayDto> = {}): DashboardTodayDto {
  return {
    workDate: '2026-09-25',
    activeEmployees: 42,
    checkedInToday: 30,
    workingNow: 12,
    completedToday: 18,
    notYetIn: 12,
    missedCheckouts: 3,
    needsReview: 2,
    working: [{ employeeId: 'e1', name: 'Ravi Kumar', siteName: 'Plot 7', checkInAt: '2026-09-25T03:35:00.000Z' }],
    mapDays: [
      {
        dayId: 'd1',
        employeeId: 'e1',
        name: 'Ravi Kumar',
        siteId: 's1',
        siteName: 'Plot 7',
        status: 'CHECKED_IN',
        checkInAt: '2026-09-25T03:35:00.000Z',
        checkOutAt: null,
        checkInLat: 18.5913,
        checkInLng: 73.739,
        needsReview: false,
      },
      {
        dayId: 'd2',
        employeeId: 'e2',
        name: 'Sunita Rao',
        siteId: 's1',
        siteName: 'Plot 7',
        status: 'COMPLETED',
        checkInAt: '2026-09-25T02:30:00.000Z',
        checkOutAt: '2026-09-25T11:00:00.000Z',
        checkInLat: 18.5911,
        checkInLng: 73.7388,
        needsReview: false,
      },
    ],
    refused: [
      {
        id: 'ev9',
        employeeId: 'e3',
        name: 'Amol Patil',
        siteName: 'Plot 7',
        type: 'IN',
        result: 'OUTSIDE_SITE',
        serverTime: '2026-09-25T04:10:00.000Z',
        lat: 18.6,
        lng: 73.75,
        accuracyM: 12,
        distanceM: 1480.4,
      },
    ],
    ...overrides,
  };
}
