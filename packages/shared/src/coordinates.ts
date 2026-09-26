import type { LatLng } from './geo';

const DECIMAL = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const DMS = /(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]\s*([NSEW])/gi;

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Reads coordinates as Google Maps copies them: `17.416682, 78.366365` or `17°25'00.1"N 78°21'58.9"E`. */
export function parseCoordinates(text: string): LatLng | null {
  const decimal = DECIMAL.exec(text);
  if (decimal) return valid(Number(decimal[1]), Number(decimal[2]));
  const parts = [...text.matchAll(DMS)];
  if (parts.length !== 2) return null;
  let lat: number | null = null;
  let lng: number | null = null;
  for (const [, deg, min, sec, hemisphere] of parts) {
    const value = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
    const h = hemisphere!.toUpperCase();
    if (h === 'N' || h === 'S') lat = h === 'S' ? -value : value;
    else lng = h === 'W' ? -value : value;
  }
  return lat === null || lng === null ? null : valid(lat, lng);
}
