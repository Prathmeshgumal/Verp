import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import type { Config } from '../../src/config';
import type { Clock } from '../../src/lib/clock';
import { testDb } from './db';
import { TEST_DATABASE_URL } from './env';

export const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
  WEB_ORIGIN: 'http://localhost:5173',
  TRUST_PROXY: false,
  COOKIE_SECURE: false,
  LOG_LEVEL: 'silent',
};

/** Deterministic clock. Default: 2026-09-25 09:30 IST. */
export class FakeClock {
  now: Date;
  constructor(iso = '2026-09-25T04:00:00.000Z') {
    this.now = new Date(iso);
  }
  fn: Clock = () => new Date(this.now);
  set(iso: string): void {
    this.now = new Date(iso);
  }
  advance(ms: number): void {
    this.now = new Date(this.now.getTime() + ms);
  }
}

export async function createTestApp(
  opts: { clock?: FakeClock; beforeReady?: (app: FastifyInstance) => void } = {},
): Promise<{ app: FastifyInstance; clock: FakeClock }> {
  const clock = opts.clock ?? new FakeClock();
  const app = await buildApp({ config: testConfig, db: testDb.db, clock: clock.fn });
  opts.beforeReady?.(app);
  await app.ready();
  return { app, clock };
}
