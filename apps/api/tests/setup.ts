import { afterAll, beforeEach } from 'vitest';
import { resetDb, testDb } from './helpers/db';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await testDb.pool.end();
});
