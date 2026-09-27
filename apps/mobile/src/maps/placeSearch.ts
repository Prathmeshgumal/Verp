import type { FetchLike } from '../api/client';

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

export type PlaceSearch = (query: string) => Promise<PlaceResult[]>;

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/** Nominatim usage policy: at most one request per second, and say who is asking. */
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 10_000;

interface Deps {
  fetch?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Place names to map points, from OpenStreetMap; same rules as the web dashboard. */
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
    const params = `q=${encodeURIComponent(q)}&format=jsonv2&limit=5&countrycodes=in&accept-language=en`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${NOMINATIM}?${params}`, {
        headers: { accept: 'application/json', 'User-Agent': 'VeHR-admin-app' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Place search failed (${res.status})`);
      const rows = (await res.json()) as unknown;
      if (!Array.isArray(rows)) return [];
      return rows.flatMap((row: { display_name?: unknown; lat?: unknown; lon?: unknown }) => {
        const lat = Number(row.lat);
        const lng = Number(row.lon);
        return typeof row.display_name === 'string' && Number.isFinite(lat) && Number.isFinite(lng) ? [{ name: row.display_name, lat, lng }] : [];
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

export const searchPlaces = createPlaceSearch();
