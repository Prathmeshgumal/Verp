export const queryKeys = {
  today: ['me', 'today'] as const,
  history: (workDate: string) => ['me', 'attendance', workDate] as const,
  dashboard: ['admin', 'dashboard'] as const,
  employees: (filter: object) => ['admin', 'employees', filter] as const,
  employee: (id: string) => ['admin', 'employee', id] as const,
  sites: ['admin', 'sites'] as const,
  site: (id: string) => ['admin', 'site', id] as const,
  attendance: (params: object) => ['admin', 'attendance', params] as const,
  attendanceDay: (id: string) => ['admin', 'attendanceDay', id] as const,
};
