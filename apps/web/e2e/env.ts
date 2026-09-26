export const E2E = {
  /** Superuser connection used only to drop/create the e2e database (docker compose and CI both use ve/ve). */
  adminDbUrl: process.env.E2E_ADMIN_DB_URL ?? 'postgres://ve:ve@localhost:5433/postgres',
  dbName: 've_e2e',
  databaseUrl: process.env.E2E_DATABASE_URL ?? 'postgres://ve:ve@localhost:5433/ve_e2e',
  apiPort: 3100,
  webPort: 4173,
  adminEmail: 'e2e-admin@example.com',
  adminPassword: 'e2e-password-123',
} as const;

export const apiUrl = `http://localhost:${E2E.apiPort}`;
