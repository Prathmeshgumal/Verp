import { distanceMeters, type DashboardMapDay, type SiteDto } from '@ve/shared';
import { formatTime } from '../../lib/time';

/** Below this zoom, the tags at one site merge into one count bubble. */
export const GROUP_BELOW_ZOOM = 16;

export type TagTone = 'green' | 'orange' | 'grey';

export interface SiteBubble {
  siteId: string;
  lat: number;
  lng: number;
  label: string;
}

export function visibleDays(days: DashboardMapDay[], showFinished: boolean): DashboardMapDay[] {
  return days.filter((d) => d.status === 'CHECKED_IN' || showFinished);
}

export function tagTone(day: DashboardMapDay): TagTone {
  if (day.status === 'COMPLETED') return 'grey';
  return day.needsReview ? 'orange' : 'green';
}

export function tagLabel(day: DashboardMapDay, tz: string): string {
  const inAt = formatTime(day.checkInAt, tz);
  return day.status === 'COMPLETED' && day.checkOutAt
    ? `${day.name} · ${inAt}–${formatTime(day.checkOutAt, tz)}`
    : `${day.name} · in ${inAt}`;
}

export function siteBubbles(days: DashboardMapDay[], sites: SiteDto[]): SiteBubble[] {
  const byId = new Map(sites.map((s) => [s.id, s]));
  const groups = new Map<string, DashboardMapDay[]>();
  for (const d of days) groups.set(d.siteId, [...(groups.get(d.siteId) ?? []), d]);
  return [...groups].map(([siteId, list]) => {
    const site = byId.get(siteId);
    const lat = site?.lat ?? list.reduce((sum, d) => sum + d.checkInLat, 0) / list.length;
    const lng = site?.lng ?? list.reduce((sum, d) => sum + d.checkInLng, 0) / list.length;
    const working = list.filter((d) => d.status === 'CHECKED_IN').length;
    const done = list.length - working;
    const counts = [working ? `${working} working` : null, done ? `${done} done` : null].filter(Boolean).join(', ');
    return { siteId, lat, lng, label: `${list[0]!.siteName} · ${counts}` };
  });
}

/** People who checked in closer than this share one tag, so no tag hides another. */
export const STACK_WITHIN_M = 25;

export interface DayStack {
  key: string;
  lat: number;
  lng: number;
  days: DashboardMapDay[];
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

export function stackLabel(days: DashboardMapDay[], tz: string): string {
  if (days.length === 1) return tagLabel(days[0]!, tz);
  const names = days.slice(0, 2).map((d) => d.name).join(', ');
  return days.length > 2 ? `${names} +${days.length - 2}` : names;
}

/** Orange if anyone needs review, then green if anyone is still working, else grey. */
export function stackTone(days: DashboardMapDay[]): TagTone {
  const tones = days.map(tagTone);
  return tones.includes('orange') ? 'orange' : tones.includes('green') ? 'green' : 'grey';
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

/** Leaflet divIcon markup for one tag. Names are typed by admins, so they are escaped. */
export function tagHtml(day: DashboardMapDay, tz: string): string {
  return `<div class="ve-tag ve-tag-${tagTone(day)}">${escapeHtml(tagLabel(day, tz))}</div>`;
}

export function stackHtml(days: DashboardMapDay[], tz: string): string {
  const count = days.length > 1 ? `<span class="ve-tag-count">${days.length}</span>` : '';
  return `<div class="ve-tag ve-tag-${stackTone(days)}">${count}${escapeHtml(stackLabel(days, tz))}</div>`;
}

export function bubbleHtml(bubble: SiteBubble): string {
  return `<div class="ve-bubble">${escapeHtml(bubble.label)}</div>`;
}
