import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Vitest 3+: restoreMocks only undoes vi.spyOn; clearMocks also wipes call history of vi.fn() mocks.
    clearMocks: true,
    restoreMocks: true,
  },
});
