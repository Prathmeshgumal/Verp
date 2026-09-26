import type { FetchLike } from '../../api/client';

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

export type PlaceSearch = (query: string) => Promise<PlaceResult[]>;

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/** Nominatim usage policy: at most one request per second. */
const MIN_GAP_MS = 1000;

interface Deps {
  fetch?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function createPlaceSearch({
  fetch: fetchImpl = (url, init) => fetch(url, init),
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: Deps = {}): PlaceSearch {
  let lastAt = Number.NEGATIVE_INFINITY;
  return async (query) => {
    const q = query.trim();
    if (!q) return [];
    const wait = lastAt + MIN_GAP_MS - now();
    if (wait > 0) await sleep(wait);
    lastAt = now();
    const params = new URLSearchParams({ q, format: 'jsonv2', limit: '5', countrycodes: 'in', 'accept-language': 'en' });
    const res = await fetchImpl(`${NOMINATIM}?${params}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Place search failed (${res.status})`);
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row: { display_name?: unknown; lat?: unknown; lon?: unknown }) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      return typeof row.display_name === 'string' && Number.isFinite(lat) && Number.isFinite(lng)
        ? [{ name: row.display_name, lat, lng }]
        : [];
    });
  };
}
