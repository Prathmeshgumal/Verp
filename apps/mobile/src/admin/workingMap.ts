import type { TFunction } from 'i18next';
import { distanceMeters, type DashboardMapDay } from '@ve/shared';
import { formatTime } from '../attendance/format';
import type { MapTag } from '../maps/LeafletMap';

/** People who checked in closer than this share one tag, so no tag hides another. Same as the web. */
export const STACK_WITHIN_M = 25;

export interface DayStack {
  key: string;
  lat: number;
  lng: number;
  days: DashboardMapDay[];
}

export function visibleDays(days: DashboardMapDay[], showFinished: boolean): DashboardMapDay[] {
  return days.filter((d) => d.status === 'CHECKED_IN' || showFinished);
}

/** Groups check-ins that sit on top of each other; each group is placed at its first check-in. */
export function stackDays(days: DashboardMapDay[]): DayStack[] {
  const stacks: DayStack[] = [];
  for (const d of days) {
    const point = { lat: d.checkInLat, lng: d.checkInLng };
    const near = stacks.find((s) => distanceMeters(s, point) < STACK_WITHIN_M);
    if (near) near.days.push(d);
    else stacks.push({ key: d.dayId, ...point, days: [d] });
  }
  return stacks;
}

/** "in 9:02", or "9:02–6:15" once they have checked out. */
export function dayTime(day: DashboardMapDay, t: TFunction): string {
  const inAt = formatTime(day.checkInAt, t, false);
  return day.status === 'COMPLETED' && day.checkOutAt ? `${inAt}–${formatTime(day.checkOutAt, t, false)}` : `in ${inAt}`;
}

export function dayLabel(day: DashboardMapDay, t: TFunction): string {
  return `${day.name} · ${dayTime(day, t)}`;
}

export function stackLabel(days: DashboardMapDay[], t: TFunction): string {
  if (days.length === 1) return dayLabel(days[0]!, t);
  const names = days.slice(0, 2).map((d) => d.name).join(', ');
  return days.length > 2 ? `${names} +${days.length - 2}` : names;
}

export function dayTone(day: DashboardMapDay): MapTag['tone'] {
  if (day.status === 'COMPLETED') return 'grey';
  return day.needsReview ? 'orange' : 'green';
}

/** Orange if anyone needs review, then green if anyone is still working, else grey. */
export function stackTone(days: DashboardMapDay[]): MapTag['tone'] {
  const tones = days.map(dayTone);
  return tones.includes('orange') ? 'orange' : tones.includes('green') ? 'green' : 'grey';
}

export function stackTags(stacks: DayStack[], t: TFunction): MapTag[] {
  return stacks.map((s) => ({ key: s.key, lat: s.lat, lng: s.lng, label: stackLabel(s.days, t), count: s.days.length, tone: stackTone(s.days) }));
}
