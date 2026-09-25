import type { DayDto } from '@ve/shared';
import type { DayRow } from '../../db/schema';

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
