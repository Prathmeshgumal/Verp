import { evaluateGeofence, type LatLng } from '@ve/shared';
import type { Fix } from '../native/location';

export type PreviewStatus =
  | { kind: 'finding' }
  | { kind: 'imprecise'; accuracyM: number }
  | { kind: 'outside'; distanceM: number; accuracyM: number }
  | { kind: 'inside'; distanceM: number; accuracyM: number };

/** What the preview says. Uses the server's own rule, so the preview and the check-in never disagree on the same reading. */
export function previewStatus(fix: Fix | null, site: LatLng & { radiusM: number }, maxAccuracyM: number): PreviewStatus {
  if (!fix) return { kind: 'finding' };
  const result = evaluateGeofence({ point: { lat: fix.lat, lng: fix.lng }, accuracyM: fix.accuracyM, site, maxAccuracyM });
  const accuracyM = Math.round(fix.accuracyM);
  if (result.ok) return { kind: 'inside', distanceM: Math.round(result.distanceM), accuracyM };
  if (result.reason === 'LOW_ACCURACY') return { kind: 'imprecise', accuracyM };
  return { kind: 'outside', distanceM: Math.round(result.distanceM), accuracyM };
}
