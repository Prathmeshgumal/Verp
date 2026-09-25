import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { startMissedCheckoutJob } from './jobs/close-missed-checkouts';
import { systemClock } from './lib/clock';

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const app = await buildApp({ config, db });
const stopJobs = startMissedCheckoutJob({ db, clock: systemClock, log: app.log });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopJobs();
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PORT, host: config.HOST });
