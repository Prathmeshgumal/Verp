import type { DashboardRefusedAttempt } from '@ve/shared';

const REASON: Record<DashboardRefusedAttempt['result'], string> = {
  OUTSIDE_SITE: 'outside the site',
  LOW_ACCURACY: 'location not accurate enough',
};

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** "Check-in refused · outside the site" */
export function refusedTitle(a: Pick<DashboardRefusedAttempt, 'type' | 'result'>): string {
  return `${a.type === 'IN' ? 'Check-in' : 'Check-out'} refused · ${REASON[a.result]}`;
}

/** "140 m from Plot 7", or the GPS accuracy when there was no site to measure from. */
export function refusedWhere(a: Pick<DashboardRefusedAttempt, 'distanceM' | 'siteName' | 'accuracyM'>): string {
  return a.distanceM != null ? `${formatDistance(a.distanceM)} from ${a.siteName ?? 'the site'}` : `accuracy ±${Math.round(a.accuracyM)} m`;
}
