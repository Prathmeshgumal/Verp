export const queryKeys = {
  settings: ['settings'] as const,
  dashboard: ['dashboard'] as const,
  employees: (params: object) => ['employees', 'list', params] as const,
  employee: (id: string) => ['employees', 'detail', id] as const,
  sites: ['sites', 'list'] as const,
  site: (id: string) => ['sites', 'detail', id] as const,
  attendance: (params: object) => ['attendance', 'list', params] as const,
  attendanceDay: (id: string) => ['attendance', 'detail', id] as const,
};
