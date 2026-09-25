export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GeofenceResult =
  | { ok: true; distanceM: number }
  | { ok: false; reason: 'LOW_ACCURACY' | 'OUTSIDE_SITE'; distanceM: number };

/** Accuracy is checked first; both limits are inclusive. */
export function evaluateGeofence(input: {
  point: LatLng;
  accuracyM: number;
  site: LatLng & { radiusM: number };
  maxAccuracyM: number;
}): GeofenceResult {
  const distanceM = distanceMeters(input.point, input.site);
  if (input.accuracyM > input.maxAccuracyM) return { ok: false, reason: 'LOW_ACCURACY', distanceM };
  if (distanceM > input.site.radiusM) return { ok: false, reason: 'OUTSIDE_SITE', distanceM };
  return { ok: true, distanceM };
}
