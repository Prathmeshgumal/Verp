import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { attendanceDays, companySettings, sites, users } from '../../src/db/schema';
import { testDb } from '../helpers/db';

const { db } = testDb;

describe('database schema', () => {
  it('has exactly one company_settings row with defaults', async () => {
    const rows = await db.select().from(companySettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ timezone: 'Asia/Kolkata', maxAccuracyM: 50, defaultRadiusM: 50, reminderTime: '19:00' });
  });

  it('rejects a second company_settings row', async () => {
    await expect(db.insert(companySettings).values({ id: 2 })).rejects.toThrow();
  });

  it('enforces one attendance day per employee per date', async () => {
    const [site] = await db.insert(sites).values({ name: 'S', lat: 1, lng: 1, radiusM: 50 }).returning();
    const [emp] = await db.insert(users).values({ role: 'employee', name: 'E', phone: '+919000000001' }).returning();
    const row = {
      employeeId: emp!.id,
      workDate: '2026-09-25',
      siteId: site!.id,
      status: 'CHECKED_IN' as const,
      checkInAt: new Date(),
      checkInLat: 1,
      checkInLng: 1,
      checkInAccuracyM: 5,
      checkInDistanceM: 0,
    };
    await db.insert(attendanceDays).values(row);
    await expect(db.insert(attendanceDays).values(row)).rejects.toThrow();
  });

  it('enables row level security on every table', async () => {
    const res = await db.execute<{ relname: string; relrowsecurity: boolean }>(
      sql`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN
          ('users','sites','sessions','attendance_days','attendance_events','audit_logs','company_settings')`,
    );
    expect(res.rows).toHaveLength(7);
    expect(res.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
