# Trustworthy Location and Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Never use a location silently. Show accuracy everywhere, refuse imprecise site pins, let admins paste Google Maps links, show workers their position before check-in, and give admins map views of sites and of the working day.

**Architecture:** Additive changes across the existing monorepo:
- **Shared:** gains coordinate parsing.
- **API:** gains one admin endpoint (`POST /admin/places/resolve-link`) and one additive dashboard field (`mapDays`).
- **Web dashboard:** gains an accuracy-gated locator, a paste box, a map+list Sites tab and a Today map.
- **Android app:** gains a native location watch, a live preview on the worker home screen, and the same site-editor rules.

The check-in decision stays on the server, unchanged.

**Tech Stack:**
- API: Fastify 5, Drizzle, Postgres (tests on docker `ve-db-1`, port 5433).
- Web: React 19.2.3, Vite 8 (rolldown), Mantine 9, TanStack Query 5, react-router 7.18.4, react-leaflet 5 / Leaflet 1.9, Vitest 5 + Testing Library.
- App: React Native 0.87.1 (TurboModules + codegen), Kotlin, Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-09-26-location-and-maps-design.md` (builds on `docs/superpowers/specs/2026-09-25-ve-hr-phase1-design.md`).

## Global Constraints

- **Git:** branch `feat/location-and-maps`. Commit messages are one line, at most 10 words, plain everyday words, with no body and no attribution trailer of any kind.
- **No GitHub CI:** the workflow is disabled. Before the PR, run the full local check set (Task 13).
- **One geofence rule:** the phone preview uses `evaluateGeofence` from `@ve/shared`, and nothing re-implements distance or accuracy rules.
- **Maps:**
  - Leaflet + OSM tiles only, with the "© OpenStreetMap contributors" credit always visible.
  - No Google API key, no Google tiles, no Places API.
  - Tile URLs stay config values (`VITE_TILE_URL`, `BuildConfig.TILE_URL`).
- **Site-pin accuracy gate:** `accuracyM <= settings.maxAccuracyM`.
- **Server decides check-ins:** the CHECK IN / CHECK OUT button is never disabled by the preview.
- **Security:**
  - `resolve-link` only fetches `https:` URLs on the allowlist, re-checks every redirect hop, follows at most 5 hops, has a 5 s total timeout, and never reads a response body.
  - Names put into Leaflet `divIcon` HTML are HTML-escaped.
- **Test environments:** web tests run with `TZ=UTC` (the package script); app tests with `TZ=Asia/Kolkata` (the package script). Do not change either.
- **Pinned versions:** react-router stays 7.18.4 (React Native pins React 19.2.3). No dependency upgrades.
- **User-facing text:** exactly as written in this plan (it matches the spec).

## Review Focus

1. **A real Google Maps short link shared from the phone** (`maps.app.goo.gl/…`) must resolve through Google's live redirect chain to the exact pin. Covered by recorded-URL tests in Task 2 and a real link in the Task 13 browser check.
2. **A laptop browser whose Wi-Fi guess is off by kilometres** must never move a site pin. The admin must see the accuracy and a next step. Task 4: `a poor reading does not move the pin and says why`.
3. **A worker standing at the circle's edge with GPS jitter:**
   - The preview must use exactly the server's rule; boundary values give the same answer as `evaluateGeofence`.
   - The button stays usable.
   - Task 12: `previewStatus` boundary tests and `CHECK IN still works when the preview says outside`.
4. **An employee name containing HTML** (`<img onerror=…>`) must render as text in the Today tags. Task 7: `escapeHtml` test and the tag-label test.
5. **The app going to the background with the preview open** must stop the location watch (battery), and it must restart on return. Task 12: `the watch stops in the background and restarts on return`.

## File Structure

**Shared** (`packages/shared/src/`)
- `coordinates.ts` (new): `parseCoordinates`.
- `errors.ts`: add 3 codes.
- `schemas.ts`: `placeLinkSchema`.
- `types.ts`: `PlaceLinkDto`, `DashboardMapDay`, and `DashboardTodayDto.mapDays`.
- `index.ts`: export `coordinates`.

**API** (`apps/api/`)
- `src/app.ts`: injectable `fetch` dependency.
- `src/modules/places/googleLink.ts` (new): allowlist, pin parsing, redirect following.
- `src/modules/places/routes.ts` (new): `POST /places/resolve-link`.
- `src/modules/admin.ts`: register the places routes.
- `src/modules/dashboard/service.ts`: `mapDays`.
- `tests/helpers/app.ts`: `fetch` option.
- `tests/places.test.ts` (new).
- `tests/dashboard.test.ts`.

**Web** (`apps/web/src/`)
- `lib/locate.ts` (new): the accuracy-gated `watchPosition` helper.
- `pages/sites/SiteMapPicker.tsx`: nullable centre, accuracy ring, overview bounds.
- `pages/sites/SiteEditPage.tsx`: the gate, no placeholder, paste box, tall map.
- `pages/sites/SitesMap.tsx` (new) and `pages/sites/SitesPage.tsx`: map + list.
- `pages/today/workingMap.ts` (new): pure tag and grouping helpers.
- `pages/today/WorkingMap.tsx` (new): the Leaflet Today map.
- `pages/DashboardPage.tsx`: map, toggle, drawer.
- `pages/attendance/AttendanceDrawer.tsx` and `DayMap.tsx`: "Set by an admin".
- `api/endpoints.ts`: `resolvePlaceLink`.
- `layout/AppLayout.tsx` and `App.tsx`: lazy pages.
- `styles.css`: split layout, tags.
- `testing/fakes.ts`: `mapDays`.
- `apps/web/public/favicon.svg` (new) and `apps/web/index.html`.
- `apps/web/vite.config.ts`: chunk groups.

**App** (`apps/mobile/`)
- `specs/NativeVeDevice.ts`: watch methods and event.
- `android/.../device/Locator.kt` and `VeDeviceModule.kt`: the watch.
- `src/testing/fakeNative.ts`: watch fake plus `emitFakeLocation`.
- `src/native/liveLocation.ts` (new): `watchLocation` and `useLiveFix`.
- `src/native/useScreenActive.ts` (new).
- `src/maps/LeafletMap.tsx` and `android/app/src/main/assets/map/bridge.js`: nullable centre, tap to place, "me" dot, overview.
- `src/api/endpoints.ts`: `getSettings`, `resolvePlaceLink`.
- `src/attendance/queryKeys.ts`: `settings` key.
- `src/screens/admin/adminErrors.ts` and `SiteEditScreen.tsx`: the gate, no placeholder, paste.
- `src/attendance/preview.ts` (new): `previewStatus`.
- `src/screens/worker/LocationPreview.tsx` (new) and `HomeScreen.tsx`.
- `src/i18n/en.json`.
- Test fixtures typed `DashboardTodayDto` in `src/App.test.tsx` and `src/screens/admin/TodayScreen.test.tsx`.

---
### Task 1: Shared coordinate parsing, place-link schema, and error codes

**Files:**
- Create: `packages/shared/src/coordinates.ts`
- Test: `packages/shared/src/coordinates.test.ts`
- Modify:
  - `packages/shared/src/index.ts`
  - `packages/shared/src/errors.ts`
  - `packages/shared/src/schemas.ts`
  - `packages/shared/src/types.ts`

**Interfaces:**
- Consumes: `LatLng` from `packages/shared/src/geo.ts`.
- Produces:
  - `parseCoordinates(text: string): LatLng | null`
  - `placeLinkSchema` (a `z.strictObject({ text })`)
  - `interface PlaceLinkDto { lat: number; lng: number }`
  - `ErrorCode.NOT_A_MAPS_LINK`, `ErrorCode.NO_EXACT_PIN` and `ErrorCode.LINK_UNREACHABLE`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/coordinates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCoordinates } from './coordinates';

describe('parseCoordinates', () => {
  it('reads decimal pairs the way Google Maps copies them', () => {
    expect(parseCoordinates('17.416682, 78.366365')).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(parseCoordinates('17.416682,78.366365')).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(parseCoordinates('  17.416682 78.366365 ')).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(parseCoordinates('-33.8688, 151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it('reads degrees, minutes and seconds with hemispheres', () => {
    const north = parseCoordinates(`17°25'00.1"N 78°21'58.9"E`);
    expect(north?.lat).toBeCloseTo(17.416694, 5);
    expect(north?.lng).toBeCloseTo(78.366361, 5);
    const south = parseCoordinates(`33°52'07.7"S 151°12'33.5"W`);
    expect(south?.lat).toBeCloseTo(-33.868806, 5);
    expect(south?.lng).toBeCloseTo(-151.209306, 5);
  });

  it('refuses junk, out-of-range values and 0,0', () => {
    expect(parseCoordinates('Hinjewadi Phase 1')).toBeNull();
    expect(parseCoordinates('91, 10')).toBeNull();
    expect(parseCoordinates('10, 181')).toBeNull();
    expect(parseCoordinates('0, 0')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates(`17°25'00.1"N`)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @ve/shared test`
Expected: FAIL. `coordinates.test.ts` cannot resolve `./coordinates`.

- [ ] **Step 3: Implement**

`packages/shared/src/coordinates.ts`:

```ts
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
```

In `packages/shared/src/index.ts`, add after `export * from './geo';`:

```ts
export * from './coordinates';
```

In `packages/shared/src/errors.ts`, add inside `ErrorCode` after `INVALID_STATE: 'INVALID_STATE',`:

```ts
  NOT_A_MAPS_LINK: 'NOT_A_MAPS_LINK',
  NO_EXACT_PIN: 'NO_EXACT_PIN',
  LINK_UNREACHABLE: 'LINK_UNREACHABLE',
```

In `packages/shared/src/schemas.ts`, append:

```ts
export const placeLinkSchema = z.strictObject({
  text: z.string().trim().min(1).max(2000),
});
```

In `packages/shared/src/types.ts`, append:

```ts
/** A site pin read from a Google Maps link or pasted coordinates. */
export interface PlaceLinkDto {
  lat: number;
  lng: number;
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter @ve/shared test && pnpm --filter @ve/shared typecheck`
Expected: PASS (the earlier 43 tests plus 3 new ones); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "read coordinates copied from google maps"
```

---

### Task 2: API endpoint to resolve a Google Maps link

**Files:**
- Create:
  - `apps/api/src/modules/places/googleLink.ts`
  - `apps/api/src/modules/places/routes.ts`
- Modify:
  - `apps/api/src/app.ts` (the `AppDeps`/`ResolvedDeps` `fetch` field)
  - `apps/api/src/modules/admin.ts`
  - `apps/api/tests/helpers/app.ts`
- Test: `apps/api/tests/places.test.ts`

**Interfaces:**
- Consumes (from Task 1): `parseCoordinates`, `placeLinkSchema`, `PlaceLinkDto` and the three error codes.
- Produces:
  - `POST /admin/places/resolve-link`
    - body `{ text }`
    - `200 { lat, lng }`
    - `422 { code: 'NOT_A_MAPS_LINK' | 'NO_EXACT_PIN' | 'LINK_UNREACHABLE', message }`
  - `createTestApp({ fetch })` in the API test helpers.

The spec's rules (§5.2), made concrete:
- **Pin sources:**
  - `!3d…!4d…` (the place pin)
  - `q=` or `query=` coordinates
  - `/search/<coords>` or `/place/<coords>`
- **Refused:** `@lat,lng` on its own is the viewport, so it returns `NO_EXACT_PIN`. `ll=` is also a viewport centre in old links, so it is not a pin source (spec updated).
- **Network:** only `maps.app.goo.gl` and `goo.gl/maps` short links are fetched.
- **Rate limit:** per IP, because the limit runs before authentication (spec updated).

- [ ] **Step 1: Write the failing test**

`apps/api/tests/places.test.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAllowedMapsUrl, pinFromMapsUrl } from '../src/modules/places/googleLink';
import { createTestApp } from './helpers/app';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee } from './helpers/factories';

// Recorded from Google Maps (web and Android share sheet), September 2026.
const PLACE_URL =
  'https://www.google.com/maps/place/Charminar/@17.3615687,78.4721083,17z/data=!3m1!4b1!4m6!3m5!1s0x3bcb978c3bb5f0e5:0x7a34a2b6f0b0b5c!8m2!3d17.3615636!4d78.4746832!16zL20vMDFrNmY0?entry=ttu';
const DROPPED_PIN_URL = 'https://www.google.com/maps/search/17.416682,+78.366365?entry=tts';
const QUERY_URL = 'https://maps.google.com/?q=17.416682,78.366365';
const VIEWPORT_URL = 'https://www.google.com/maps/@17.4167,78.3664,15z';
const SHORT_URL = 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9';

let app: FastifyInstance;
afterEach(async () => app?.close());

function redirectTo(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

async function setup(fetchImpl: typeof fetch = vi.fn<typeof fetch>()) {
  ({ app } = await createTestApp({ fetch: fetchImpl }));
  const token = await adminToken(app, await makeAdmin());
  const resolve = (text: string) =>
    app.inject({ method: 'POST', url: '/admin/places/resolve-link', headers: bearer(token), payload: { text } });
  return { resolve, fetchImpl };
}

describe('pinFromMapsUrl', () => {
  it('reads the exact pin from each Google Maps link shape', () => {
    expect(pinFromMapsUrl(new URL(PLACE_URL))).toEqual({ lat: 17.3615636, lng: 78.4746832 });
    expect(pinFromMapsUrl(new URL(DROPPED_PIN_URL))).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(pinFromMapsUrl(new URL(QUERY_URL))).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(pinFromMapsUrl(new URL('https://www.google.com/maps?ll=17.41,78.36'))).toBeNull();
    expect(pinFromMapsUrl(new URL(VIEWPORT_URL))).toBeNull();
  });

  it('allows only https Google Maps hosts', () => {
    expect(isAllowedMapsUrl(new URL(SHORT_URL))).toBe(true);
    expect(isAllowedMapsUrl(new URL('https://goo.gl/maps/abc'))).toBe(true);
    expect(isAllowedMapsUrl(new URL('https://www.google.co.in/maps/place/x'))).toBe(true);
    expect(isAllowedMapsUrl(new URL('https://goo.gl/abc'))).toBe(false);
    expect(isAllowedMapsUrl(new URL('https://www.google.com/search?q=x'))).toBe(false);
    expect(isAllowedMapsUrl(new URL('http://maps.google.com/?q=1,2'))).toBe(false);
    expect(isAllowedMapsUrl(new URL('https://maps.google.com.evil.example/?q=1,2'))).toBe(false);
  });
});

describe('POST /admin/places/resolve-link', () => {
  it('returns plain coordinates without any network call', async () => {
    const { resolve, fetchImpl } = await setup();
    const res = await resolve('17.416682, 78.366365');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reads a full link without fetching it', async () => {
    const { resolve, fetchImpl } = await setup();
    const res = await resolve(`Charminar ${PLACE_URL}`);
    expect(res.json()).toEqual({ lat: 17.3615636, lng: 78.4746832 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('follows a short link through its redirects to the pin', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectTo('https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9?g_st=ac'))
      .mockResolvedValueOnce(redirectTo(PLACE_URL));
    const { resolve } = await setup(fetchImpl);
    const res = await resolve(SHORT_URL);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ lat: 17.3615636, lng: 78.4746832 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
  });

  it('follows the consent page to the real link', async () => {
    const consent = `https://consent.google.com/ml?continue=${encodeURIComponent(DROPPED_PIN_URL)}&gl=IN`;
    const { resolve } = await setup(vi.fn<typeof fetch>().mockResolvedValueOnce(redirectTo(consent)));
    expect((await resolve(SHORT_URL)).json()).toEqual({ lat: 17.416682, lng: 78.366365 });
  });

  it('refuses a link that only shows an area', async () => {
    const { resolve } = await setup();
    const res = await resolve(VIEWPORT_URL);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      code: 'NO_EXACT_PIN',
      message: 'This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.',
    });
  });

  it('refuses other sites, and a short link that redirects elsewhere', async () => {
    const { resolve, fetchImpl } = await setup(vi.fn<typeof fetch>().mockResolvedValue(redirectTo('https://evil.example/maps')));
    const other = await resolve('https://evil.example/maps/@17,78');
    expect(other.json()).toEqual({ code: 'NOT_A_MAPS_LINK', message: "That doesn't look like a Google Maps link or coordinates." });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await resolve(SHORT_URL)).json().code).toBe('NOT_A_MAPS_LINK');
  });

  it('gives up after 5 hops, on network errors and on a non-redirect answer', async () => {
    const loop = vi.fn<typeof fetch>().mockResolvedValue(redirectTo(SHORT_URL));
    const first = await setup(loop);
    expect((await first.resolve(SHORT_URL)).json().code).toBe('LINK_UNREACHABLE');
    expect(loop).toHaveBeenCalledTimes(5);
    await app.close();

    const down = await setup(vi.fn<typeof fetch>().mockRejectedValue(new DOMException('timed out', 'TimeoutError')));
    expect((await down.resolve(SHORT_URL)).json()).toEqual({
      code: 'LINK_UNREACHABLE',
      message: "Couldn't open that link. Check it, or copy the coordinates instead.",
    });
    await app.close();

    const page = await setup(vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 })));
    expect((await page.resolve(SHORT_URL)).json().code).toBe('LINK_UNREACHABLE');
  });

  it('rejects junk text and is for admins only', async () => {
    const { resolve } = await setup();
    expect((await resolve('near the big tree')).json().code).toBe('NOT_A_MAPS_LINK');
    const employee = await makeEmployee();
    const res = await app.inject({
      method: 'POST',
      url: '/admin/places/resolve-link',
      headers: bearer(await employeeToken(app, employee)),
      payload: { text: '17.4, 78.3' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('limits each IP to 30 lookups a minute', async () => {
    const { resolve } = await setup();
    for (let i = 0; i < 30; i++) expect((await resolve('17.4, 78.3')).statusCode).toBe(200);
    const res = await resolve('17.4, 78.3');
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe('RATE_LIMITED');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @ve/api test -- tests/places.test.ts`
Expected: FAIL. `../src/modules/places/googleLink` cannot be resolved.

- [ ] **Step 3: Make `fetch` injectable**

In `apps/api/src/app.ts`, change the two interfaces and the resolved value:

```ts
export interface AppDeps {
  config: Config;
  db: Db;
  clock?: Clock;
  /** Outbound HTTP; tests pass a stub. */
  fetch?: typeof fetch;
}

export interface ResolvedDeps {
  config: Config;
  db: Db;
  clock: Clock;
  fetch: typeof fetch;
}
```

```ts
  const resolved: ResolvedDeps = { ...deps, clock: deps.clock ?? systemClock, fetch: deps.fetch ?? globalThis.fetch.bind(globalThis) };
```

In `apps/api/tests/helpers/app.ts`, replace `createTestApp`:

```ts
export async function createTestApp(
  opts: { clock?: FakeClock; fetch?: typeof fetch; beforeReady?: (app: FastifyInstance) => void } = {},
): Promise<{ app: FastifyInstance; clock: FakeClock }> {
  const clock = opts.clock ?? new FakeClock();
  const app = await buildApp({ config: testConfig, db: testDb.db, clock: clock.fn, fetch: opts.fetch });
  opts.beforeReady?.(app);
  await app.ready();
  return { app, clock };
}
```

- [ ] **Step 4: Implement the link reader**

`apps/api/src/modules/places/googleLink.ts`:

```ts
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
```

`apps/api/src/modules/places/routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { placeLinkSchema, type PlaceLinkDto } from '@ve/shared';
import { AppError } from '../../lib/errors';
import { resolveMapsText, type LinkFailure } from './googleLink';

const MESSAGES: Record<LinkFailure, string> = {
  NOT_A_MAPS_LINK: "That doesn't look like a Google Maps link or coordinates.",
  NO_EXACT_PIN: 'This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.',
  LINK_UNREACHABLE: "Couldn't open that link. Check it, or copy the coordinates instead.",
};

const lookupRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

export async function placesRoutes(app: FastifyInstance) {
  app.post('/places/resolve-link', lookupRateLimit, async (req): Promise<PlaceLinkDto> => {
    const { text } = placeLinkSchema.parse(req.body);
    const outcome = await resolveMapsText(text, app.deps.fetch);
    // Never log the link itself: it can carry the admin's search text.
    req.log.info({ host: outcome.host, result: outcome.ok ? 'OK' : outcome.code }, 'place link');
    if (!outcome.ok) throw new AppError(outcome.code, 422, MESSAGES[outcome.code]);
    return outcome.point;
  });
}
```

In `apps/api/src/modules/admin.ts`, import `import { placesRoutes } from './places/routes';` and add `await app.register(placesRoutes);` after `await app.register(dashboardRoutes);`.

- [ ] **Step 5: Run the tests and checks**

Run: `pnpm --filter @ve/api test -- tests/places.test.ts`
Expected: PASS (10 tests).

Run: `pnpm --filter @ve/api test && pnpm --filter @ve/api typecheck && pnpm lint`
Expected: all API tests pass (122 + 10); typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "add server lookup for google maps links"
```

---

### Task 3: Check-in positions in the Today data

**Files:**
- Modify:
  - `packages/shared/src/types.ts`
  - `apps/api/src/modules/dashboard/service.ts`
  - `apps/web/src/testing/fakes.ts`
  - `apps/mobile/src/App.test.tsx`
  - `apps/mobile/src/screens/admin/TodayScreen.test.tsx`
- Test: `apps/api/tests/dashboard.test.ts`

**Interfaces:**
- Produces:
  - `interface DashboardMapDay`
  - `DashboardTodayDto.mapDays: DashboardMapDay[]`: today's `CHECKED_IN` and `COMPLETED` days in company time, ordered by check-in time.

- [ ] **Step 1: Write the failing test**

In `apps/api/tests/dashboard.test.ts`, in the existing test:
- Replace the whole `expect(res.json()).toEqual({ … })` block with the block below.
- Change the `b` day insert so it has a check-out time: `checkOutAt: new Date('2026-09-25T12:10:00Z')`.

```ts
    const body = res.json();
    expect(body).toMatchObject({
      workDate: '2026-09-25',
      activeEmployees: 4,
      checkedInToday: 2,
      workingNow: 1,
      completedToday: 1,
      notYetIn: 2,
      missedCheckouts: 1,
      needsReview: 2,
      working: [{ employeeId: a.user.id, name: 'Anil', siteName: 'Plot 7', checkInAt: '2026-09-25T03:35:00.000Z' }],
    });
    // Ordered by check-in time; yesterday's missed day is not on today's map.
    expect(body.mapDays).toEqual([
      {
        dayId: expect.any(String),
        employeeId: b.user.id,
        name: 'Bina',
        siteId: site.id,
        siteName: 'Plot 7',
        status: 'COMPLETED',
        checkInAt: '2026-09-25T03:30:00.000Z',
        checkOutAt: '2026-09-25T12:10:00.000Z',
        checkInLat: 18.5204,
        checkInLng: 73.8567,
        needsReview: true,
      },
      {
        dayId: expect.any(String),
        employeeId: a.user.id,
        name: 'Anil',
        siteId: site.id,
        siteName: 'Plot 7',
        status: 'CHECKED_IN',
        checkInAt: '2026-09-25T03:35:00.000Z',
        checkOutAt: null,
        checkInLat: 18.5204,
        checkInLng: 73.8567,
        needsReview: false,
      },
    ]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @ve/api test -- tests/dashboard.test.ts`
Expected: FAIL. `body.mapDays` is `undefined`.

- [ ] **Step 3: Implement**

In `packages/shared/src/types.ts`, add above `DashboardTodayDto`, and add the new field at the end of `DashboardTodayDto`:

```ts
/** One of today's days, placed at its check-in position on the Today map. */
export interface DashboardMapDay {
  dayId: string;
  employeeId: string;
  name: string;
  siteId: string;
  siteName: string;
  status: 'CHECKED_IN' | 'COMPLETED';
  checkInAt: string;
  checkOutAt: string | null;
  checkInLat: number;
  checkInLng: number;
  needsReview: boolean;
}
```

```ts
  mapDays: DashboardMapDay[];
```

In `apps/api/src/modules/dashboard/service.ts`:
- Import `inArray` from `drizzle-orm`.
- Add a sixth query to the `Promise.all` array. Name the result `mapRows` in the destructuring: `[activeRows, statusRows, missedRows, reviewRows, working, mapRows]`.

```ts
    db
      .select({
        dayId: attendanceDays.id,
        employeeId: users.id,
        name: users.name,
        siteId: sites.id,
        siteName: sites.name,
        status: attendanceDays.status,
        checkInAt: attendanceDays.checkInAt,
        checkOutAt: attendanceDays.checkOutAt,
        checkInLat: attendanceDays.checkInLat,
        checkInLng: attendanceDays.checkInLng,
        needsReview: attendanceDays.needsReview,
      })
      .from(attendanceDays)
      .innerJoin(users, eq(users.id, attendanceDays.employeeId))
      .innerJoin(sites, eq(sites.id, attendanceDays.siteId))
      .where(and(eq(attendanceDays.workDate, workDate), inArray(attendanceDays.status, ['CHECKED_IN', 'COMPLETED'])))
      .orderBy(asc(attendanceDays.checkInAt)),
```

and add to the returned object:

```ts
    mapDays: mapRows.map((d) => ({
      ...d,
      status: d.status as 'CHECKED_IN' | 'COMPLETED',
      checkInAt: d.checkInAt.toISOString(),
      checkOutAt: d.checkOutAt ? d.checkOutAt.toISOString() : null,
    })),
```

**Fixtures typed `DashboardTodayDto`:**
- In `apps/web/src/testing/fakes.ts`, inside `dashboardToday` after `working: […],`:

```ts
    mapDays: [
      {
        dayId: 'd1',
        employeeId: 'e1',
        name: 'Ravi Kumar',
        siteId: 's1',
        siteName: 'Plot 7',
        status: 'CHECKED_IN',
        checkInAt: '2026-09-25T03:35:00.000Z',
        checkOutAt: null,
        checkInLat: 18.5913,
        checkInLng: 73.739,
        needsReview: false,
      },
      {
        dayId: 'd2',
        employeeId: 'e2',
        name: 'Sunita Rao',
        siteId: 's1',
        siteName: 'Plot 7',
        status: 'COMPLETED',
        checkInAt: '2026-09-25T02:30:00.000Z',
        checkOutAt: '2026-09-25T11:00:00.000Z',
        checkInLat: 18.5911,
        checkInLng: 73.7388,
        needsReview: false,
      },
    ],
```

- In `apps/mobile/src/App.test.tsx` (the `'/admin/dashboard/today'` literal): add `mapDays: []` after `working: []`.
- In `apps/mobile/src/screens/admin/TodayScreen.test.tsx` (the `dashboard` constant): add `mapDays: [],` after `working: […],`.

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter @ve/api test -- tests/dashboard.test.ts`
Expected: PASS.

Run: `pnpm typecheck && pnpm --filter @ve/web test && pnpm --filter @ve/mobile test && pnpm lint`
Expected: typecheck clean in every workspace; web 85 and mobile 169 tests pass; lint clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src apps/api apps/web/src/testing/fakes.ts apps/mobile/src/App.test.tsx apps/mobile/src/screens/admin/TodayScreen.test.tsx
git commit -m "send check-in positions with today's dashboard data"
```

---
### Task 4: Web site editor: accuracy-gated "Use my location", no placeholder pin, tall map

**Files:**
- Create: `apps/web/src/lib/locate.ts`
- Test: `apps/web/src/lib/locate.test.ts`
- Modify (full replacement):
  - `apps/web/src/pages/sites/SiteMapPicker.tsx`
  - `apps/web/src/pages/sites/SiteEditPage.tsx`
- Test (modify): `apps/web/src/pages/sites/SiteEditPage.test.tsx`

**Interfaces:**
- Consumes: `SettingsDto.maxAccuracyM` (via `useCompanySettings`) and `api.listSites`.
- Produces:
  - `interface Reading { lat; lng; accuracyM }`
  - `type LocateResult = { kind: 'ok' | 'imprecise'; reading } | { kind: 'denied' | 'unavailable' }`
  - `locateBest(geo, maxAccuracyM, onProgress?, timeoutMs = 20_000): Promise<LocateResult>`
  - `SiteMapPicker` props:
    - `center: LatLng | null`
    - `accuracy?: Reading | null`
    - `overview?: LatLng[]`
    - `height?: number | string`
  - `INDIA_BOUNDS` (exported from `SiteMapPicker.tsx`; reused by Tasks 6–7)

Spec §4.2 detail made concrete: the dashed accuracy ring stays until the pin moves.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/locate.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest';
import { locateBest } from './locate';

afterEach(() => {
  vi.useRealTimers();
});

const position = (latitude: number, longitude: number, accuracy: number) =>
  ({ coords: { latitude, longitude, accuracy } }) as GeolocationPosition;

/** A fake Geolocation whose watch callbacks the test fires by hand. */
function fakeGeo() {
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback | null | undefined;
  const geo = {
    watchPosition: vi.fn((s: PositionCallback, f?: PositionErrorCallback | null) => {
      success = s;
      failure = f;
      return 7;
    }),
    clearWatch: vi.fn(),
  };
  return {
    geo: geo as unknown as Geolocation,
    clearWatch: geo.clearWatch,
    send: (lat: number, lng: number, accuracy: number) => success(position(lat, lng, accuracy)),
    fail: (code: number) => failure?.({ code } as GeolocationPositionError),
  };
}

test('a reading within the allowed accuracy ends the search at once', async () => {
  const g = fakeGeo();
  const result = locateBest(g.geo, 50);
  g.send(17.4166, 78.3663, 12);
  await expect(result).resolves.toEqual({ kind: 'ok', reading: { lat: 17.4166, lng: 78.3663, accuracyM: 12 } });
  expect(g.clearWatch).toHaveBeenCalledWith(7);
});

test('keeps listening while readings improve, and reports progress', async () => {
  const g = fakeGeo();
  const progress: number[] = [];
  const result = locateBest(g.geo, 50, (m) => progress.push(m));
  g.send(17.5, 78.5, 900);
  g.send(17.4166, 78.3663, 30);
  await expect(result).resolves.toEqual({ kind: 'ok', reading: { lat: 17.4166, lng: 78.3663, accuracyM: 30 } });
  expect(progress).toEqual([900, 30]);
});

test('a laptop-style guess is reported as imprecise after 20 seconds', async () => {
  vi.useFakeTimers();
  const g = fakeGeo();
  const result = locateBest(g.geo, 50);
  g.send(17.5, 78.5, 1400);
  g.send(17.49, 78.49, 900);
  await vi.advanceTimersByTimeAsync(20_000);
  await expect(result).resolves.toEqual({ kind: 'imprecise', reading: { lat: 17.49, lng: 78.49, accuracyM: 900 } });
  expect(g.clearWatch).toHaveBeenCalled();
});

test('refused permission and silence are told apart', async () => {
  const denied = fakeGeo();
  const r1 = locateBest(denied.geo, 50);
  denied.fail(1);
  await expect(r1).resolves.toEqual({ kind: 'denied' });

  vi.useFakeTimers();
  const silent = fakeGeo();
  const r2 = locateBest(silent.geo, 50);
  silent.fail(2);
  await vi.advanceTimersByTimeAsync(20_000);
  await expect(r2).resolves.toEqual({ kind: 'unavailable' });
});
```

Replace `apps/web/src/pages/sites/SiteEditPage.test.tsx` with:

```tsx
import { screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Api } from '../../api/endpoints';
import { site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import type { PlaceSearch } from './placeSearch';
import { SiteEditPage } from './SiteEditPage';

// Leaflet needs a real browser; the page only relies on the props it passes and onMove.
vi.mock('./SiteMapPicker', () => ({
  SiteMapPicker: (props: {
    center: { lat: number; lng: number } | null;
    radiusM: number;
    accuracy?: { accuracyM: number } | null;
    onMove: (p: { lat: number; lng: number }) => void;
  }) => (
    <div>
      <output data-testid="map-state">{props.center ? `${props.center.lat},${props.center.lng},${props.radiusM}` : 'none'}</output>
      <output data-testid="map-accuracy">{props.accuracy ? String(props.accuracy.accuracyM) : 'none'}</output>
      <button type="button" onClick={() => props.onMove({ lat: 18.6, lng: 73.7 })}>
        fake map drag
      </button>
    </div>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'geolocation');
});

function renderNew(api: Partial<Api> = {}, searchPlaces?: PlaceSearch) {
  const createSite = vi.fn(async () => site({ id: 's9' }));
  const utils = renderWithProviders(<SiteEditPage />, {
    route: '/sites/new',
    path: '/sites/new',
    api: { createSite, listSites: vi.fn(async () => []), ...api },
    services: searchPlaces ? { searchPlaces } : {},
  });
  return { ...utils, createSite };
}

const position = (latitude: number, longitude: number, accuracy: number) =>
  ({ coords: { latitude, longitude, accuracy } }) as GeolocationPosition;

/** `watch` receives the page's callbacks when it starts watching. */
function mockGeolocation(watch: (success: PositionCallback, failure?: PositionErrorCallback | null) => void) {
  const clearWatch = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (s: PositionCallback, f?: PositionErrorCallback | null) => {
        watch(s, f);
        return 1;
      },
      clearWatch,
    },
  });
  return clearWatch;
}

test('new site: no pin until one is placed, then saves the dragged pin', async () => {
  const { user, createSite } = renderNew();
  expect(screen.getByRole('heading', { name: 'New site' })).toBeInTheDocument();
  expect(screen.getByTestId('map-state')).toHaveTextContent('none');
  expect(screen.getByText('Set the location: search, paste from Google Maps, use my location, or tap the map.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
  await user.type(screen.getByLabelText('Site name'), ' Plot 9 ');
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.6,73.7,100');
  const radius = screen.getByLabelText('Allowed distance (metres)');
  await user.clear(radius);
  await user.type(radius, '150');
  await user.click(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() => expect(createSite).toHaveBeenCalledWith({ name: 'Plot 9', address: undefined, lat: 18.6, lng: 73.7, radiusM: 150 }));
  expect(await screen.findByText('Site saved')).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/sites$/);
});

test('place search moves the pin to the chosen result', async () => {
  const searchPlaces = vi.fn<PlaceSearch>(async () => [{ name: 'Hinjewadi Phase 1, Pune, Maharashtra', lat: 18.5912, lng: 73.7389 }]);
  const { user } = renderNew({}, searchPlaces);
  await user.type(screen.getByLabelText('Search for a place'), 'Hinjewadi');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(searchPlaces).toHaveBeenCalledWith('Hinjewadi');
  expect(screen.getByText('Search by Nominatim · © OpenStreetMap contributors')).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: 'Hinjewadi Phase 1, Pune, Maharashtra' }));
  expect(screen.getByLabelText('Latitude')).toHaveValue('18.5912');
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.5912,73.7389,100');
});

test('edit: loads the site and saves it as not in use', async () => {
  const updateSite = vi.fn(async () => site({ isActive: false }));
  const { user } = renderWithProviders(<SiteEditPage />, {
    route: '/sites/s1',
    path: '/sites/:id',
    api: { getSite: vi.fn(async () => site()), updateSite },
  });
  expect(await screen.findByRole('heading', { name: 'Edit site' })).toBeInTheDocument();
  expect(screen.getByLabelText('Site name')).toHaveValue('Plot 7');
  expect(screen.getByTestId('map-state')).toHaveTextContent('18.5912,73.7389,100');
  await user.click(screen.getByLabelText('Site is in use'));
  await user.click(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(updateSite).toHaveBeenCalledWith('s1', {
      name: 'Plot 7',
      address: 'Hinjewadi Phase 1',
      lat: 18.5912,
      lng: 73.7389,
      radiusM: 100,
      isActive: false,
    }),
  );
});

test('a missing name and too large a distance are caught before sending', async () => {
  const { user, createSite } = renderNew();
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  const radius = screen.getByLabelText('Allowed distance (metres)');
  await user.clear(radius);
  await user.type(radius, '1500');
  await user.click(screen.getByRole('button', { name: 'Save site' }));
  expect(screen.getByText('Enter the site name')).toBeInTheDocument();
  expect(screen.getByText('At most 1000 m')).toBeInTheDocument();
  expect(createSite).not.toHaveBeenCalled();
});

test('use my location: a precise reading moves the pin and shows its accuracy', async () => {
  const clearWatch = mockGeolocation((success) => success(position(18.7, 73.9, 12)));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Your location · accurate to ±12 m')).toBeInTheDocument();
  expect(screen.getByLabelText('Latitude')).toHaveValue('18.7');
  expect(screen.getByLabelText('Longitude')).toHaveValue('73.9');
  expect(screen.getByTestId('map-accuracy')).toHaveTextContent('12');
  expect(clearWatch).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'fake map drag' }));
  expect(screen.getByTestId('map-accuracy')).toHaveTextContent('none');
});

test('a poor reading does not move the pin and says why', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockGeolocation((success) => success(position(18.7, 73.9, 900)));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  await vi.advanceTimersByTimeAsync(20_000);
  expect(
    await screen.findByText(
      'Your location is only accurate to ±900 m, more than the ±50 m allowed. Laptops usually cannot tell their exact position. Search, paste from Google Maps, or drag the pin.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByTestId('map-state')).toHaveTextContent('none');
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
});

test('refused location permission explains what to do', async () => {
  mockGeolocation((_success, failure) => failure?.({ code: 1 } as GeolocationPositionError));
  const { user } = renderNew();
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Location permission was refused. Allow it in the browser, or drag the pin.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/web test -- src/lib/locate src/pages/sites/SiteEditPage`
Expected: FAIL.
- `locate.test.ts` cannot resolve `./locate`.
- In the page tests, `map-state` shows `18.5204,73.8567,100` instead of `none`.
- `Your location · accurate to ±12 m` is not found.

- [ ] **Step 3: Implement the locator**

`apps/web/src/lib/locate.ts`:

```ts
export interface Reading {
  lat: number;
  lng: number;
  accuracyM: number;
}

export type LocateResult =
  | { kind: 'ok'; reading: Reading }
  | { kind: 'imprecise'; reading: Reading }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/**
 * Listens for up to `timeoutMs`, keeping the most accurate reading, and stops early once one is within `maxAccuracyM`.
 * A laptop without GPS usually ends as 'imprecise': the browser only has a Wi-Fi or IP guess.
 */
export function locateBest(
  geo: Geolocation,
  maxAccuracyM: number,
  onProgress: (accuracyM: number) => void = () => {},
  timeoutMs = 20_000,
): Promise<LocateResult> {
  return new Promise((resolve) => {
    let best: Reading | null = null;
    let done = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: LocateResult) => {
      if (done) return;
      done = true;
      if (timer !== null) clearTimeout(timer);
      if (watchId !== null) geo.clearWatch(watchId);
      resolve(result);
    };

    timer = setTimeout(() => finish(best ? { kind: 'imprecise', reading: best } : { kind: 'unavailable' }), timeoutMs);
    watchId = geo.watchPosition(
      (pos) => {
        const reading = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy };
        if (!best || reading.accuracyM < best.accuracyM) best = reading;
        onProgress(best.accuracyM);
        if (best.accuracyM <= maxAccuracyM) finish({ kind: 'ok', reading: best });
      },
      (err) => {
        // 1 = PERMISSION_DENIED. Other errors (no signal yet, timeout) wait for the deadline.
        if (err.code === 1) finish({ kind: 'denied' });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
    // The first callback can fire inside watchPosition, before watchId was assigned.
    if (done) geo.clearWatch(watchId);
  });
}
```

- [ ] **Step 4: Replace the map picker**

`apps/web/src/pages/sites/SiteMapPicker.tsx`:

```tsx
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { Reading } from '../../lib/locate';
import { OsmTiles } from '../../maps/OsmTiles';

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  /** null = no pin yet (a new site). */
  center: LatLng | null;
  radiusM: number;
  onMove: (position: LatLng) => void;
  /** Change it to fit the map around the circle again (after search, "use my location", loading). */
  recenterKey: number;
  /** The reading behind "Use my location", drawn as a dashed ring until the pin moves. */
  accuracy?: Reading | null;
  /** Existing sites: the starting view while there is no pin. */
  overview?: LatLng[];
  height?: number | string;
}

export const INDIA_BOUNDS = L.latLngBounds(L.latLng(6.5, 68), L.latLng(35.5, 97.5));

const pinIcon = L.divIcon({ className: '', html: '<div class="ve-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

function startBounds(center: LatLng | null, radiusM: number, overview: LatLng[]): L.LatLngBounds {
  if (center) return L.latLng(center.lat, center.lng).toBounds(radiusM * 2.4);
  if (overview.length > 0) return L.latLngBounds(overview.map((p) => L.latLng(p.lat, p.lng))).pad(0.3);
  return INDIA_BOUNDS;
}

function Recenter({ center, radiusM, recenterKey }: Pick<Props, 'center' | 'radiusM' | 'recenterKey'>) {
  const map = useMap();
  const latest = useRef({ center, radiusM });
  latest.current = { center, radiusM };
  useEffect(() => {
    const { center: c, radiusM: r } = latest.current;
    if (c) map.fitBounds(L.latLng(c.lat, c.lng).toBounds(r * 2.4), { maxZoom: 18 });
  }, [map, recenterKey]);
  return null;
}

/** Existing sites load after the map mounts; show them once they arrive, but only while there is no pin. */
function FitOverview({ overview, hasPin }: { overview: LatLng[]; hasPin: boolean }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || hasPin || overview.length === 0) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(overview.map((p) => L.latLng(p.lat, p.lng))).pad(0.3), { maxZoom: 13 });
  }, [map, overview, hasPin]);
  return null;
}

function ClickToMove({ onMove }: Pick<Props, 'onMove'>) {
  useMapEvents({ click: (event) => onMove({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

export function SiteMapPicker({ center, radiusM, onMove, recenterKey, accuracy = null, overview = [], height = 420 }: Props) {
  return (
    <MapContainer bounds={startBounds(center, radiusM, overview)} style={{ height, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      {center ? (
        <>
          <Circle center={[center.lat, center.lng]} radius={radiusM} pathOptions={{ color: '#B8480F', weight: 2.5, fillOpacity: 0.14 }} />
          <Marker
            position={[center.lat, center.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const p = (event.target as L.Marker).getLatLng();
                onMove({ lat: p.lat, lng: p.lng });
              },
            }}
          />
        </>
      ) : null}
      {accuracy ? (
        <Circle
          center={[accuracy.lat, accuracy.lng]}
          radius={accuracy.accuracyM}
          interactive={false}
          pathOptions={{ color: '#1F4E8C', weight: 1.5, dashArray: '4 4', fillOpacity: 0.06 }}
        />
      ) : null}
      <ClickToMove onMove={onMove} />
      <Recenter center={center} radiusM={radiusM} recenterKey={recenterKey} />
      <FitOverview overview={overview} hasPin={center !== null} />
    </MapContainer>
  );
}
```

- [ ] **Step 5: Replace the editor page**

`apps/web/src/pages/sites/SiteEditPage.tsx`:

```tsx
import { Alert, Anchor, Button, Group, NumberInput, Paper, SimpleGrid, Slider, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCurrentLocation, IconSearch } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SiteDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { PageError, PageLoader } from '../../components/PageState';
import { errorMessage } from '../../lib/errors';
import { locateBest, type Reading } from '../../lib/locate';
import { queryKeys } from '../../lib/queryKeys';
import { useCompanySettings } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import type { PlaceResult } from './placeSearch';
import { SiteMapPicker, type LatLng } from './SiteMapPicker';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the site name').max(120, 'Name is too long'),
  address: z.string().trim().max(300, 'Address is too long'),
  lat: z.number({ error: 'Enter the latitude' }).min(-90, 'Latitude is between -90 and 90').max(90, 'Latitude is between -90 and 90'),
  lng: z.number({ error: 'Enter the longitude' }).min(-180, 'Longitude is between -180 and 180').max(180, 'Longitude is between -180 and 180'),
  radiusM: z.number({ error: 'Enter the distance' }).int('Use whole metres').min(10, 'At least 10 m').max(1000, 'At most 1000 m'),
  isActive: z.boolean(),
});

// A type, not an interface: the zod form resolver needs values assignable to Record<string, unknown>.
type FormValues = {
  name: string;
  address: string;
  /** NumberInput gives '' while the box is empty; a new site starts empty (no pin). */
  lat: number | string;
  lng: number | string;
  radiusM: number | string;
  isActive: boolean;
};

/** The map fills the window below the page header, but never shrinks under 480 px. */
const MAP_HEIGHT = 'max(480px, calc(100vh - 330px))';

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const num = (v: number | string) => (typeof v === 'number' ? v : null);

export function SiteEditPage() {
  const { id } = useParams();
  const { api } = useServices();
  const settings = useCompanySettings();
  const siteQ = useQuery({ queryKey: queryKeys.site(id ?? 'new'), queryFn: () => api.getSite(id ?? ''), enabled: !!id });

  if (id && !siteQ.data) {
    return siteQ.isError ? <PageError error={siteQ.error} onRetry={() => void siteQ.refetch()} /> : <PageLoader />;
  }
  return (
    <SiteEditor
      key={id ?? 'new'}
      site={siteQ.data ?? null}
      defaultRadiusM={settings.data?.defaultRadiusM ?? 100}
      maxAccuracyM={settings.data?.maxAccuracyM ?? 50}
    />
  );
}

function SiteEditor({ site, defaultRadiusM, maxAccuracyM }: { site: SiteDto | null; defaultRadiusM: number; maxAccuracyM: number }) {
  const { api, searchPlaces } = useServices();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recenterKey, setRecenterKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [places, setPlaces] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [progressM, setProgressM] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<Reading | null>(null);
  const others = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites(), enabled: !site });

  const form = useForm<FormValues>({
    initialValues: site
      ? { name: site.name, address: site.address ?? '', lat: site.lat, lng: site.lng, radiusM: site.radiusM, isActive: site.isActive }
      : { name: '', address: '', lat: '', lng: '', radiusM: defaultRadiusM, isActive: true },
    validate: zod4Resolver(schema),
  });

  const lat = num(form.values.lat);
  const lng = num(form.values.lng);
  const center: LatLng | null = lat !== null && lng !== null ? { lat, lng } : null;
  const radiusM = Math.min(1000, Math.max(10, num(form.values.radiusM) ?? 10));

  function moveTo(p: LatLng, recenter: boolean) {
    form.setValues({ lat: round6(p.lat), lng: round6(p.lng) });
    setAccuracy(null);
    setNote(null);
    if (recenter) setRecenterKey((k) => k + 1);
  }

  async function findPlaces(event: FormEvent) {
    event.preventDefault();
    if (!placeQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setPlaces(await searchPlaces(placeQuery));
    } catch (err) {
      console.warn('place search failed', err);
      setPlaces(null);
      setError('Place search is not available right now. Drag the pin instead.');
    } finally {
      setSearching(false);
    }
  }

  async function locateMe() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share its location. Drag the pin instead.');
      return;
    }
    setLocating(true);
    setError(null);
    setNote(null);
    setProgressM(null);
    const result = await locateBest(navigator.geolocation, maxAccuracyM, setProgressM);
    setLocating(false);
    setProgressM(null);
    if (result.kind === 'ok') {
      moveTo(result.reading, true);
      setAccuracy(result.reading);
      setNote(`Your location · accurate to ±${Math.round(result.reading.accuracyM)} m`);
    } else if (result.kind === 'imprecise') {
      setError(
        `Your location is only accurate to ±${Math.round(result.reading.accuracyM)} m, more than the ±${maxAccuracyM} m allowed. ` +
          'Laptops usually cannot tell their exact position. Search, paste from Google Maps, or drag the pin.',
      );
    } else if (result.kind === 'denied') {
      setError('Location permission was refused. Allow it in the browser, or drag the pin.');
    } else {
      setError('Could not get your location. Drag the pin instead.');
    }
  }

  const save = useMutation({
    mutationFn: (v: z.output<typeof schema>) =>
      site
        ? api.updateSite(site.id, { name: v.name, address: v.address || null, lat: v.lat, lng: v.lng, radiusM: v.radiusM, isActive: v.isActive })
        : api.createSite({ name: v.name, address: v.address || undefined, lat: v.lat, lng: v.lng, radiusM: v.radiusM }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      notifications.show({ color: 'ledgerGreen', message: 'Site saved' });
      navigate('/sites');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/sites" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={16} /> Sites
        </Group>
      </Anchor>
      <Title order={1}>{site ? 'Edit site' : 'New site'}</Title>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Stack>
          <form onSubmit={(event) => void findPlaces(event)}>
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                label="Search for a place"
                placeholder="Area, landmark or address"
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button type="submit" variant="default" leftSection={<IconSearch size={16} />} loading={searching}>
                Search
              </Button>
            </Group>
          </form>
          {places !== null ? (
            <Paper withBorder p="xs" radius="md">
              <Stack gap={2}>
                {places.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No places found. Try a nearby landmark.
                  </Text>
                ) : (
                  places.map((p) => (
                    <Button
                      key={`${p.lat},${p.lng}`}
                      variant="subtle"
                      justify="flex-start"
                      h="auto"
                      py={6}
                      styles={{ label: { whiteSpace: 'normal', textAlign: 'left' } }}
                      onClick={() => {
                        moveTo(p, true);
                        setPlaces(null);
                      }}
                    >
                      {p.name}
                    </Button>
                  ))
                )}
                <Text size="xs" c="dimmed">
                  Search by Nominatim · © OpenStreetMap contributors
                </Text>
              </Stack>
            </Paper>
          ) : null}
          <Group>
            <Button variant="default" leftSection={<IconCurrentLocation size={16} />} loading={locating} onClick={() => void locateMe()}>
              Use my location
            </Button>
            {locating && progressM !== null ? (
              <Text size="sm" c="dimmed">
                {`Getting your location… ±${Math.round(progressM)} m`}
              </Text>
            ) : null}
          </Group>
          {note ? (
            <Text size="sm" c="ledgerGreen">
              {note}
            </Text>
          ) : null}
          <SiteMapPicker
            center={center}
            radiusM={radiusM}
            recenterKey={recenterKey}
            accuracy={accuracy}
            overview={(others.data ?? []).map((s) => ({ lat: s.lat, lng: s.lng }))}
            height={MAP_HEIGHT}
            onMove={(p) => moveTo(p, false)}
          />
          <Text size="sm" c="dimmed">
            {center
              ? 'Drag the pin, or click the map, to set the centre of the site.'
              : 'Set the location: search, paste from Google Maps, use my location, or tap the map.'}
          </Text>
        </Stack>

        <form noValidate onSubmit={form.onSubmit((values) => save.mutate(schema.parse(values)))}>
          <Stack>
            <TextInput label="Site name" {...form.getInputProps('name')} />
            <TextInput label="Address (optional)" {...form.getInputProps('address')} />
            <Group grow>
              <NumberInput label="Latitude" decimalScale={6} hideControls {...form.getInputProps('lat')} />
              <NumberInput label="Longitude" decimalScale={6} hideControls {...form.getInputProps('lng')} />
            </Group>
            <NumberInput
              label="Allowed distance (metres)"
              description="Workers must be this close to the pin to check in."
              min={10}
              max={1000}
              step={10}
              allowDecimal={false}
              clampBehavior="none"
              {...form.getInputProps('radiusM')}
            />
            <Slider
              min={10}
              max={1000}
              step={10}
              value={radiusM}
              onChange={(value) => form.setFieldValue('radiusM', value)}
              label={(value) => `${value} m`}
              thumbLabel="Allowed distance slider"
              marks={[{ value: 50 }, { value: 100 }, { value: 200 }, { value: 500 }]}
            />
            {site ? <Switch label="Site is in use" {...form.getInputProps('isActive', { type: 'checkbox' })} /> : null}
            {error ? <Alert color="ledgerOrange">{error}</Alert> : null}
            <Group justify="flex-end">
              <Button type="submit" loading={save.isPending} disabled={!center}>
                Save site
              </Button>
            </Group>
          </Stack>
        </form>
      </SimpleGrid>
    </Stack>
  );
}
```

- [ ] **Step 6: Run the tests and checks**

Run: `pnpm --filter @ve/web test -- src/lib/locate src/pages/sites/SiteEditPage`
Expected: PASS (locate 4, site editor 7).

Run: `pnpm --filter @ve/web test && pnpm --filter @ve/web typecheck && pnpm lint`
Expected: all web tests pass; typecheck and lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "check location accuracy before placing a site pin"
```

---

### Task 5: Web "Paste from Google Maps"

**Files:**
- Modify:
  - `apps/web/src/api/endpoints.ts`
  - `apps/web/src/pages/sites/SiteEditPage.tsx`
- Test: `apps/web/src/pages/sites/SiteEditPage.test.tsx` (append)

**Interfaces:**
- Consumes:
  - from Task 1: `parseCoordinates` and `PlaceLinkDto`
  - from Task 2: `POST /admin/places/resolve-link`
  - from Task 4: `moveTo` and the `note` state in `SiteEditor`
- Produces: `Api.resolvePlaceLink(text: string): Promise<PlaceLinkDto>`

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/pages/sites/SiteEditPage.test.tsx`. Also add `import { ApiError } from '../../api/errors';` to its imports.

```tsx
test('pasted coordinates move the pin without asking the server', async () => {
  const resolvePlaceLink = vi.fn();
  const { user } = renderNew({ resolvePlaceLink });
  await user.type(screen.getByLabelText('Paste from Google Maps'), '17.416682, 78.366365');
  await user.click(screen.getByRole('button', { name: 'Go' }));
  expect(screen.getByTestId('map-state')).toHaveTextContent('17.416682,78.366365,100');
  expect(screen.getByText('From Google Maps · check the circle before saving.')).toBeInTheDocument();
  expect(screen.getByLabelText('Paste from Google Maps')).toHaveValue('');
  expect(resolvePlaceLink).not.toHaveBeenCalled();
});

test('a pasted link is read by the server', async () => {
  const resolvePlaceLink = vi.fn(async () => ({ lat: 17.3615636, lng: 78.4746832 }));
  const { user } = renderNew({ resolvePlaceLink });
  await user.type(screen.getByLabelText('Paste from Google Maps'), 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  await user.click(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText('From Google Maps · check the circle before saving.')).toBeInTheDocument();
  expect(resolvePlaceLink).toHaveBeenCalledWith('https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  expect(screen.getByTestId('map-state')).toHaveTextContent('17.361564,78.474683,100');
});

test('a link without a pin says why and leaves the pin alone', async () => {
  const message = 'This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.';
  const resolvePlaceLink = vi.fn(async () => {
    throw new ApiError(422, 'NO_EXACT_PIN', message);
  });
  const { user } = renderNew({ resolvePlaceLink });
  await user.type(screen.getByLabelText('Paste from Google Maps'), 'https://www.google.com/maps/@17.4167,78.3664,15z');
  await user.click(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(screen.getByTestId('map-state')).toHaveTextContent('none');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/web test -- src/pages/sites/SiteEditPage`
Expected: FAIL. `Unable to find a label with the text of: Paste from Google Maps`.

- [ ] **Step 3: Implement**

In `apps/web/src/api/endpoints.ts`:
- Add `PlaceLinkDto` to the `@ve/shared` type import.
- Add to the returned object, after `updateSite`:

```ts
    resolvePlaceLink: (text: string) => send<PlaceLinkDto>('POST', '/admin/places/resolve-link', { text }),
```

In `apps/web/src/pages/sites/SiteEditPage.tsx`:
- Imports: add `IconLink` to the `@tabler/icons-react` import, and add `import { parseCoordinates } from '@ve/shared';`. Keep the existing `import type { SiteDto } from '@ve/shared';`.
- In `SiteEditor`, after the `accuracy` state, add:

```tsx
  const [linkText, setLinkText] = useState('');
  const [resolving, setResolving] = useState(false);
```

- After `locateMe`, add:

```tsx
  function placeFromGoogle(p: LatLng) {
    moveTo(p, true);
    setNote('From Google Maps · check the circle before saving.');
    setLinkText('');
  }

  async function pasteFromGoogle(event: FormEvent) {
    event.preventDefault();
    const text = linkText.trim();
    if (!text) return;
    setError(null);
    const local = parseCoordinates(text);
    if (local) return placeFromGoogle(local);
    setResolving(true);
    try {
      placeFromGoogle(await api.resolvePlaceLink(text));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResolving(false);
    }
  }
```

- In the JSX, directly after the place-results `Paper` block (`{places !== null ? (…) : null}`) and before the "Use my location" `Group`, add:

```tsx
          <form onSubmit={(event) => void pasteFromGoogle(event)}>
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                label="Paste from Google Maps"
                description="In Google Maps, tap Share → Copy link, or long-press the spot to copy its coordinates."
                placeholder="https://maps.app.goo.gl/… or 17.4167, 78.3664"
                value={linkText}
                onChange={(event) => setLinkText(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button type="submit" variant="default" leftSection={<IconLink size={16} />} loading={resolving}>
                Go
              </Button>
            </Group>
          </form>
```

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter @ve/web test -- src/pages/sites/SiteEditPage`
Expected: PASS (10 tests).

Run: `pnpm --filter @ve/web test && pnpm --filter @ve/web typecheck && pnpm lint`
Expected: pass and clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "paste a google maps link to place a site"
```

---

### Task 6: Web Sites tab: the map on the left, the list on the right

**Files:**
- Create: `apps/web/src/pages/sites/SitesMap.tsx`
- Modify (full replacement): `apps/web/src/pages/sites/SitesPage.tsx`
- Modify: `apps/web/src/styles.css`
- Test (full replacement): `apps/web/src/pages/sites/SitesPage.test.tsx`

**Interfaces:**
- Consumes: `api.listSites`, and `INDIA_BOUNDS` from Task 4.
- Produces: `SitesMap({ sites, selectedId, hoveredId, onSelect })`

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/pages/sites/SitesPage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { site } from '../../testing/fakes';
import { renderWithProviders } from '../../testing/render';
import { SitesPage } from './SitesPage';

// Leaflet needs a real browser; the page only relies on the props it passes and onSelect.
vi.mock('./SitesMap', () => ({
  SitesMap: (props: { sites: { id: string }[]; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void }) => (
    <div>
      <output data-testid="map-sites">{props.sites.map((s) => s.id).join(',')}</output>
      <output data-testid="map-selected">{props.selectedId ?? 'none'}</output>
      <output data-testid="map-hovered">{props.hoveredId ?? 'none'}</output>
      <button type="button" onClick={() => props.onSelect('s2')}>
        fake pin click
      </button>
    </div>
  ),
}));

const sites = [site(), site({ id: 's2', name: 'Old yard', address: null, radiusM: 250, isActive: false })];
const renderPage = () => renderWithProviders(<SitesPage />, { api: { listSites: vi.fn(async () => sites) } });

test('lists every site beside the map, with distance, status and links', async () => {
  renderPage();
  const link = await screen.findByRole('link', { name: 'Plot 7' });
  expect(link).toHaveAttribute('href', '/sites/s1');
  expect(within(screen.getByTestId('site-row-s1')).getByText('100 m')).toBeInTheDocument();
  expect(within(screen.getByTestId('site-row-s1')).getByText('In use')).toBeInTheDocument();
  expect(within(screen.getByTestId('site-row-s2')).getByText('Not in use')).toBeInTheDocument();
  expect(within(screen.getByTestId('site-row-s2')).getByText('No address')).toBeInTheDocument();
  expect(screen.getByTestId('map-sites')).toHaveTextContent('s1,s2');
  expect(screen.getByRole('link', { name: 'Add site' })).toHaveAttribute('href', '/sites/new');
});

test('hovering a row lights it on the map; clicking shows it there without leaving the page', async () => {
  const { user } = renderPage();
  const row = await screen.findByTestId('site-row-s1');
  await user.hover(row);
  expect(screen.getByTestId('map-hovered')).toHaveTextContent('s1');
  await user.click(within(row).getByText('Hinjewadi Phase 1'));
  expect(screen.getByTestId('map-selected')).toHaveTextContent('s1');
  expect(row).toHaveAttribute('aria-current', 'true');
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
});

test('clicking a pin highlights its row', async () => {
  const { user } = renderPage();
  await screen.findByTestId('site-row-s2');
  await user.click(screen.getByRole('button', { name: 'fake pin click' }));
  expect(screen.getByTestId('site-row-s2')).toHaveAttribute('aria-current', 'true');
  expect(screen.getByTestId('site-row-s1')).not.toHaveAttribute('aria-current');
});

test('no sites yet says so', async () => {
  renderWithProviders(<SitesPage />, { api: { listSites: vi.fn(async () => []) } });
  expect(await screen.findByText('No sites yet')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @ve/web test -- src/pages/sites/SitesPage`
Expected: FAIL. `./SitesMap` does not exist, and there are no `site-row-*` elements.

- [ ] **Step 3: Implement**

`apps/web/src/pages/sites/SitesMap.tsx`:

```tsx
import type { SiteDto } from '@ve/shared';
import L from 'leaflet';
import { Fragment, useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, Tooltip, useMap } from 'react-leaflet';
import { OsmTiles } from '../../maps/OsmTiles';
import { INDIA_BOUNDS } from './SiteMapPicker';

interface Props {
  sites: SiteDto[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
}

const IN_USE = '#B8480F';
const NOT_IN_USE = '#8A8578';

const pinIcon = (inUse: boolean) =>
  L.divIcon({ className: '', html: `<div class="ve-pin${inUse ? '' : ' ve-pin-off'}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

function boundsOf(sites: SiteDto[]): L.LatLngBounds {
  if (sites.length === 0) return INDIA_BOUNDS;
  const bounds = L.latLng(sites[0]!.lat, sites[0]!.lng).toBounds(sites[0]!.radiusM * 2);
  for (const s of sites) bounds.extend(L.latLng(s.lat, s.lng).toBounds(s.radiusM * 2));
  return bounds.pad(0.1);
}

/** Flies to the chosen site; keyed on the id so a background refetch does not move the map. */
function FlyToSelected({ sites, selectedId }: { sites: SiteDto[]; selectedId: string | null }) {
  const map = useMap();
  const latest = useRef(sites);
  latest.current = sites;
  useEffect(() => {
    const site = latest.current.find((s) => s.id === selectedId);
    if (site) map.flyToBounds(L.latLng(site.lat, site.lng).toBounds(site.radiusM * 3), { maxZoom: 18, duration: 0.6 });
  }, [map, selectedId]);
  return null;
}

export function SitesMap({ sites, selectedId, hoveredId, onSelect }: Props) {
  return (
    <MapContainer bounds={boundsOf(sites)} style={{ height: '100%', minHeight: 320, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      {sites.map((s) => {
        const lit = s.id === selectedId || s.id === hoveredId;
        return (
          <Fragment key={s.id}>
            <Circle
              center={[s.lat, s.lng]}
              radius={s.radiusM}
              pathOptions={{ color: s.isActive ? IN_USE : NOT_IN_USE, weight: lit ? 3.5 : 2, fillOpacity: lit ? 0.3 : 0.12 }}
              eventHandlers={{ click: () => onSelect(s.id) }}
            />
            <Marker position={[s.lat, s.lng]} icon={pinIcon(s.isActive)} eventHandlers={{ click: () => onSelect(s.id) }}>
              <Tooltip direction="top" offset={[0, -12]}>
                {s.name}
              </Tooltip>
            </Marker>
          </Fragment>
        );
      })}
      <FlyToSelected sites={sites} selectedId={selectedId} />
    </MapContainer>
  );
}
```

`apps/web/src/pages/sites/SitesPage.tsx`:

```tsx
import { Anchor, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { PageError, PageLoader } from '../../components/PageState';
import { queryKeys } from '../../lib/queryKeys';
import { useServices } from '../../services';
import { SitesMap } from './SitesMap';

export function SitesPage() {
  const { api } = useServices();
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());

  function selectFromMap(id: string) {
    setSelectedId(id);
    rows.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1}>Sites</Title>
        <Button component={Link} to="/sites/new" leftSection={<IconPlus size={18} />}>
          Add site
        </Button>
      </Group>
      {sites.isError && !sites.data ? (
        <PageError error={sites.error} onRetry={() => void sites.refetch()} />
      ) : !sites.data ? (
        <PageLoader />
      ) : (
        <div className="ve-split">
          <div className="ve-split-map">
            <SitesMap sites={sites.data} selectedId={selectedId} hoveredId={hoveredId} onSelect={selectFromMap} />
          </div>
          <Stack className="ve-split-list" gap="xs">
            {sites.data.length === 0 ? (
              <Text c="dimmed">No sites yet</Text>
            ) : (
              sites.data.map((s) => (
                <Paper
                  key={s.id}
                  ref={(el: HTMLDivElement | null) => {
                    if (el) rows.current.set(s.id, el);
                    else rows.current.delete(s.id);
                  }}
                  data-testid={`site-row-${s.id}`}
                  aria-current={s.id === selectedId ? 'true' : undefined}
                  withBorder
                  p="sm"
                  radius="md"
                  className="ve-site-row"
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(s.id)}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <div>
                      <Anchor component={Link} to={`/sites/${s.id}`} fw={600} onClick={(event) => event.stopPropagation()}>
                        {s.name}
                      </Anchor>
                      <Text size="sm" c="dimmed">
                        {s.address ?? 'No address'}
                      </Text>
                    </div>
                    <Stack gap={4} align="flex-end">
                      <Badge color={s.isActive ? 'ledgerGreen' : 'gray'} variant="light">
                        {s.isActive ? 'In use' : 'Not in use'}
                      </Badge>
                      <Text size="sm" className="ve-num">
                        {s.radiusM} m
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ))
            )}
          </Stack>
        </div>
      )}
    </Stack>
  );
}
```

Append to `apps/web/src/styles.css`:

```css
.ve-pin-off {
  background: #8a8578;
}

/* Sites tab: the map on the left, the list on the right; stacked on narrow screens. */
.ve-split {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 16px;
  height: calc(100vh - 180px);
  min-height: 480px;
}

.ve-split-map,
.ve-split-list {
  min-height: 0;
}

.ve-split-list {
  overflow-y: auto;
  padding-right: 4px;
}

.ve-site-row {
  cursor: pointer;
}

.ve-site-row[aria-current="true"] {
  border-color: #b8480f;
  box-shadow: 0 0 0 1px #b8480f;
}

@media (max-width: 900px) {
  .ve-split {
    grid-template-columns: 1fr;
    height: auto;
  }

  .ve-split-map {
    height: 320px;
  }

  .ve-split-list {
    overflow: visible;
  }
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter @ve/web test -- src/pages/sites/SitesPage`
Expected: PASS (4 tests).

Run: `pnpm --filter @ve/web test && pnpm --filter @ve/web typecheck && pnpm lint`
Expected: pass and clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "show sites on a map beside the list"
```

---

### Task 7: Web Today page: map of who checked in where

**Files:**
- Create:
  - `apps/web/src/pages/today/workingMap.ts`
  - `apps/web/src/pages/today/WorkingMap.tsx`
- Modify:
  - `apps/web/src/pages/DashboardPage.tsx`
  - `apps/web/src/styles.css`
- Test:
  - `apps/web/src/pages/today/workingMap.test.ts` (new)
  - `apps/web/src/pages/DashboardPage.test.tsx` (append)

**Interfaces:**
- Consumes:
  - from Task 3: `DashboardMapDay` and `dashboardToday().mapDays` (days `d1` working and `d2` finished)
  - from Task 4: `INDIA_BOUNDS`
  - `AttendanceDrawer({ dayId, onClose })`
- Produces:
  - `GROUP_BELOW_ZOOM = 16`
  - `visibleDays`, `tagTone`, `tagLabel`, `siteBubbles`, `escapeHtml`, `tagHtml`, `bubbleHtml`
  - `WorkingMap({ days, sites, tz, onOpen, height })`

Spec §9.2 made concrete: tags group per site below zoom 16 and show individually from zoom 16 up.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/today/workingMap.test.ts`:

```ts
import type { DashboardMapDay } from '@ve/shared';
import { expect, test } from 'vitest';
import { dashboardToday, site } from '../../testing/fakes';
import { bubbleHtml, escapeHtml, siteBubbles, tagHtml, tagLabel, tagTone, visibleDays } from './workingMap';

const [working, finished] = dashboardToday().mapDays as [DashboardMapDay, DashboardMapDay];
const TZ = 'Asia/Kolkata';

test('tags say who and when, in company time', () => {
  expect(tagLabel(working, TZ)).toBe('Ravi Kumar · in 09:05');
  expect(tagLabel(finished, TZ)).toBe('Sunita Rao · 08:00–16:30');
});

test('green while working, orange when it needs review, grey once finished', () => {
  expect(tagTone(working)).toBe('green');
  expect(tagTone({ ...working, needsReview: true })).toBe('orange');
  expect(tagTone(finished)).toBe('grey');
});

test('finished days show only when asked', () => {
  expect(visibleDays([working, finished], false)).toEqual([working]);
  expect(visibleDays([working, finished], true)).toEqual([working, finished]);
});

test('tags at one site merge into a bubble at the site centre', () => {
  expect(siteBubbles([working, finished], [site()])).toEqual([
    { siteId: 's1', lat: 18.5912, lng: 73.7389, label: 'Plot 7 · 1 working, 1 done' },
  ]);
  // A site missing from the list (e.g. turned off) sits at the average check-in.
  expect(siteBubbles([working], [])).toEqual([{ siteId: 's1', lat: 18.5913, lng: 73.739, label: 'Plot 7 · 1 working' }]);
});

test('names are escaped before they reach the map markup', () => {
  const evil = { ...working, name: '<img src=x onerror=alert(1)>' };
  expect(tagHtml(evil, TZ)).toBe('<div class="ve-tag ve-tag-green">&lt;img src=x onerror=alert(1)&gt; · in 09:05</div>');
  expect(bubbleHtml({ siteId: 's1', lat: 0, lng: 0, label: 'A&B "yard"' })).toBe('<div class="ve-bubble">A&amp;B &quot;yard&quot;</div>');
  expect(escapeHtml(`it's`)).toBe('it&#39;s');
});
```

Append to `apps/web/src/pages/DashboardPage.test.tsx`:
- Add `site` to the `../testing/fakes` import.
- Put these mocks under the imports:

```tsx
// Leaflet needs a real browser; the page only relies on the days it passes and onOpen.
vi.mock('./today/WorkingMap', () => ({
  WorkingMap: (props: { days: { dayId: string }[]; onOpen: (id: string) => void }) => (
    <div>
      <output data-testid="map-days">{props.days.map((d) => d.dayId).join(',') || 'none'}</output>
      <button type="button" onClick={() => props.onOpen('d1')}>
        fake tag click
      </button>
    </div>
  ),
}));
vi.mock('./attendance/AttendanceDrawer', () => ({
  AttendanceDrawer: (props: { dayId: string | null }) => <output data-testid="drawer">{props.dayId ?? 'closed'}</output>,
}));
```

and at the end of the file:

```tsx
test('the map shows who is working; finished days appear when asked', async () => {
  const { user } = renderWithProviders(<DashboardPage />, {
    api: { dashboard: vi.fn(async () => dashboardToday()), listSites: vi.fn(async () => [site()]) },
  });
  expect(await screen.findByTestId('map-days')).toHaveTextContent(/^d1$/);
  await user.click(screen.getByLabelText('Also show finished today'));
  expect(screen.getByTestId('map-days')).toHaveTextContent(/^d1,d2$/);
});

test('clicking a tag opens that day', async () => {
  const { user } = renderWithProviders(<DashboardPage />, { api: { dashboard: vi.fn(async () => dashboardToday()) } });
  expect(screen.queryByTestId('drawer')).toBeNull();
  await user.click(await screen.findByRole('button', { name: 'fake tag click' }));
  expect(screen.getByTestId('drawer')).toHaveTextContent('d1');
});

test('an empty day says no one has checked in', async () => {
  renderWithProviders(<DashboardPage />, { api: { dashboard: vi.fn(async () => dashboardToday({ working: [], mapDays: [] })) } });
  expect(await screen.findByText('No one has checked in yet today.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/web test -- src/pages/today src/pages/DashboardPage`
Expected: FAIL.
- `./workingMap` cannot be resolved.
- The dashboard tests find no `map-days` and no "Also show finished today" label.

- [ ] **Step 3: Implement the helpers**

`apps/web/src/pages/today/workingMap.ts`:

```ts
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
```

- [ ] **Step 4: Implement the map and the page**

`apps/web/src/pages/today/WorkingMap.tsx`:

```tsx
import type { DashboardMapDay, SiteDto } from '@ve/shared';
import L from 'leaflet';
import { useState } from 'react';
import { Circle, MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { OsmTiles } from '../../maps/OsmTiles';
import { INDIA_BOUNDS } from '../sites/SiteMapPicker';
import { bubbleHtml, GROUP_BELOW_ZOOM, siteBubbles, tagHtml } from './workingMap';

interface Props {
  days: DashboardMapDay[];
  sites: SiteDto[];
  tz: string;
  onOpen: (dayId: string) => void;
  height: number | string;
}

/** A zero-size marker; the label inside positions itself (see .ve-tag / .ve-bubble). */
const labelIcon = (html: string) => L.divIcon({ className: 've-anchor', html, iconSize: [0, 0], iconAnchor: [0, 0] });

function startBounds(days: DashboardMapDay[], sites: SiteDto[]): L.LatLngBounds {
  const points = [
    ...days.map((d) => L.latLng(d.checkInLat, d.checkInLng)),
    ...sites.filter((s) => s.isActive).map((s) => L.latLng(s.lat, s.lng)),
  ];
  return points.length > 0 ? L.latLngBounds(points).pad(0.2) : INDIA_BOUNDS;
}

function Tags({ days, sites, tz, onOpen }: Omit<Props, 'height'>) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  if (zoom < GROUP_BELOW_ZOOM) {
    return siteBubbles(days, sites).map((b) => (
      <Marker
        key={b.siteId}
        position={[b.lat, b.lng]}
        icon={labelIcon(bubbleHtml(b))}
        eventHandlers={{ click: () => map.flyTo([b.lat, b.lng], GROUP_BELOW_ZOOM + 1) }}
      />
    ));
  }
  return days.map((d) => (
    <Marker
      key={d.dayId}
      position={[d.checkInLat, d.checkInLng]}
      icon={labelIcon(tagHtml(d, tz))}
      eventHandlers={{ click: () => onOpen(d.dayId) }}
    />
  ));
}

/** Where each worker checked in today. Positions come from check-in only; nothing is tracked afterwards. */
export function WorkingMap({ days, sites, tz, onOpen, height }: Props) {
  return (
    <MapContainer bounds={startBounds(days, sites)} style={{ height, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      {sites
        .filter((s) => s.isActive)
        .map((s) => (
          <Circle
            key={s.id}
            center={[s.lat, s.lng]}
            radius={s.radiusM}
            interactive={false}
            pathOptions={{ color: '#B8480F', weight: 1.5, opacity: 0.5, fillOpacity: 0.06 }}
          />
        ))}
      <Tags days={days} sites={sites} tz={tz} onOpen={onOpen} />
    </MapContainer>
  );
}
```

In `apps/web/src/pages/DashboardPage.tsx`:
- Imports:
  - Add `Switch` to the `@mantine/core` import.
  - Add `import { useState, type ReactNode } from 'react';` in place of the current `import type { ReactNode } from 'react';`.
  - Add `import { AttendanceDrawer } from './attendance/AttendanceDrawer';`.
  - Add `import { visibleDays } from './today/workingMap';` and `import { WorkingMap } from './today/WorkingMap';`.
- In `DashboardPage`, after the `query` line and before `if (!query.data)`:

```tsx
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [showFinished, setShowFinished] = useState(false);
  const [openDayId, setOpenDayId] = useState<string | null>(null);
```

- In the returned JSX, insert between the header `Group` and the stats `SimpleGrid`:

```tsx
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={3}>On site today</Title>
          <Switch
            label="Also show finished today"
            checked={showFinished}
            onChange={(event) => setShowFinished(event.currentTarget.checked)}
          />
        </Group>
        {d.mapDays.length === 0 ? (
          <Text c="dimmed" mb="sm">
            No one has checked in yet today.
          </Text>
        ) : null}
        <WorkingMap days={visibleDays(d.mapDays, showFinished)} sites={sites.data ?? []} tz={tz} onOpen={setOpenDayId} height="55vh" />
      </Paper>
```

- As the last child of the outer `Stack` (after the "Working now" `Paper`):

```tsx
      {openDayId ? <AttendanceDrawer dayId={openDayId} onClose={() => setOpenDayId(null)} /> : null}
```

Append to `apps/web/src/styles.css`:

```css
/* Today map: tags sit above their point; bubbles centre on the site. */
.ve-anchor {
  overflow: visible;
}

.ve-tag,
.ve-bubble {
  position: absolute;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 1px 4px rgb(0 0 0 / 35%);
  font-family: "Public Sans", sans-serif;
}

.ve-tag {
  transform: translate(-50%, calc(-100% - 8px));
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: #fff;
}

.ve-tag::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -5px;
  margin-left: -5px;
  border: 5px solid transparent;
  border-bottom: 0;
}

.ve-tag-green {
  background: #1e6b45;
}

.ve-tag-green::after {
  border-top-color: #1e6b45;
}

.ve-tag-orange {
  background: #b8480f;
}

.ve-tag-orange::after {
  border-top-color: #b8480f;
}

.ve-tag-grey {
  background: #6b675e;
}

.ve-tag-grey::after {
  border-top-color: #6b675e;
}

.ve-bubble {
  transform: translate(-50%, -50%);
  padding: 6px 12px;
  border-radius: 999px;
  background: #1b1d1f;
  color: #f4f1ea;
  font-size: 13px;
  font-weight: 700;
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `pnpm --filter @ve/web test -- src/pages/today src/pages/DashboardPage`
Expected: PASS (helpers 5; dashboard 4 + 3).

Run: `pnpm --filter @ve/web test && pnpm --filter @ve/web typecheck && pnpm lint`
Expected: pass and clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "add map of today's check-ins to the dashboard"
```

---

### Task 8: Web carry-overs: "Set by an admin", favicon, smaller first load

**Files:**
- Modify:
  - `apps/web/src/pages/attendance/AttendanceDrawer.tsx`
  - `apps/web/src/pages/attendance/DayMap.tsx`
  - `apps/web/src/App.tsx`
  - `apps/web/src/layout/AppLayout.tsx`
  - `apps/web/vite.config.ts`
  - `apps/web/index.html`
- Create:
  - `apps/web/public/favicon.svg`
  - `apps/web/src/pages/attendance/DayMap.test.ts`
- Test: `apps/web/src/pages/attendance/AttendanceDrawer.test.tsx` (append)

**Interfaces:**
- Produces: `dayPins(day: AdminDayDto)`, exported from `DayMap.tsx`.

The spec asked for an SVG icon plus a PNG fallback. The plan ships only the SVG, because every current browser supports SVG favicons (spec updated).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/attendance/DayMap.test.ts`:

```ts
import { expect, test } from 'vitest';
import { adminDay } from '../../testing/fakes';
import { dayPins } from './DayMap';

test('draws the check-in and check-out positions', () => {
  expect(dayPins(adminDay()).map((p) => p.key)).toEqual(['in', 'out']);
});

test('no check-out dot when an admin set the time', () => {
  expect(dayPins(adminDay({ flags: ['ADMIN_CORRECTED'] })).map((p) => p.key)).toEqual(['in']);
});
```

Append to `apps/web/src/pages/attendance/AttendanceDrawer.test.tsx`:

```tsx
test('a check-out fixed by an admin says so instead of the phone distance', async () => {
  renderDrawer({ getAttendance: vi.fn(async () => detail(adminDay({ flags: ['ADMIN_CORRECTED'] }))) });
  expect(await screen.findByText('Set by an admin')).toBeInTheDocument();
  expect(screen.queryByText('11 m from the centre · accuracy 9 m')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/web test -- src/pages/attendance`
Expected: FAIL.
- `dayPins` is not exported.
- `Set by an admin` is not found, because the day still has phone check-out coordinates.

- [ ] **Step 3: Implement "Set by an admin"**

In `apps/web/src/pages/attendance/AttendanceDrawer.tsx`, in the "Checked out" `Fact`, replace the `detail` expression with:

```tsx
          detail={
            day.checkOutAt
              ? day.flags.includes('ADMIN_CORRECTED') || day.checkOutLat == null
                ? 'Set by an admin'
                : `${metres(day.checkOutDistanceM)} from the centre · accuracy ${metres(day.checkOutAccuracyM)}`
              : day.status === 'MISSED_CHECKOUT'
                ? 'No check-out recorded'
                : 'Still working'
          }
```

In `apps/web/src/pages/attendance/DayMap.tsx`:
- Add this exported function above `DayMap`.
- Inside `DayMap`, replace the inline `const pins = [ … ];` with `const pins = dayPins(day);`.

```tsx
/** An admin-set check-out has no real position, and the phone's earlier reading would mislead. */
export function dayPins(day: AdminDayDto) {
  const pins = [{ key: 'in', label: 'Check-in', lat: day.checkInLat, lng: day.checkInLng, color: '#1E6B45' }];
  if (day.checkOutLat != null && day.checkOutLng != null && !day.flags.includes('ADMIN_CORRECTED')) {
    pins.push({ key: 'out', label: 'Check-out', lat: day.checkOutLat, lng: day.checkOutLng, color: '#B8480F' });
  }
  return pins;
}
```

- [ ] **Step 4: Favicon**

`apps/web/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1B1D1F"/><path d="M32 11c-8.6 0-15.5 6.7-15.5 15C16.5 37.3 32 53 32 53s15.5-15.7 15.5-27C47.5 17.7 40.6 11 32 11z" fill="#B8480F"/><circle cx="32" cy="26.5" r="6" fill="#F4F1EA"/></svg>
```

In `apps/web/index.html`, add inside `<head>` after the viewport meta:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 5: Load each page on demand**

Replace `apps/web/src/App.tsx`:

```tsx
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';

// Each page is its own chunk, so the first load does not download every page (or Leaflet).
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const EmployeesPage = lazy(() => import('./pages/employees/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const EmployeeDetailPage = lazy(() => import('./pages/employees/EmployeeDetailPage').then((m) => ({ default: m.EmployeeDetailPage })));
const SitesPage = lazy(() => import('./pages/sites/SitesPage').then((m) => ({ default: m.SitesPage })));
const SiteEditPage = lazy(() => import('./pages/sites/SiteEditPage').then((m) => ({ default: m.SiteEditPage })));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="sites/new" element={<SiteEditPage />} />
        <Route path="sites/:id" element={<SiteEditPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
```

In `apps/web/src/layout/AppLayout.tsx`:
- Add `import { Suspense } from 'react';`.
- Wrap the existing `<Outlet />` so the navigation stays visible while a page chunk loads:

```tsx
<Suspense fallback={<PageLoader />}>
  <Outlet />
</Suspense>
```

In `apps/web/vite.config.ts`, add a `build` key next to `preview`:

```ts
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'mantine', test: /node_modules[\\/](@mantine|mantine-datatable)[\\/]/ },
            { name: 'leaflet', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/ },
          ],
        },
      },
    },
  },
```

- [ ] **Step 6: Run the tests and checks**

Run: `pnpm --filter @ve/web test`
Expected: all pass, including `App.test.tsx` (its assertions already wait with `findBy*`).

Run: `pnpm --filter @ve/web typecheck && pnpm lint && pnpm --filter @ve/web build 2>&1 | tee /tmp/claude-1000/-home-prathmesh-Projects-VE/c9c1f7a9-f2da-4c55-a581-1651b9ba689f/scratchpad/web-build.log | tail -25 && test -f apps/web/dist/favicon.svg && ! grep -q "larger than 500 kB" /tmp/claude-1000/-home-prathmesh-Projects-VE/c9c1f7a9-f2da-4c55-a581-1651b9ba689f/scratchpad/web-build.log && echo CHUNKS-OK`
Expected: typecheck and lint clean; the build lists separate `react`, `mantine`, `leaflet` and per-page chunks; the final line is `CHUNKS-OK`.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "show admin-set check-outs clearly, add icon, split bundle"
```

---
### Task 9: App map: optional pin, tap to place, "me" dot, overview

**Files:**
- Modify:
  - `apps/mobile/src/maps/LeafletMap.tsx`
  - `apps/mobile/android/app/src/main/assets/map/bridge.js` (full replacement)
- Test: `apps/mobile/src/maps/LeafletMap.test.tsx` (append)

**Interfaces:**
- `LeafletMap` props after this task (all earlier props unchanged, so `AttendanceDetailScreen` keeps working):
  - `center: LatLng | null`: null means no pin or circle.
  - `tapToPlace?: boolean`: a map tap posts `moved`.
  - `me?: MeDot | null`, where `export interface MeDot { lat: number; lng: number; accuracyM: number }`.
  - `follow?: boolean`: refit when the "me" dot leaves the view.
  - `overview?: LatLng[]`: the starting view while there is no pin.
- The state object injected into `window.veMap.update(…)` gains the keys `tapToPlace`, `me`, `follow` and `overview`. `center` may be `null`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/mobile/src/maps/LeafletMap.test.tsx`:

```tsx
test('a map with no pin yet sends a null centre and the overview', async () => {
  await render(
    <LeafletMap testID="map" center={null} radiusM={100} height={200} tapToPlace overview={[{ lat: 17.4, lng: 78.4 }]} />,
  );
  await fireEvent(screen.getByTestId('map'), 'message', message({ type: 'ready' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(1));
  expect(injectedScripts[0]).toContain('"center":null');
  expect(injectedScripts[0]).toContain('"tapToPlace":true');
  expect(injectedScripts[0]).toContain('"overview":[{"lat":17.4,"lng":78.4}]');
});

test('the phone position and follow mode reach the page', async () => {
  await render(
    <LeafletMap testID="map" center={{ lat: 18.5, lng: 73.8 }} radiusM={100} height={200} me={{ lat: 18.501, lng: 73.801, accuracyM: 9 }} follow />,
  );
  await fireEvent(screen.getByTestId('map'), 'message', message({ type: 'ready' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(1));
  expect(injectedScripts[0]).toContain('"me":{"lat":18.501,"lng":73.801,"accuracyM":9}');
  expect(injectedScripts[0]).toContain('"follow":true');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/maps/LeafletMap`
Expected: FAIL.
- TypeScript under Jest is not type-checked, so the failure is on content.
- The injected state has no `"tapToPlace"` and no `"me"` keys.

- [ ] **Step 3: Implement the component**

In `apps/mobile/src/maps/LeafletMap.tsx`:

After `MapPin`, add:

```tsx
export interface MeDot extends LatLng {
  accuracyM: number;
}
```

Replace the `Props` interface with:

```tsx
interface Props {
  /** null = no pin yet (a new site); the map shows `overview`, or India. */
  center: LatLng | null;
  radiusM: number;
  height: number;
  draggable?: boolean;
  /** A tap on the map moves the pin there (reported through onMove). */
  tapToPlace?: boolean;
  /** false = a static picture: touches pass through (e.g. inside a ScrollView). */
  interactive?: boolean;
  pins?: MapPin[];
  /** The phone's own position: a blue dot with its accuracy ring. */
  me?: MeDot | null;
  /** Refit the map when the blue dot leaves the view. */
  follow?: boolean;
  /** Other places to frame while there is no pin (e.g. existing sites). */
  overview?: LatLng[];
  /** Change this number to make the map fit the circle and pins again. */
  recenterKey?: number;
  onMove?: (position: LatLng) => void;
  testID?: string;
}
```

Replace the function signature and the `state` line:

```tsx
export function LeafletMap({
  center,
  radiusM,
  height,
  draggable = false,
  tapToPlace = false,
  interactive = true,
  pins = [],
  me = null,
  follow = false,
  overview = [],
  recenterKey = 0,
  onMove,
  testID,
}: Props) {
```

```tsx
  const state = JSON.stringify({ center, radiusM, draggable, tapToPlace, pins, me, follow, overview, recenterKey, tileUrl });
```

- [ ] **Step 4: Replace the page script**

`apps/mobile/android/app/src/main/assets/map/bridge.js`:

```js
(function () {
  var INDIA = [[6.5, 68], [35.5, 97.5]];
  var map = L.map('map', { zoomControl: true });
  map.fitBounds(INDIA);
  var tiles = null;
  var tileUrl = null;
  var centre = null;
  var circle = null;
  var pins = [];
  var meDot = null;
  var meRing = null;
  var tapToPlace = false;
  var lastRecenter = null;
  var overviewShown = false;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  map.on('click', function (e) {
    if (tapToPlace) post({ type: 'moved', lat: e.latlng.lat, lng: e.latlng.lng });
  });

  function setTiles(url) {
    if (url === tileUrl) return;
    if (tiles) map.removeLayer(tiles);
    tileUrl = url;
    tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  }

  function setCentre(s) {
    if (!s.center) {
      if (centre) {
        map.removeLayer(centre);
        map.removeLayer(circle);
        centre = null;
        circle = null;
      }
      return;
    }
    var ll = [s.center.lat, s.center.lng];
    if (!centre) {
      centre = L.marker(ll, {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:22px;height:22px;border-radius:11px;background:#1B1D1F;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(map);
      circle = L.circle(ll, { radius: s.radiusM, color: '#B8480F', weight: 2.5, fillOpacity: 0.14 }).addTo(map);
      centre.on('drag', function (e) { circle.setLatLng(e.target.getLatLng()); });
      centre.on('dragend', function (e) {
        var p = e.target.getLatLng();
        post({ type: 'moved', lat: p.lat, lng: p.lng });
      });
    }
    centre.setLatLng(ll);
    circle.setLatLng(ll);
    circle.setRadius(s.radiusM);
    if (s.draggable) centre.dragging.enable(); else centre.dragging.disable();
  }

  function setPins(list) {
    for (var i = 0; i < pins.length; i++) map.removeLayer(pins[i]);
    pins = [];
    for (var j = 0; j < list.length; j++) {
      var p = list[j];
      pins.push(L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 }).addTo(map));
    }
  }

  function setMe(me) {
    if (!me) {
      if (meDot) {
        map.removeLayer(meDot);
        map.removeLayer(meRing);
        meDot = null;
        meRing = null;
      }
      return;
    }
    var ll = [me.lat, me.lng];
    if (!meDot) {
      meRing = L.circle(ll, { radius: me.accuracyM, color: '#1F4E8C', weight: 1, fillColor: '#1F4E8C', fillOpacity: 0.12, interactive: false }).addTo(map);
      meDot = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#1F4E8C', fillOpacity: 1, interactive: false }).addTo(map);
    }
    meRing.setLatLng(ll);
    meRing.setRadius(me.accuracyM);
    meDot.setLatLng(ll);
  }

  /** The site circle, the pins and the blue dot; null when there is nothing to frame. */
  function contentBounds(s) {
    var b = L.latLngBounds([]);
    if (s.center) b.extend(L.latLng(s.center.lat, s.center.lng).toBounds(s.radiusM * 2));
    for (var i = 0; i < pins.length; i++) b.extend(pins[i].getLatLng());
    if (s.me) b.extend(L.latLng(s.me.lat, s.me.lng));
    return b.isValid() ? b : null;
  }

  function fitContent(s) {
    var b = contentBounds(s);
    if (b) map.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
  }

  function update(s) {
    setTiles(s.tileUrl);
    tapToPlace = !!s.tapToPlace;
    setCentre(s);
    setPins(s.pins);
    setMe(s.me);

    if (!s.center && !overviewShown && s.overview && s.overview.length > 0) {
      overviewShown = true;
      map.fitBounds(L.latLngBounds(s.overview.map(function (p) { return [p.lat, p.lng]; })).pad(0.3), { maxZoom: 13 });
    }
    if (s.recenterKey !== lastRecenter) {
      lastRecenter = s.recenterKey;
      fitContent(s);
    } else if (s.follow && s.me && !map.getBounds().contains([s.me.lat, s.me.lng])) {
      fitContent(s);
    }
  }

  window.veMap = { update: update };
  post({ type: 'ready' });
})();
```

- [ ] **Step 5: Run the tests and checks**

Run: `pnpm --filter @ve/mobile test -- src/maps/LeafletMap && pnpm --filter @ve/mobile typecheck && pnpm lint`
Expected: PASS (5 tests); typecheck and lint clean. `AttendanceDetailScreen` still type-checks: it passes a non-null `center`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/maps apps/mobile/android/app/src/main/assets/map/bridge.js
git commit -m "let the app map start empty and show the phone"
```

---

### Task 10: App site editor: accuracy gate, no placeholder pin, paste from Google Maps

**Files:**
- Modify:
  - `apps/mobile/src/api/endpoints.ts`
  - `apps/mobile/src/attendance/queryKeys.ts`
  - `apps/mobile/src/screens/admin/adminErrors.ts`
  - `apps/mobile/src/screens/admin/SiteEditScreen.tsx` (full replacement)
  - `apps/mobile/src/i18n/en.json`
- Test:
  - `apps/mobile/src/screens/admin/SiteEditScreen.test.tsx` (full replacement)
  - `apps/mobile/src/screens/admin/adminErrors.test.ts` (append)

**Interfaces:**
- Consumes:
  - `parseCoordinates` and `PlaceLinkDto` (Task 1)
  - `POST /admin/places/resolve-link` (Task 2)
  - `LeafletMap` `tapToPlace` / `overview` / `center: null` (Task 9)
  - the existing `GET /admin/settings` (`SettingsDto`)
- Produces:
  - `Api.getSettings(): Promise<SettingsDto>`
  - `Api.resolvePlaceLink(text: string): Promise<PlaceLinkDto>`
  - `queryKeys.settings = ['admin', 'settings']`

The phone has no place search, so its hint and messages leave out "search". "Use my location" now aims for `maxAccuracyM` from settings, not the old hard-coded 20 m, and a fix above it is refused (spec §4.3).

- [ ] **Step 1: Write the failing tests**

Replace `apps/mobile/src/screens/admin/SiteEditScreen.test.tsx`:

```tsx
import React from 'react';
import { PermissionsAndroid } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { SettingsDto, SiteDto } from '@ve/shared';
import { ApiError } from '../../api/errors';
import { fakeApi } from '../../testing/fakeApi';
import { fakeState } from '../../testing/fakeNative';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { injectedScripts } from '../../testing/webView';
import { SiteEditScreen } from './SiteEditScreen';

const site: SiteDto = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100, address: null, isActive: true, createdAt: 'x', updatedAt: 'x' };
const settings: SettingsDto = { timezone: 'Asia/Kolkata', maxAccuracyM: 50, defaultRadiusM: 100, reminderTime: '19:00', clockMismatchMinutes: 5 };
const moved = (lat: number, lng: number) => ({ nativeEvent: { data: JSON.stringify({ type: 'moved', lat, lng }) } });

async function renderEdit(params: { id?: string }, api = {}) {
  const navigation = fakeNavigation();
  const createSite = jest.fn(async () => site);
  const updateSite = jest.fn(async () => site);
  await renderWithAuth(<SiteEditScreen navigation={navigation as never} route={{ key: 'k', name: 'SiteEdit', params } as never} />, {
    api: fakeApi({
      createSite,
      updateSite,
      getSite: jest.fn(async () => site),
      getSettings: jest.fn(async () => settings),
      listSites: jest.fn(async () => [site]),
      ...api,
    }),
    state: loggedIn(adminUser),
  });
  return { navigation, createSite, updateSite };
}

beforeEach(() => {
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: 'granted',
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted',
  } as never);
});

test('new site: no pin at first, so Save waits for one', async () => {
  const { createSite } = await renderEdit({});
  expect(screen.getByText('Set the location: paste from Google Maps, use my location, or tap the map.')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Site name'), 'Plot 9');
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
  await fireEvent(screen.getByTestId('site-map'), 'message', { nativeEvent: { data: '{"type":"ready"}' } });
  await waitFor(() => expect(injectedScripts.at(-1)).toContain('"center":null'));
  expect(injectedScripts.at(-1)).toContain('"tapToPlace":true');
  expect(createSite).not.toHaveBeenCalled();
});

test('new site: name, tapped pin and larger radius are saved', async () => {
  const { createSite, navigation } = await renderEdit({});
  await fireEvent.changeText(screen.getByLabelText('Site name'), ' Plot 9 ');
  await fireEvent(screen.getByTestId('site-map'), 'message', moved(18.6, 73.7));
  await fireEvent.press(screen.getByRole('button', { name: 'Larger' }));
  expect(screen.getByText('110 m')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(createSite).toHaveBeenCalledWith({ name: 'Plot 9', address: undefined, lat: 18.6, lng: 73.7, radiusM: 110 }),
  );
  expect(navigation.goBack).toHaveBeenCalled();
});

test('radius never goes below 10 m', async () => {
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: '50 m' }));
  for (let i = 0; i < 10; i++) await fireEvent.press(screen.getByRole('button', { name: 'Smaller' }));
  expect(screen.getByText('10 m')).toBeOnTheScreen();
});

test('edit: loads the site and saves changes', async () => {
  const { updateSite } = await renderEdit({ id: 's1' });
  expect(await screen.findByDisplayValue('Plot 7')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '200 m' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(updateSite).toHaveBeenCalledWith('s1', { name: 'Plot 7', address: null, lat: 18.59, lng: 73.73, radiusM: 200, isActive: true }),
  );
});

test('use my location: a precise reading moves the pin and shows its accuracy', async () => {
  fakeState.fix = { lat: 18.7, lng: 73.9, accuracyM: 8, isMock: false };
  await renderEdit({});
  await fireEvent(screen.getByTestId('site-map'), 'message', { nativeEvent: { data: '{"type":"ready"}' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('18.70000, 73.90000 · ±8 m')).toBeOnTheScreen();
  expect(screen.getByText('Your location · accurate to ±8 m')).toBeOnTheScreen();
  await waitFor(() => expect(injectedScripts.at(-1)).toContain('"lat":18.7'));
});

test('use my location: a poor reading does not move the pin and says why', async () => {
  fakeState.fix = { lat: 18.7, lng: 73.9, accuracyM: 400, isMock: false };
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(
    await screen.findByText('Your location is only accurate to ±400 m, more than the ±50 m allowed. Paste from Google Maps, or tap the map.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/18\.70000/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
});

test('use my location with location off explains why', async () => {
  fakeState.locationEnabled = false;
  await renderEdit({});
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Turn on location')).toBeOnTheScreen();
});

test('pasted coordinates move the pin without asking the server', async () => {
  const resolvePlaceLink = jest.fn();
  await renderEdit({}, { resolvePlaceLink });
  await fireEvent.changeText(screen.getByLabelText('Paste from Google Maps'), '17.416682, 78.366365');
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText('17.41668, 78.36637')).toBeOnTheScreen();
  expect(screen.getByText('From Google Maps · check the circle before saving.')).toBeOnTheScreen();
  expect(resolvePlaceLink).not.toHaveBeenCalled();
});

test('a pasted link is read by the server', async () => {
  const resolvePlaceLink = jest.fn(async () => ({ lat: 17.3615636, lng: 78.4746832 }));
  await renderEdit({}, { resolvePlaceLink });
  await fireEvent.changeText(screen.getByLabelText('Paste from Google Maps'), 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  expect(await screen.findByText('17.36156, 78.47468')).toBeOnTheScreen();
  expect(resolvePlaceLink).toHaveBeenCalledWith('https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9');
});

test('a link without a pin says why and leaves the pin alone', async () => {
  const resolvePlaceLink = jest.fn(async () => {
    throw new ApiError(422, 'NO_EXACT_PIN', 'area', { code: 'NO_EXACT_PIN' });
  });
  await renderEdit({}, { resolvePlaceLink });
  await fireEvent.changeText(screen.getByLabelText('Paste from Google Maps'), 'https://www.google.com/maps/@17.4167,78.3664,15z');
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  expect(
    await screen.findByText('This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Save site' })).toBeDisabled();
});

test('a site needs a name', async () => {
  const { createSite } = await renderEdit({});
  await fireEvent(screen.getByTestId('site-map'), 'message', moved(18.6, 73.7));
  await fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  expect(await screen.findByText('Enter the name')).toBeOnTheScreen();
  expect(createSite).not.toHaveBeenCalled();
});
```

Append to `apps/mobile/src/screens/admin/adminErrors.test.ts` (it already imports `ApiError` and `adminErrorKey`; add either import if missing):

```ts
test('google maps link problems have their own messages', () => {
  const err = (code: string) => new ApiError(422, code, code, { code });
  expect(adminErrorKey(err('NOT_A_MAPS_LINK'))).toBe('admin.sites.link.notMapsLink');
  expect(adminErrorKey(err('NO_EXACT_PIN'))).toBe('admin.sites.link.noExactPin');
  expect(adminErrorKey(err('LINK_UNREACHABLE'))).toBe('admin.sites.link.unreachable');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/screens/admin/SiteEditScreen src/screens/admin/adminErrors`
Expected: FAIL.
- The hint text is missing.
- Save is enabled with the Pune placeholder.
- No "Paste from Google Maps" field.
- `adminErrorKey` returns `admin.errors.generic` for the link codes.

- [ ] **Step 3: API client, query key, error keys, text**

In `apps/mobile/src/api/endpoints.ts`, add `PlaceLinkDto` and `SettingsDto` to the `@ve/shared` type import. Then in the returned object, after `updateSite`, add:

```ts
    getSettings: () => get<SettingsDto>('/admin/settings'),
    resolvePlaceLink: (text: string) => client.request<PlaceLinkDto>('POST', '/admin/places/resolve-link', { body: { text } }),
```

In `apps/mobile/src/attendance/queryKeys.ts`, add after `sites`:

```ts
  settings: ['admin', 'settings'] as const,
```

In `apps/mobile/src/screens/admin/adminErrors.ts`, add inside the `switch`, before `case 'NOT_FOUND':`:

```ts
      case 'NOT_A_MAPS_LINK':
        return 'admin.sites.link.notMapsLink';
      case 'NO_EXACT_PIN':
        return 'admin.sites.link.noExactPin';
      case 'LINK_UNREACHABLE':
        return 'admin.sites.link.unreachable';
```

In `apps/mobile/src/i18n/en.json`, add inside `admin.sites` after `"locating": "Finding your location…",`:

```json
      "noPinHint": "Set the location: paste from Google Maps, use my location, or tap the map.",
      "located": "Your location · accurate to ±{{accuracy}} m",
      "tooImprecise": "Your location is only accurate to ±{{accuracy}} m, more than the ±{{max}} m allowed. Paste from Google Maps, or tap the map.",
      "noFix": "Could not get your location. Paste from Google Maps, or tap the map.",
      "paste": "Paste from Google Maps",
      "pasteHelp": "In Google Maps, tap Share → Copy link, or long-press the spot to copy its coordinates.",
      "pasteGo": "Go",
      "fromGoogle": "From Google Maps · check the circle before saving.",
      "link": {
        "notMapsLink": "That doesn't look like a Google Maps link or coordinates.",
        "noExactPin": "This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.",
        "unreachable": "Couldn't open that link. Check it, or copy the coordinates instead."
      },
```

Also change `"dragHint"` to `"Drag the pin, or tap the map, to set the site gate or centre."`.

- [ ] **Step 4: Replace the screen**

`apps/mobile/src/screens/admin/SiteEditScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseCoordinates } from '@ve/shared';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import { LeafletMap, type LatLng } from '../../maps/LeafletMap';
import { ensureLocationReady, getBestFix, type LocationProblem } from '../../native/location';
import type { SitesStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { adminErrorKey } from './adminErrors';

type Props = NativeStackScreenProps<SitesStackParamList, 'SiteEdit'>;

const MIN_RADIUS = 10;
const MAX_RADIUS = 1000;
const PRESETS = [50, 100, 200, 500];
const FIX_TIMEOUT_MS = 20_000;
/** Used only until company settings arrive. */
const FALLBACK_MAX_ACCURACY_M = 50;

const LOCATION_PROBLEM_KEY: Record<LocationProblem, string> = {
  LOCATION_OFF: 'result.locationOff',
  PERMISSION_DENIED: 'result.permissionDenied',
  PRECISE_LOCATION_REQUIRED: 'result.preciseRequired',
};

/** A message to show: an i18n key plus its values. */
type Note = { key: string; values?: Record<string, number> };

const clampRadius = (m: number) => Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, m));

export function SiteEditScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const id = route.params.id;
  const siteQuery = useQuery({ queryKey: queryKeys.site(id ?? 'new'), queryFn: () => api.getSite(id ?? ''), enabled: !!id });
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: () => api.getSettings() });
  const sitesQuery = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites(), enabled: !id });
  const maxAccuracyM = settingsQuery.data?.maxAccuracyM ?? FALLBACK_MAX_ACCURACY_M;

  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [center, setCenter] = useState<LatLng | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [radiusM, setRadiusM] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<Note | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: t(id ? 'admin.sites.editTitle' : 'admin.sites.newTitle') });
  }, [navigation, t, id]);

  useEffect(() => {
    const site = siteQuery.data;
    if (!site || loaded) return;
    setName(site.name);
    setAddress(site.address ?? '');
    setCenter({ lat: site.lat, lng: site.lng });
    setRadiusM(site.radiusM);
    setIsActive(site.isActive);
    setRecenterKey((k) => k + 1);
    setLoaded(true);
  }, [siteQuery.data, loaded]);

  function moveTo(p: LatLng, recenter: boolean, accuracy: number | null = null) {
    setCenter(p);
    setAccuracyM(accuracy);
    setNote(null);
    setError(null);
    if (recenter) setRecenterKey((k) => k + 1);
  }

  async function locateMe() {
    setError(null);
    setNote(null);
    setLocating(true);
    try {
      const problem = await ensureLocationReady();
      if (problem) return setError({ key: LOCATION_PROBLEM_KEY[problem] });
      const fix = await getBestFix(maxAccuracyM, FIX_TIMEOUT_MS);
      if (!fix) return setError({ key: 'admin.sites.noFix' });
      const accuracy = Math.round(fix.accuracyM);
      if (fix.accuracyM > maxAccuracyM) return setError({ key: 'admin.sites.tooImprecise', values: { accuracy, max: maxAccuracyM } });
      moveTo({ lat: fix.lat, lng: fix.lng }, true, fix.accuracyM);
      setNote({ key: 'admin.sites.located', values: { accuracy } });
    } finally {
      setLocating(false);
    }
  }

  async function pasteFromGoogle() {
    const text = linkText.trim();
    if (!text) return;
    setError(null);
    const local = parseCoordinates(text);
    let place: LatLng | null = local;
    if (!place) {
      setResolving(true);
      try {
        place = await api.resolvePlaceLink(text);
      } catch (err) {
        setError({ key: adminErrorKey(err) });
      } finally {
        setResolving(false);
      }
    }
    if (!place) return;
    moveTo({ lat: place.lat, lng: place.lng }, true);
    setNote({ key: 'admin.sites.fromGoogle' });
    setLinkText('');
  }

  async function save() {
    if (!center) return;
    if (!name.trim()) return setError({ key: 'admin.errors.nameRequired' });
    setBusy(true);
    setError(null);
    try {
      if (id) {
        await api.updateSite(id, { name: name.trim(), address: address.trim() || null, lat: center.lat, lng: center.lng, radiusM, isActive });
      } else {
        await api.createSite({ name: name.trim(), address: address.trim() || undefined, lat: center.lat, lng: center.lng, radiusM });
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sites'] });
      if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.site(id) });
      navigation.goBack();
    } catch (err) {
      setError({ key: adminErrorKey(err) });
    } finally {
      setBusy(false);
    }
  }

  if (id && siteQuery.isPending) return <Loading />;
  if (id && !siteQuery.data) {
    return (
      <Screen edges={[]}>
        <ErrorState onRetry={() => void siteQuery.refetch()} />
      </Screen>
    );
  }

  const coords = center
    ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}${accuracyM !== null ? ` · ±${Math.round(accuracyM)} m` : ''}`
    : null;

  return (
    <Screen edges={[]}>
      <View>
        <LeafletMap
          testID="site-map"
          center={center}
          radiusM={radiusM}
          height={300}
          draggable
          tapToPlace
          overview={(sitesQuery.data ?? []).map((s) => ({ lat: s.lat, lng: s.lng }))}
          recenterKey={recenterKey}
          onMove={(p) => moveTo(p, false)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('admin.sites.useMyLocation')}
          onPress={() => void locateMe()}
          disabled={locating}
          style={{ position: 'absolute', left: 12, bottom: 12, height: 48, borderRadius: 24, paddingHorizontal: 16, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 3 }}
        >
          <Icon name="locate" size={20} />
          <Text variant="label">{locating ? t('admin.sites.locating') : t('admin.sites.useMyLocation')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        {coords ? (
          <Text variant="mono" color={colors.muted}>
            {coords}
          </Text>
        ) : (
          <Text variant="bodyStrong">{t('admin.sites.noPinHint')}</Text>
        )}
        {note ? (
          <Text variant="small" color={colors.checkIn}>
            {t(note.key, note.values)}
          </Text>
        ) : null}

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('admin.sites.paste')}
                value={linkText}
                onChangeText={setLinkText}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => void pasteFromGoogle()}
              />
            </View>
            <Button label={t('admin.sites.pasteGo')} variant="secondary" onPress={() => void pasteFromGoogle()} disabled={resolving} />
          </View>
          <Text variant="small" color={colors.muted}>
            {t('admin.sites.pasteHelp')}
          </Text>
        </View>

        <TextField label={t('admin.sites.name')} value={name} onChangeText={setName} />
        <TextField label={t('admin.sites.address')} value={address} onChangeText={setAddress} />

        <View style={{ gap: 8 }}>
          <Text variant="label">{t('admin.sites.allowedDistance')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.sites.smaller')}
              onPress={() => setRadiusM((m) => clampRadius(m - 10))}
              style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="minus" />
            </Pressable>
            <Text style={{ fontFamily: fonts.monoSemi, fontSize: 20, minWidth: 90, textAlign: 'center' }}>{t('admin.sites.radius', { m: radiusM })}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.sites.larger')}
              onPress={() => setRadiusM((m) => clampRadius(m + 10))}
              style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="plus" />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PRESETS.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={t('admin.sites.radius', { m })}
                onPress={() => setRadiusM(m)}
                style={{ height: 40, borderRadius: 20, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: radiusM === m ? colors.dark : colors.surface }}
              >
                <Text variant="small" color={radiusM === m ? colors.onDark : colors.text}>
                  {t('admin.sites.radius', { m })}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="small" color={colors.muted}>
            {t('admin.sites.dragHint')}
          </Text>
        </View>

        {id ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="label">{t('admin.sites.active')}</Text>
            <Switch accessibilityLabel={t('admin.sites.active')} value={isActive} onValueChange={setIsActive} />
          </View>
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(error.key, error.values)}
          </Text>
        ) : null}
        <Button label={busy ? t('admin.sites.saving') : t('admin.sites.save')} onPress={() => void save()} disabled={busy || !center} />
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `pnpm --filter @ve/mobile test -- src/screens/admin && pnpm --filter @ve/mobile typecheck && pnpm lint`
Expected:
- PASS: site editor 11, plus the adminErrors tests.
- Every other admin screen test still passes.
- Typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src
git commit -m "check accuracy and paste google maps links in app site editor"
```

---

### Task 11: Native live location watch

**Files:**
- Modify:
  - `apps/mobile/specs/NativeVeDevice.ts`
  - `apps/mobile/src/testing/fakeNative.ts`
  - `apps/mobile/android/app/src/main/java/com/vehr/app/device/Locator.kt`
  - `apps/mobile/android/app/src/main/java/com/vehr/app/device/VeDeviceModule.kt`
- Create: `apps/mobile/src/native/liveLocation.ts`
- Test: `apps/mobile/src/native/liveLocation.test.ts`

**Interfaces:**
- Produces, in the Spec:
  - `startLocationWatch(intervalMs: number): void`
  - `stopLocationWatch(): void`
  - `readonly onLocationUpdate: CodegenTypes.EventEmitter<NativeFix>`
- Produces, in `src/native/liveLocation.ts`:
  - `watchLocation(onFix: (fix: Fix) => void, intervalMs?: number): () => void`
  - `useLiveFix(active: boolean): Fix | null`
- Produces, in `src/testing/fakeNative.ts`:
  - `fakeState.watchIntervalMs: number | null`: null means not watching.
  - `emitFakeLocation(fix: FakeFix): void`

The spec named the event `VeLocationUpdate`. The RN 0.87 codegen way to send typed events from a TurboModule is an `EventEmitter` property, so here the event is the `onLocationUpdate` property (spec updated).

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/native/liveLocation.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native';
import { emitFakeLocation, fakeState } from '../testing/fakeNative';
import { useLiveFix, watchLocation } from './liveLocation';

const reading = { lat: 18.59, lng: 73.73, accuracyM: 7, isMock: false };

test('watching streams fixes until stopped', () => {
  const onFix = jest.fn();
  const stop = watchLocation(onFix, 1000);
  expect(fakeState.watchIntervalMs).toBe(1000);
  emitFakeLocation(reading);
  expect(onFix).toHaveBeenCalledWith(reading);
  stop();
  expect(fakeState.watchIntervalMs).toBeNull();
  emitFakeLocation({ ...reading, lat: 18.6 });
  expect(onFix).toHaveBeenCalledTimes(1);
});

test('the hook watches only while active and forgets the last fix when paused', async () => {
  const { result, rerender } = await renderHook(({ active }: { active: boolean }) => useLiveFix(active), {
    initialProps: { active: false },
  });
  expect(fakeState.watchIntervalMs).toBeNull();
  await rerender({ active: true });
  expect(fakeState.watchIntervalMs).toBe(1000);
  await act(async () => emitFakeLocation(reading));
  expect(result.current).toEqual(reading);
  await rerender({ active: false });
  expect(fakeState.watchIntervalMs).toBeNull();
  expect(result.current).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @ve/mobile test -- src/native/liveLocation`
Expected: FAIL. `Cannot find module './liveLocation'`, and there is no export `emitFakeLocation`.

- [ ] **Step 3: Spec and fake**

In `apps/mobile/specs/NativeVeDevice.ts`, change the first import to `import type { CodegenTypes, TurboModule } from 'react-native';`. Then add at the end of the `Spec` interface, after `cancelReminder`:

```ts
  /** Streams fixes about every intervalMs through onLocationUpdate until stopLocationWatch. A new call replaces the running watch. */
  startLocationWatch(intervalMs: number): void;
  stopLocationWatch(): void;
  readonly onLocationUpdate: CodegenTypes.EventEmitter<NativeFix>;
```

In `apps/mobile/src/testing/fakeNative.ts`:
- Add `watchIntervalMs: number | null;` to `FakeNativeState`, and `watchIntervalMs: null,` to `initialState()`.
- Add below `resetFakeNative`:

```ts
type FixListener = (fix: FakeFix) => void;
const fixListeners = new Set<FixListener>();

/** Plays one reading to whoever listens to onLocationUpdate, as the native watch would. */
export function emitFakeLocation(fix: FakeFix): void {
  for (const listener of [...fixListeners]) listener({ ...fix });
}
```

- In `resetFakeNative`, also clear the listeners:

```ts
export function resetFakeNative(): void {
  Object.assign(fakeState, initialState());
  fixListeners.clear();
}
```

- Add to the `fakeNative` object, after `cancelReminder`:

```ts
  startLocationWatch: (intervalMs: number) => {
    fakeState.watchIntervalMs = intervalMs;
  },
  stopLocationWatch: () => {
    fakeState.watchIntervalMs = null;
  },
  onLocationUpdate: (listener: FixListener) => {
    fixListeners.add(listener);
    return { remove: () => void fixListeners.delete(listener) };
  },
```

- [ ] **Step 4: JS wrapper**

`apps/mobile/src/native/liveLocation.ts`:

```ts
import { useEffect, useState } from 'react';
import NativeVeDevice from '../../specs/NativeVeDevice';
import type { Fix } from './location';

/** Streams fixes about once a second until the returned function is called. Nothing is sent to the server. */
export function watchLocation(onFix: (fix: Fix) => void, intervalMs = 1000): () => void {
  const subscription = NativeVeDevice.onLocationUpdate((f) =>
    onFix({ lat: f.lat, lng: f.lng, accuracyM: f.accuracyM, isMock: f.isMock }),
  );
  NativeVeDevice.startLocationWatch(intervalMs);
  return () => {
    subscription.remove();
    NativeVeDevice.stopLocationWatch();
  };
}

/** The latest fix while `active`; null before the first one and after pausing, so a stale reading is never shown. */
export function useLiveFix(active: boolean): Fix | null {
  const [fix, setFix] = useState<Fix | null>(null);
  useEffect(() => {
    if (!active) return;
    const stop = watchLocation(setFix);
    return () => {
      stop();
      setFix(null);
    };
  }, [active]);
  return fix;
}
```

- [ ] **Step 5: Kotlin**

In `Locator.kt`:
- Add the imports `import android.util.Log`.
- Change `startPlatform` to take the interval: `private fun startPlatform(intervalMs: Long, offer: (Location) -> Unit): () -> Unit`, using `LocationRequestCompat.Builder(intervalMs)`.
- In `bestFix`, call `startPlatform(1000L, ::offer)`.
- Add the watch below `bestFix`:

```kotlin
    /** The running watch's stop function. Only touched on the main thread. */
    private var activeWatch: (() -> Unit)? = null

    /** Streams fixes to [onFix] about every [intervalMs] until [stopWatch]. A new call replaces the running watch. */
    fun startWatch(intervalMs: Long, onFix: (Location) -> Unit) {
        Handler(Looper.getMainLooper()).post {
            activeWatch?.invoke()
            activeWatch = null
            try {
                activeWatch = if (hasPlayServices()) startFusedWatch(intervalMs, onFix) else startPlatform(intervalMs, onFix)
            } catch (e: SecurityException) {
                Log.w(TAG, "location watch refused", e)
            }
        }
    }

    fun stopWatch() {
        Handler(Looper.getMainLooper()).post {
            activeWatch?.invoke()
            activeWatch = null
        }
    }

    @SuppressLint("MissingPermission") // JS runs ensureLocationReady before watching.
    private fun startFusedWatch(intervalMs: Long, onFix: (Location) -> Unit): () -> Unit {
        val client = LocationServices.getFusedLocationProviderClient(context)
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs)
            .setMaxUpdateAgeMillis(0L)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let(onFix)
            }
        }
        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        return { client.removeLocationUpdates(callback) }
    }
```

- In the `companion object`, add `private const val TAG = "VeLocator"`.

In `VeDeviceModule.kt`:
- Add `import android.location.Location` and `import com.facebook.react.bridge.WritableMap`.
- Replace the body of `getCurrentPosition` so it shares the map builder, and add the watch methods:

```kotlin
    override fun getCurrentPosition(timeoutMs: Double, targetAccuracyM: Double, promise: Promise) {
        locator.bestFix(timeoutMs.toLong(), targetAccuracyM.toFloat()) { location ->
            if (location == null) promise.reject("NO_FIX", "No location fix") else promise.resolve(fixMap(location))
        }
    }

    override fun startLocationWatch(intervalMs: Double) {
        locator.startWatch(intervalMs.toLong()) { location ->
            if (location.hasAccuracy()) emitOnLocationUpdate(fixMap(location))
        }
    }

    override fun stopLocationWatch() = locator.stopWatch()

    override fun invalidate() {
        locator.stopWatch()
        super.invalidate()
    }

    private fun fixMap(location: Location): WritableMap =
        Arguments.createMap().apply {
            putDouble("lat", location.latitude)
            putDouble("lng", location.longitude)
            putDouble("accuracyM", location.accuracy.toDouble())
            putBoolean("isMock", Locator.isMock(location))
        }
```

- [ ] **Step 6: Run the tests, then build the app**

Run: `pnpm --filter @ve/mobile test -- src/native && pnpm --filter @ve/mobile typecheck && pnpm lint`
Expected: PASS (liveLocation 2, plus the existing native tests); typecheck and lint clean.

Run: `cd apps/mobile/android && VE_API_URL=https://api.example.invalid ./gradlew assembleRelease --no-daemon -q 2>&1 | tail -30; cd -`
Expected: `BUILD SUCCESSFUL`, or no error lines under `-q`. Codegen generates `emitOnLocationUpdate(value: ReadableMap)` on `NativeVeDeviceSpec`.
- If the build reports a different emitter name or signature, run `grep -rn "emitOnLocationUpdate\|LocationUpdate" apps/mobile/android/app/build/generated/source/codegen/java`.
- Use the name it shows, and ledger a ruling.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/specs apps/mobile/src/native/liveLocation.ts apps/mobile/src/native/liveLocation.test.ts apps/mobile/src/testing/fakeNative.ts apps/mobile/android/app/src/main/java
git commit -m "add live location updates from the phone"
```

---

### Task 12: Worker home: live preview of where you are

**Files:**
- Create:
  - `apps/mobile/src/attendance/preview.ts`
  - `apps/mobile/src/native/useScreenActive.ts`
  - `apps/mobile/src/screens/worker/LocationPreview.tsx`
- Modify:
  - `apps/mobile/src/screens/worker/HomeScreen.tsx`
  - `apps/mobile/src/i18n/en.json`
- Test:
  - `apps/mobile/src/attendance/preview.test.ts` (new)
  - `apps/mobile/src/screens/worker/HomeScreen.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `evaluateGeofence` and `distanceMeters` (`@ve/shared`)
  - `useLiveFix` and `emitFakeLocation` (Task 11)
  - `LeafletMap` `me` / `follow` (Task 9)
  - `ensureLocationReady`, `openLocationSettings`, `openAppSettings`
- Produces:
  - `type PreviewStatus = { kind: 'finding' } | { kind: 'imprecise'; accuracyM } | { kind: 'outside'; distanceM; accuracyM } | { kind: 'inside'; distanceM; accuracyM }`
  - `previewStatus(fix: Fix | null, site: LatLng & { radiusM: number }, maxAccuracyM: number): PreviewStatus`
  - `useScreenActive(): boolean`
  - `LocationPreview({ site, maxAccuracyM, active })`

The "no reading" text is "Looking for your location…", so it does not collide with the busy screen's "Finding your location…" (spec updated). The labels on the preview's problem card ("Location settings", "App settings") are distinct from the result screen's "Turn on location" / "Open settings".

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/attendance/preview.test.ts`:

```ts
import { distanceMeters, evaluateGeofence } from '@ve/shared';
import { previewStatus } from './preview';

const centre = { lat: 18.59, lng: 73.73 };
const at = (lat: number, lng: number, accuracyM: number, isMock = false) => ({ lat, lng, accuracyM, isMock });

test('no reading yet is "finding"', () => {
  expect(previewStatus(null, { ...centre, radiusM: 100 }, 50)).toEqual({ kind: 'finding' });
});

test('inside, outside and imprecise, with rounded numbers', () => {
  expect(previewStatus(at(18.59, 73.73, 7.6), { ...centre, radiusM: 100 }, 50)).toEqual({ kind: 'inside', distanceM: 0, accuracyM: 8 });
  const far = at(18.6, 73.73, 9);
  expect(previewStatus(far, { ...centre, radiusM: 100 }, 50)).toEqual({
    kind: 'outside',
    distanceM: Math.round(distanceMeters(far, centre)),
    accuracyM: 9,
  });
  expect(previewStatus(at(18.59, 73.73, 85), { ...centre, radiusM: 100 }, 50)).toEqual({ kind: 'imprecise', accuracyM: 85 });
});

test('edges give the same answer as the server rule', () => {
  const point = at(18.5905, 73.7304, 50);
  const exact = distanceMeters(point, centre);
  const cases = [
    { radiusM: exact, maxAccuracyM: 50 }, // exactly on the circle, accuracy exactly at the limit
    { radiusM: exact - 0.01, maxAccuracyM: 50 }, // a hair outside
    { radiusM: exact, maxAccuracyM: 49.99 }, // accuracy a hair too poor
  ];
  const kinds = cases.map(({ radiusM, maxAccuracyM }) => {
    const server = evaluateGeofence({ point, accuracyM: point.accuracyM, site: { ...centre, radiusM }, maxAccuracyM });
    const preview = previewStatus(point, { ...centre, radiusM }, maxAccuracyM).kind;
    const expected = server.ok ? 'inside' : server.reason === 'LOW_ACCURACY' ? 'imprecise' : 'outside';
    expect(preview).toBe(expected);
    return preview;
  });
  expect(kinds).toEqual(['inside', 'outside', 'imprecise']);
});
```

Append to `apps/mobile/src/screens/worker/HomeScreen.test.tsx`:
- Add `AppState` to the `react-native` import.
- Change the fakeNative import to `import { emitFakeLocation, fakeState } from '../../testing/fakeNative';`.
- Add these tests at the end:

```tsx
async function renderHome(api = fakeApi({ today: jest.fn(async () => today()), checkIn: jest.fn(async () => okIn) })) {
  await renderWithAuth(<HomeScreen />, { api });
  await screen.findByText('Plot 7, Hinjewadi');
  await waitFor(() => expect(fakeState.watchIntervalMs).toBe(1000));
  return api;
}

test('the preview says when you are inside the site', async () => {
  await renderHome();
  expect(screen.getByText('Looking for your location…')).toBeOnTheScreen();
  await act(async () => emitFakeLocation({ lat: 18.59, lng: 73.73, accuracyM: 8, isMock: false }));
  expect(screen.getByText('Inside the site · 0 m from the centre · ±8 m')).toBeOnTheScreen();
});

test('the preview warns about a poor reading and a fake-location app', async () => {
  await renderHome();
  await act(async () => emitFakeLocation({ lat: 18.59, lng: 73.73, accuracyM: 85, isMock: true }));
  expect(screen.getByText('Getting a precise location… ±85 m')).toBeOnTheScreen();
  expect(screen.getByText('A fake-location app is on. Check-ins will be flagged.')).toBeOnTheScreen();
});

test('CHECK IN still works when the preview says outside', async () => {
  const api = await renderHome();
  await act(async () => emitFakeLocation({ lat: 18.6, lng: 73.73, accuracyM: 9, isMock: false }));
  expect(screen.getByText(/^Outside the site · \d+ m away$/)).toBeOnTheScreen();
  const button = screen.getByRole('button', { name: 'CHECK IN' });
  expect(button).toBeEnabled();
  await fireEvent.press(button);
  expect(await screen.findByText('Attendance saved')).toBeOnTheScreen();
  expect(api.checkIn).toHaveBeenCalledTimes(1);
});

test('the watch pauses while a check-in is being saved', async () => {
  let answer: (result: AttendanceResult) => void = () => {};
  const checkIn = jest.fn(() => new Promise<AttendanceResult>((resolve) => (answer = resolve)));
  await renderHome(fakeApi({ today: jest.fn(async () => today()), checkIn }));
  await fireEvent.press(screen.getByRole('button', { name: 'CHECK IN' }));
  await waitFor(() => expect(checkIn).toHaveBeenCalled());
  expect(fakeState.watchIntervalMs).toBeNull();
  answer(okIn);
  await fireEvent.press(await screen.findByRole('button', { name: 'OK' }));
  await waitFor(() => expect(fakeState.watchIntervalMs).toBe(1000));
});

test('the watch stops in the background and restarts on return', async () => {
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: string) => void);
    return { remove: jest.fn() } as never;
  });
  await renderHome();
  await act(async () => listeners.forEach((l) => l('background')));
  expect(fakeState.watchIntervalMs).toBeNull();
  await act(async () => listeners.forEach((l) => l('active')));
  await waitFor(() => expect(fakeState.watchIntervalMs).toBe(1000));
});

test('with location off the preview says so and offers the settings', async () => {
  fakeState.locationEnabled = false;
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()) }) });
  expect(await screen.findByText('Location is off. Turn it on to see where you are.')).toBeOnTheScreen();
  const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue();
  await fireEvent.press(screen.getByRole('button', { name: 'Location settings' }));
  expect(sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
  expect(fakeState.watchIntervalMs).toBeNull();
  expect(screen.getByRole('button', { name: 'CHECK IN' })).toBeEnabled();
});

test('no site: no preview and no watch', async () => {
  await renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ site: null })) }) });
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  expect(screen.queryByText('Looking for your location…')).toBeNull();
  expect(fakeState.watchIntervalMs).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/attendance/preview src/screens/worker/HomeScreen`
Expected: FAIL. `./preview` does not exist; the Home tests time out waiting for `watchIntervalMs` to be 1000. The earlier Home tests still pass.

- [ ] **Step 3: Status rule and screen-active hook**

`apps/mobile/src/attendance/preview.ts`:

```ts
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
```

`apps/mobile/src/native/useScreenActive.ts`:

```ts
import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

/**
 * True while the screen is focused and the app is in the foreground.
 * Outside a navigator (unit tests) the screen counts as focused.
 */
export function useScreenActive(): boolean {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [foreground, setForeground] = useState(true);

  useEffect(() => {
    if (!navigation) return;
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  return focused && foreground;
}
```

- [ ] **Step 4: Text**

In `apps/mobile/src/i18n/en.json`, add inside `home` after `"noSiteBody": …` (add the comma):

```json
    "preview": {
      "finding": "Looking for your location…",
      "inside": "Inside the site · {{distance}} m from the centre · ±{{accuracy}} m",
      "outside": "Outside the site · {{distance}} m away",
      "imprecise": "Getting a precise location… ±{{accuracy}} m",
      "mock": "A fake-location app is on. Check-ins will be flagged.",
      "centre": "Centre the map",
      "locationOff": "Location is off. Turn it on to see where you are.",
      "permission": "Allow precise location to see where you are.",
      "locationSettings": "Location settings",
      "appSettings": "App settings"
    }
```

- [ ] **Step 5: The preview component**

`apps/mobile/src/screens/worker/LocationPreview.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { previewStatus, type PreviewStatus } from '../../attendance/preview';
import { LeafletMap } from '../../maps/LeafletMap';
import { useLiveFix } from '../../native/liveLocation';
import { ensureLocationReady, openAppSettings, openLocationSettings, type LocationProblem } from '../../native/location';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Text } from '../../ui/Text';

interface Props {
  site: { lat: number; lng: number; radiusM: number };
  maxAccuracyM: number;
  /** false while the screen is hidden, the app is in the background, or a check-in is being saved. */
  active: boolean;
}

const MAP_HEIGHT = 200;

const DOT: Record<PreviewStatus['kind'], string> = {
  inside: colors.checkIn,
  outside: colors.checkOut,
  imprecise: colors.warnBorder,
  finding: colors.muted,
};

/** Where the worker is right now, against their site's circle. It only informs: the check-in button never depends on it. */
export function LocationPreview({ site, maxAccuracyM, active }: Props) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  const [ready, setReady] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    ensureLocationReady()
      .then((p) => {
        if (cancelled) return;
        setProblem(p);
        setReady(p === null);
      })
      .catch((err: unknown) => console.warn('preview: location check failed', err));
    return () => {
      cancelled = true;
    };
  }, [active]);

  const fix = useLiveFix(active && ready);

  if (problem) {
    const off = problem === 'LOCATION_OFF';
    return (
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="pin" color={colors.checkOut} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {t(off ? 'home.preview.locationOff' : 'home.preview.permission')}
          </Text>
        </View>
        <Button
          label={t(off ? 'home.preview.locationSettings' : 'home.preview.appSettings')}
          variant="secondary"
          onPress={() => (off ? openLocationSettings() : openAppSettings()).catch((e: unknown) => console.warn(e))}
        />
      </Card>
    );
  }

  const status = previewStatus(fix, site, maxAccuracyM);
  const line =
    status.kind === 'inside'
      ? t('home.preview.inside', { distance: status.distanceM, accuracy: status.accuracyM })
      : status.kind === 'outside'
        ? t('home.preview.outside', { distance: status.distanceM })
        : status.kind === 'imprecise'
          ? t('home.preview.imprecise', { accuracy: status.accuracyM })
          : t('home.preview.finding');

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View>
        <LeafletMap
          testID="preview-map"
          center={{ lat: site.lat, lng: site.lng }}
          radiusM={site.radiusM}
          height={MAP_HEIGHT}
          me={fix ? { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM } : null}
          follow
          recenterKey={recenterKey}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.preview.centre')}
          onPress={() => setRecenterKey((k) => k + 1)}
          style={{ position: 'absolute', right: 10, bottom: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', elevation: 3 }}
        >
          <Icon name="locate" size={22} />
        </Pressable>
      </View>
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: DOT[status.kind] }} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {line}
          </Text>
        </View>
        {fix?.isMock ? (
          <Text variant="small" color={colors.warnText}>
            {t('home.preview.mock')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
```

- [ ] **Step 6: Put it on the home screen**

In `apps/mobile/src/screens/worker/HomeScreen.tsx`:
- Add the imports `import { useScreenActive } from '../../native/useScreenActive';` and `import { LocationPreview } from './LocationPreview';`.
- After `const inFlight = useRef(false);`, add `const screenActive = useScreenActive();`.
- Directly after `<StatusCard view={view} now={now} />`, add:

```tsx
      {(view.kind === 'checkIn' || view.kind === 'working') && today.site ? (
        <View style={{ marginHorizontal: 20, marginTop: 16 }}>
          <LocationPreview site={today.site} maxAccuracyM={today.maxAccuracyM} active={screenActive && phase.kind === 'idle'} />
        </View>
      ) : null}
```

The hooks above stay before the early returns (`useScreenActive` is called at the top with the other hooks), so the hook order does not change between renders.

- [ ] **Step 7: Run the tests and checks**

Run: `pnpm --filter @ve/mobile test > /tmp/claude-1000/-home-prathmesh-Projects-VE/c9c1f7a9-f2da-4c55-a581-1651b9ba689f/scratchpad/mobile-test.log 2>&1; tail -15 /tmp/claude-1000/-home-prathmesh-Projects-VE/c9c1f7a9-f2da-4c55-a581-1651b9ba689f/scratchpad/mobile-test.log && pnpm --filter @ve/mobile typecheck && pnpm lint`
Expected:
- All mobile tests pass, including preview 3, the 7 new Home tests, and the untouched `WorkerNavigator` test (its `today` has `site: null`, so no preview is drawn).
- Typecheck and lint clean.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src
git commit -m "show workers where they are before checking in"
```

---

### Task 13: Check everything on real devices, then open the PR

No new code unless a check fails. A failure found here gets a failing test first, then the fix, then a commit (one line, at most 10 words, plain words).

**Files:** none, unless a check fails.

- [ ] **Step 1: Full local check set** (this replaces GitHub CI; Postgres `ve-db-1` must be up)

Run, redirecting each to the scratchpad and reading the tail:

```bash
S=/tmp/claude-1000/-home-prathmesh-Projects-VE/c9c1f7a9-f2da-4c55-a581-1651b9ba689f/scratchpad
pnpm install --frozen-lockfile > $S/ci-install.log 2>&1 && \
pnpm lint > $S/ci-lint.log 2>&1 && \
pnpm typecheck > $S/ci-typecheck.log 2>&1 && \
pnpm test > $S/ci-test.log 2>&1 && \
pnpm --filter @ve/api build > $S/ci-api-build.log 2>&1 && \
pnpm --filter @ve/web build > $S/ci-web-build.log 2>&1 && \
pnpm --filter @ve/web e2e > $S/ci-e2e.log 2>&1 && \
pnpm --filter @ve/mobile test > $S/ci-mobile.log 2>&1 && \
(cd apps/mobile/android && VE_API_URL=https://api.example.invalid ./gradlew assembleRelease --no-daemon -q > $S/ci-apk.log 2>&1) && \
apps/mobile/scripts/check-apk-size.sh apps/mobile/android/app/build/outputs/apk/release 20 && echo ALL-GREEN
```

Expected: `ALL-GREEN`. On failure, read the tail of the log that stopped the chain.

- [ ] **Step 2: Browser check against the real API** (the dev servers for API and web are running)

With the Playwright browser tools, logged in as the seeded admin:
1. **New site:**
   - Open New site. There is no pin, Save is disabled, and the map is taller than 480 px.
   - Click "Use my location". On this laptop, expect the imprecise message and the pin not moving (Review Focus 2).
2. **Paste:**
   - Paste `17.416682, 78.366365`: the pin moves.
   - Paste a real `https://maps.app.goo.gl/…` share link, which the user supplies or which is copied from Google Maps on the phone. The pin moves to the place (Review Focus 1).
   - Paste `https://www.google.com/maps/@17.4167,78.3664,15z`: the "area, not a pin" message appears.
3. **Sites tab:**
   - The map is on the left and the list on the right.
   - Hovering a row lights its circle; clicking a pin highlights its row.
   - At 800 px wide, the map sits on top.
4. **Today:**
   - Create an employee whose name is `<b>x</b>` and check them in through the API (curl, with an employee token). The tag shows the literal text `<b>x</b>`, not bold (Review Focus 4).
   - Zoomed out, tags merge into a site bubble.
   - "Also show finished today" adds grey tags.
   - Clicking a tag opens the day panel.
5. **Build output:** the favicon shows in the tab, and the network panel shows the Leaflet chunk loading only on map pages.

Take one screenshot per page into the scratchpad.

- [ ] **Step 3: APK on the phone**

1. **Build:** build the release APK with the ngrok URL (ngrok is already running: `grep -o 'https://[^"]*ngrok-free.dev' <scratchpad>/ngrok.log | head -1`), for example `cd apps/mobile/android && VE_API_URL=<ngrok url> ./gradlew assembleRelease --no-daemon -q`.
2. **Deliver:** send the arm64 APK to the user with SendUserFile.
3. **Ask the user to check:**
   - The worker home shows the map with a blue dot. Walking outside the circle turns the line orange, and CHECK IN still works and is decided by the server.
   - Leaving the app and coming back restarts the dot (Review Focus 5).
   - The admin → New site screen starts without a pin; "Use my location" shows ±N m; pasting a Google Maps share link from the phone places the pin.
4. **Wait for their report.** Fix anything they find, test first.

- [ ] **Step 4: Rebase check, push and open the PR**

```bash
git fetch origin && git log --oneline HEAD..origin/main
```

- If this lists commits, run `git rebase origin/main`. If a conflict is not trivial, stop and ask the user.
- If you rebased, re-run Step 1.
- Then run `git push -u origin feat/location-and-maps` (use `--force-with-lease` only if the branch was pushed before the rebase).

Open the PR against `main` with `gh pr create`. The body must be under 2000 characters (check with `wc -c`) and must not carry any attribution line. It covers:
- **What changed and the features:**
  - the accuracy gate on site pins (web and app)
  - no placeholder pin
  - paste from Google Maps (`POST /admin/places/resolve-link`)
  - the tall editor map
  - the Sites map + list
  - the worker live preview (new native watch)
  - the Today check-in map (`mapDays`)
  - "Set by an admin", the favicon, and code splitting
- **Decisions:**
  - C: check-in positions only, no tracking.
  - Paste is resolved by the server with an allowlist.
  - The preview only warns; the server decides.
  - The worker app now loads OSM tiles.
- **Reviewer notes:** the local check results (GitHub CI is off); the phone check results; the OSM tile policy risk; follow-ups (live tracking, the user's bug list).

**Do not merge.** Report the PR URL and the local check results to the user.

---
