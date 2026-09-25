import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { attendanceDays, type DayRow } from '../../src/db/schema';
import type { FakeClock } from './app';
import { testDb } from './db';
import { bearer, SITE_LOCATION } from './factories';

export const INSIDE = { lat: SITE_LOCATION.lat + 0.0001, lng: SITE_LOCATION.lng }; // ~11 m from site
export const OUTSIDE = { lat: SITE_LOCATION.lat + 0.001, lng: SITE_LOCATION.lng }; // ~111 m from site

export function submitBody(clock: FakeClock, overrides: Record<string, unknown> = {}) {
  return {
    ...INSIDE,
    accuracyM: 10,
    isMock: false,
    deviceTime: clock.now.toISOString(),
    deviceId: 'dev-1',
    deviceModel: 'Redmi 9A',
    appVersion: '1.0.0',
    ...overrides,
  };
}

export function submit(
  app: FastifyInstance,
  token: string,
  kind: 'check-in' | 'check-out',
  payload: Record<string, unknown>,
  key: string = randomUUID(),
) {
  return app.inject({
    method: 'POST',
    url: `/attendance/${kind}`,
    headers: { ...bearer(token), 'idempotency-key': key },
    payload,
  });
}

/** Inserts a day row directly (09:00 IST check-in by default) for read-side tests. */
export async function insertDay(v: {
  employeeId: string;
  siteId: string;
  workDate: string;
  status?: DayRow['status'];
  checkInAt?: Date;
  checkOutAt?: Date | null;
  workedMinutes?: number | null;
  needsReview?: boolean;
  flags?: string[];
}): Promise<DayRow> {
  const [row] = await testDb.db
    .insert(attendanceDays)
    .values({
      employeeId: v.employeeId,
      siteId: v.siteId,
      workDate: v.workDate,
      status: v.status ?? 'CHECKED_IN',
      checkInAt: v.checkInAt ?? new Date(`${v.workDate}T03:30:00Z`),
      checkInLat: SITE_LOCATION.lat,
      checkInLng: SITE_LOCATION.lng,
      checkInAccuracyM: 10,
      checkInDistanceM: 5,
      checkOutAt: v.checkOutAt ?? null,
      workedMinutes: v.workedMinutes ?? null,
      needsReview: v.needsReview ?? false,
      flags: v.flags ?? [],
    })
    .returning();
  return row!;
}
