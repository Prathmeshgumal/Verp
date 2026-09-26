import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  WorkerLogin: undefined;
  AdminLogin: undefined;
};

export type WorkerTabParamList = {
  Home: undefined;
  History: undefined;
};

export type AttendanceStackParamList = {
  AttendanceList: { employeeId?: string; employeeName?: string } | undefined;
  AttendanceDetail: { id: string };
};

export type EmployeesStackParamList = {
  Employees: undefined;
  EmployeeCreate: undefined;
  EmployeeDetail: { id: string };
};

export type SitesStackParamList = {
  Sites: undefined;
  SiteEdit: { id?: string };
};

export type AdminTabParamList = {
  TodayTab: undefined;
  EmployeesTab: NavigatorScreenParams<EmployeesStackParamList>;
  SitesTab: NavigatorScreenParams<SitesStackParamList>;
  AttendanceTab: NavigatorScreenParams<AttendanceStackParamList>;
};
