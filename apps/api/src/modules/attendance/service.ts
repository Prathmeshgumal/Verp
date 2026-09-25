import { evaluateGeofence, type AttendanceResult, type AttendanceSubmit } from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import type { Tx } from '../../db/client';
import type { DayRow, EventRow } from '../../db/schema';
import { AppError, uniqueViolation } from '../../lib/errors';
import { workDateOf } from '../../lib/workdate';
import { getSettings } from '../settings/repo';
import { findSiteById } from '../sites/repo';
import { toDayDto } from './dto';
import { computeFlags, mergeFlags } from './flags';
import * as repo from './repo';

export type AttendanceKind = 'IN' | 'OUT';

export interface SubmitInput {
  employeeId: string;
  idempotencyKey: string;
  body: AttendanceSubmit;
  ip: string;
}

export interface SubmitOutcome {
  status: number;
  body: AttendanceResult;
}

const OUTCOMES = {
  OK: { status: 200, result: 'ACCEPTED', message: 'Attendance saved' },
  NO_SITE: { status: 403, result: 'NO_SITE', message: 'No work site assigned' },
  LOW_ACCURACY: { status: 422, result: 'LOW_ACCURACY', message: 'Location is not accurate enough' },
  OUTSIDE_SITE: { status: 422, result: 'OUTSIDE_SITE', message: 'You are outside the work site' },
  ALREADY_CHECKED_IN: { status: 409, result: 'ALREADY_CHECKED_IN', message: 'Already checked in today' },
  ALREADY_CHECKED_OUT: { status: 409, result: 'ALREADY_CHECKED_OUT', message: 'Already checked out today' },
  NOT_CHECKED_IN: { status: 409, result: 'NOT_CHECKED_IN', message: 'You have not checked in today' },
} as const;
type Outcome = keyof typeof OUTCOMES;

const IDEMPOTENCY_CONSTRAINT = 'attendance_events_idempotency_key_unique';

function replay(event: EventRow, kind: AttendanceKind, employeeId: string): SubmitOutcome {
  if (event.employeeId !== employeeId || event.type !== kind) {
    throw new AppError('IDEMPOTENCY_KEY_CONFLICT', 409, 'This request key was already used');
  }
  return { status: event.responseStatus, body: event.responseBody as AttendanceResult };
}

/**
 * Records a check-in/check-out attempt. Every attempt that passes validation is logged in
 * attendance_events with its exact response, so retries with the same key replay the original result.
 */
export async function submitAttendance(
  deps: ResolvedDeps,
  kind: AttendanceKind,
  input: SubmitInput,
): Promise<SubmitOutcome> {
  const existing = await repo.findEventByKey(deps.db, input.idempotencyKey);
  if (existing) return replay(existing, kind, input.employeeId);
  try {
    return await deps.db.transaction((tx) => processSubmission(tx, deps, kind, input));
  } catch (err) {
    // A concurrent request with the same key won the race: replay its stored result.
    if (uniqueViolation(err) === IDEMPOTENCY_CONSTRAINT) {
      const winner = await repo.findEventByKey(deps.db, input.idempotencyKey);
      if (winner) return replay(winner, kind, input.employeeId);
    }
    throw err;
  }
}

async function processSubmission(
  tx: Tx,
  deps: ResolvedDeps,
  kind: AttendanceKind,
  input: SubmitInput,
): Promise<SubmitOutcome> {
  const now = deps.clock();
  const settings = await getSettings(tx);
  const workDate = workDateOf(now, settings.timezone);
  const { body, employeeId } = input;
  const newFlags = computeFlags(body, now, settings.clockMismatchMinutes);

  const finish = async (
    outcome: Outcome,
    extra: { day?: DayRow; distanceM?: number } = {},
  ): Promise<SubmitOutcome> => {
    const spec = OUTCOMES[outcome];
    const responseBody: AttendanceResult = {
      code: outcome,
      message: spec.message,
      serverTime: now.toISOString(),
      ...(extra.day ? { day: toDayDto(extra.day) } : {}),
      ...(extra.distanceM !== undefined && outcome !== 'OK' ? { distanceM: Math.round(extra.distanceM) } : {}),
    };
    await repo.insertEvent(tx, {
      employeeId,
      attendanceDayId: extra.day?.id ?? null,
      workDate,
      type: kind,
      result: spec.result,
      serverTime: now,
      deviceTime: new Date(body.deviceTime),
      lat: body.lat,
      lng: body.lng,
      accuracyM: body.accuracyM,
      distanceM: extra.distanceM ?? null,
      isMock: body.isMock,
      deviceId: body.deviceId,
      deviceModel: body.deviceModel ?? null,
      appVersion: body.appVersion ?? null,
      ip: input.ip,
      idempotencyKey: input.idempotencyKey,
      responseStatus: spec.status,
      responseBody,
    });
    return { status: spec.status, body: responseBody };
  };

  if (kind === 'IN') {
    const today = await repo.findDay(tx, employeeId, workDate);
    if (today) return finish('ALREADY_CHECKED_IN', { day: today });

    const site = await repo.findAssignedActiveSite(tx, employeeId);
    if (!site) return finish('NO_SITE');

    const geo = evaluateGeofence({ point: body, accuracyM: body.accuracyM, site, maxAccuracyM: settings.maxAccuracyM });
    if (!geo.ok) return finish(geo.reason, { distanceM: geo.distanceM });

    const day = await repo.insertDayIfAbsent(tx, {
      employeeId,
      workDate,
      siteId: site.id,
      status: 'CHECKED_IN',
      checkInAt: now,
      checkInLat: body.lat,
      checkInLng: body.lng,
      checkInAccuracyM: body.accuracyM,
      checkInDistanceM: geo.distanceM,
      flags: newFlags,
      needsReview: body.isMock,
      createdAt: now,
      updatedAt: now,
    });
    if (!day) {
      const raced = await repo.findDay(tx, employeeId, workDate);
      return finish('ALREADY_CHECKED_IN', raced ? { day: raced } : {});
    }
    return finish('OK', { day, distanceM: geo.distanceM });
  }

  // Check-out: lock today's row so concurrent check-outs serialize.
  const day = await repo.findDayForUpdate(tx, employeeId, workDate);
  if (!day) return finish('NOT_CHECKED_IN');
  if (day.status !== 'CHECKED_IN') return finish('ALREADY_CHECKED_OUT', { day });

  // Judge against the site stored on the day, even if the employee was reassigned since.
  const site = await findSiteById(tx, day.siteId);
  if (!site) throw new Error(`site ${day.siteId} missing for attendance day ${day.id}`);

  const geo = evaluateGeofence({ point: body, accuracyM: body.accuracyM, site, maxAccuracyM: settings.maxAccuracyM });
  if (!geo.ok) return finish(geo.reason, { day, distanceM: geo.distanceM });

  const updated = await repo.updateDay(tx, day.id, {
    status: 'COMPLETED',
    checkOutAt: now,
    checkOutLat: body.lat,
    checkOutLng: body.lng,
    checkOutAccuracyM: body.accuracyM,
    checkOutDistanceM: geo.distanceM,
    workedMinutes: Math.floor((now.getTime() - day.checkInAt.getTime()) / 60_000),
    flags: mergeFlags(day.flags, newFlags),
    needsReview: day.needsReview || body.isMock,
    updatedAt: now,
  });
  return finish('OK', { day: updated, distanceM: geo.distanceM });
}
