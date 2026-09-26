import type { DashboardMapDay, SiteDto } from '@ve/shared';
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

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

/** Leaflet divIcon markup for one tag. Names are typed by admins, so they are escaped. */
export function tagHtml(day: DashboardMapDay, tz: string): string {
  return `<div class="ve-tag ve-tag-${tagTone(day)}">${escapeHtml(tagLabel(day, tz))}</div>`;
}

export function bubbleHtml(bubble: SiteBubble): string {
  return `<div class="ve-bubble">${escapeHtml(bubble.label)}</div>`;
}
