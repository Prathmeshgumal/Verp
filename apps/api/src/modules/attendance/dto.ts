import type { AdminDayDto, AttendanceEventDto, DayDto } from '@ve/shared';
import type { DayRow, EventRow } from '../../db/schema';
import type { AdminDayRow } from './repo';

export function toDayDto(d: DayRow): DayDto {
  return {
    id: d.id,
    workDate: d.workDate,
    siteId: d.siteId,
    status: d.status,
    checkInAt: d.checkInAt.toISOString(),
    checkOutAt: d.checkOutAt?.toISOString() ?? null,
    workedMinutes: d.workedMinutes,
    flags: d.flags,
    needsReview: d.needsReview,
  };
}

export function toAdminDayDto(r: AdminDayRow): AdminDayDto {
  const d = r.day;
  return {
    ...toDayDto(d),
    employeeId: d.employeeId,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    siteName: r.siteName,
    checkInLat: d.checkInLat,
    checkInLng: d.checkInLng,
    checkInAccuracyM: d.checkInAccuracyM,
    checkInDistanceM: d.checkInDistanceM,
    checkOutLat: d.checkOutLat,
    checkOutLng: d.checkOutLng,
    checkOutAccuracyM: d.checkOutAccuracyM,
    checkOutDistanceM: d.checkOutDistanceM,
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
  };
}

export function toEventDto(e: EventRow): AttendanceEventDto {
  return {
    id: e.id,
    type: e.type,
    result: e.result,
    serverTime: e.serverTime.toISOString(),
    deviceTime: e.deviceTime?.toISOString() ?? null,
    lat: e.lat,
    lng: e.lng,
    accuracyM: e.accuracyM,
    distanceM: e.distanceM,
    isMock: e.isMock,
    deviceId: e.deviceId,
    deviceModel: e.deviceModel,
    appVersion: e.appVersion,
  };
}
