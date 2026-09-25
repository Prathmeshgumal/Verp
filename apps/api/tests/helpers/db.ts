import { sql } from 'drizzle-orm';
import { createDb } from '../../src/db/client';
import { TEST_DATABASE_URL } from './env';

export const testDb = createDb(TEST_DATABASE_URL);

export async function resetDb(): Promise<void> {
  await testDb.db.execute(
    sql`TRUNCATE attendance_events, attendance_days, sessions, audit_logs, users, sites RESTART IDENTITY CASCADE`,
  );
  await testDb.db.execute(
    sql`UPDATE company_settings SET timezone = 'Asia/Kolkata', max_accuracy_m = 50, default_radius_m = 50,
        reminder_time = '19:00', clock_mismatch_minutes = 10 WHERE id = 1`,
  );
}
