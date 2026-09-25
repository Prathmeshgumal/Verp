import { eq } from 'drizzle-orm';
import type { SettingsDto, SettingsUpdate } from '@ve/shared';
import type { DbOrTx } from '../../db/client';
import { companySettings } from '../../db/schema';

export async function getSettings(db: DbOrTx): Promise<SettingsDto> {
  const [row] = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  if (!row) throw new Error('company_settings row missing: run migrations');
  return {
    timezone: row.timezone,
    maxAccuracyM: row.maxAccuracyM,
    defaultRadiusM: row.defaultRadiusM,
    reminderTime: row.reminderTime,
    clockMismatchMinutes: row.clockMismatchMinutes,
  };
}

export async function updateSettings(db: DbOrTx, patch: SettingsUpdate, now: Date): Promise<SettingsDto> {
  await db.update(companySettings).set({ ...patch, updatedAt: now }).where(eq(companySettings.id, 1));
  return getSettings(db);
}
