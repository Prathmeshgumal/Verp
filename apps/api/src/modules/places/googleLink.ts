import { parseCoordinates, type LatLng } from '@ve/shared';

export type LinkFailure = 'NOT_A_MAPS_LINK' | 'NO_EXACT_PIN' | 'LINK_UNREACHABLE';
export type LinkOutcome = ({ ok: true; point: LatLng } | { ok: false; code: LinkFailure }) & { host: string | null };

const MAX_HOPS = 5;
const TIMEOUT_MS = 5_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; VE-HR/1.0)';
const GOOGLE_HOST = /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/;
const PLACE_PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

/** SSRF guard: only https Google Maps addresses are ever read or fetched. */
export function isAllowedMapsUrl(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || host === 'maps.google.com') return true;
  if (host === 'goo.gl') return url.pathname.startsWith('/maps');
  return GOOGLE_HOST.test(host) && url.pathname.startsWith('/maps');
}

const isShortLink = (url: URL) => url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl';

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, ' '));
  } catch {
    return '';
  }
}

/** Visitors can be bounced through consent.google.com; the real link is in ?continue=. */
function unwrapConsent(url: URL): URL {
  if (url.hostname !== 'consent.google.com') return url;
  const next = url.searchParams.get('continue');
  try {
    return next ? new URL(next) : url;
  } catch {
    return url;
  }
}

/** The exact pin in a full Google Maps URL, or null when the URL only shows an area. */
export function pinFromMapsUrl(url: URL): LatLng | null {
  const pin = PLACE_PIN.exec(url.href);
  if (pin) return parseCoordinates(`${pin[1]},${pin[2]}`);
  for (const key of ['q', 'query']) {
    const value = url.searchParams.get(key);
    const point = value ? parseCoordinates(value.replace(/^loc:/, '')) : null;
    if (point) return point;
  }
  const segments = url.pathname.split('/');
  for (const marker of ['search', 'place']) {
    const i = segments.indexOf(marker);
    const segment = i >= 0 ? segments[i + 1] : undefined;
    const point = segment ? parseCoordinates(safeDecode(segment)) : null;
    if (point) return point;
  }
  return null;
}

/** Coordinates, a full Google Maps link, or a short link (followed hop by hop, each hop re-checked). */
export async function resolveMapsText(text: string, fetchImpl: typeof fetch): Promise<LinkOutcome> {
  const coords = parseCoordinates(text);
  if (coords) return { ok: true, point: coords, host: null };

  const raw = /https?:\/\/[^\s<>"]+/i.exec(text)?.[0];
  let url: URL;
  try {
    url = new URL(raw ?? '');
  } catch {
    return { ok: false, code: 'NOT_A_MAPS_LINK', host: null };
  }
  const host = url.hostname;
  const fail = (code: LinkFailure): LinkOutcome => ({ ok: false, code, host });
  if (!isAllowedMapsUrl(url)) return fail('NOT_A_MAPS_LINK');

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; ; hop++) {
    const point = pinFromMapsUrl(url);
    if (point) return { ok: true, point, host };
    if (!isShortLink(url)) return fail('NO_EXACT_PIN');
    if (hop === MAX_HOPS) return fail('LINK_UNREACHABLE');

    let location: string | null;
    try {
      const res = await fetchImpl(url, { redirect: 'manual', signal, headers: { 'user-agent': USER_AGENT } });
      await res.body?.cancel();
      location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    } catch {
      return fail('LINK_UNREACHABLE');
    }
    if (!location) return fail('LINK_UNREACHABLE');

    let next: URL;
    try {
      next = unwrapConsent(new URL(location, url));
    } catch {
      return fail('LINK_UNREACHABLE');
    }
    if (!isAllowedMapsUrl(next)) return fail('NOT_A_MAPS_LINK');
    url = next;
  }
}
