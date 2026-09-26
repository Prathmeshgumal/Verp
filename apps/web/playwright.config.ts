import { defineConfig, devices } from '@playwright/test';
import { apiUrl, E2E } from './e2e/env';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${E2E.webPort}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @ve/api exec tsx src/server.ts',
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(E2E.apiPort),
        DATABASE_URL: E2E.databaseUrl,
        JWT_SECRET: 'e2e-only-secret-that-is-at-least-32-characters',
        WEB_ORIGIN: `http://localhost:${E2E.webPort}`,
        COOKIE_SECURE: 'false',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `vite build && vite preview --port ${E2E.webPort} --strictPort`,
      url: `http://localhost:${E2E.webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: apiUrl },
    },
  ],
});
