import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  WorkerLogin: undefined;
  AdminLogin: undefined;
};

export type WorkerTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};

/** Attendance list filters; dates are YYYY-MM-DD work dates. */
export interface AttendanceFilters {
  from: string;
  to: string;
  employeeId?: string;
  /** Shown on the filter chip; the list only sends the id. */
  employeeName?: string;
  siteId?: string;
  status?: 'CHECKED_IN' | 'COMPLETED' | 'MISSED_CHECKOUT';
  needsReview?: boolean;
}

/** The Attendance tab lists days, or the attempts that were refused. */
export type AttendanceView = 'days' | 'refused';

export type AttendanceStackParamList = {
  AttendanceList: { filters?: Partial<AttendanceFilters>; view?: AttendanceView } | undefined;
  AttendanceDetail: { id: string };
};

export type TodayStackParamList = {
  Today: undefined;
  AttendanceDetail: { id: string };
};

export type EmployeesStackParamList = {
  Employees: undefined;
  EmployeeCreate: undefined;
  EmployeeDetail: { id: string };
  AttendanceDetail: { id: string };
};

export type SitesStackParamList = {
  Sites: undefined;
  SiteEdit: { id?: string };
};

export type AdminTabParamList = {
  TodayTab: NavigatorScreenParams<TodayStackParamList>;
  EmployeesTab: NavigatorScreenParams<EmployeesStackParamList>;
  SitesTab: NavigatorScreenParams<SitesStackParamList>;
  AttendanceTab: NavigatorScreenParams<AttendanceStackParamList>;
  SettingsTab: undefined;
};
