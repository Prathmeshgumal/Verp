# VE HR: Trustworthy Location and Maps: Design

**Date:** 2026-09-26
**Status:** Approved in conversation; written spec awaiting review
**Builds on:** `docs/superpowers/specs/2026-09-25-ve-hr-phase1-design.md` (the Phase 1 spec). Sections referenced as "P1 §n".

## 1. Why

The first round of testing on a real phone and a laptop surfaced one serious problem and several map gaps:

- **A wrong location can cost a worker pay.** Two cases were found:
  - The app's New site screen opens on a hard-coded Pune point (`DEFAULT_CENTER` in `SiteEditScreen.tsx`), which looks like a location reading.
  - The dashboard's "Use my location" moves the pin to whatever the browser returns. On a laptop with no GPS, that is a Wi-Fi/IP guess that can be kilometres off, and the page shows no accuracy.
- The worker check-in path is not affected: it uses high-accuracy GPS, and the server refuses readings worse than `max_accuracy_m` (P1 §5). But nothing lets the worker see where they are before tapping.
- Admins cannot place a site at a landmark the OpenStreetMap search does not know.
- The dashboard has no map view of the sites or of who is working where.

**Goal:** a location is never used silently. Every reading shows its precision, poor readings are refused where they would set something permanent (a site pin), workers see their position before checking in, and admins get map views of sites and of the working day.

**No GPS can promise every reading is right.** The guarantee this design gives is: *a bad reading never silently becomes a site pin or an accepted check-in.*

## 2. Decisions log

| # | Decision | Why |
|---|---|---|
| D1 | Working-now map shows **check-in positions only**. Live tracking while checked in is a separate, later project. | Live tracking needs a background service, an ongoing notification, "allow all the time" permission and worker consent. That is its own design. (User chose option C.) |
| D2 | Google Maps import = **paste a share link or coordinates**; the server extracts the exact pin. No Google API key. | Free; no billing account; Google's terms tie Places results to Google maps, which would force a map switch. (User chose A.) |
| D3 | The check-in preview **only warns**; the CHECK IN/OUT button always works, and the server decides and records every attempt. | A recorded refused attempt is evidence for pay disputes, and the server's fresh reading may succeed where the preview's did not. (User chose A.) |
| D4 | The "use my location" accuracy gate for site pins = the company's `max_accuracy_m` setting (50 m today). | The same bar workers must meet at check-in; a site pin should be no less precise than the check-ins judged against it. |
| D5 | The phone preview uses the shared `evaluateGeofence` from `@ve/shared`. | Preview and server can never disagree on the rule, only on the reading. |
| D6 | The worker app now shows OSM map tiles (reverses P1 §13 "Worker app: no map"). | Needed for the preview. Volume stays small (one screen, a few views per worker per day). The tile URL stays configurable (P1 §13) so the app can move to a paid or self-hosted tile server if the worker count grows. |

## 3. Scope

**In scope**
1. Location accuracy shown everywhere a reading is used; accuracy gate for site pins (web and app).
2. No placeholder location on new sites (web and app).
3. "Paste from Google Maps" on the site editor (web and app), with a new API endpoint.
4. Taller site-editor map (web).
5. Sites tab: map of all sites + list (web).
6. Check-in / check-out preview map with live position and inside/outside status (worker app).
7. Working-now map on the Today page (web), with a small API change.
8. Carry-overs: "Set by an admin" in the day panel after a fixed check-out, a favicon, and route-level code splitting for the web bundle.

**Out of scope:** live tracking (D1); the Google Places API or Google tiles (D2); a map on the app's admin Today screen; offline tile caching; "Share → VE HR" from Google Maps (a possible follow-up to D2); general polish and the user's bug list, which will be added to the plan when it arrives.

## 4. Location readings and the accuracy gate

### 4.1 One rule for "a usable reading"

A reading is `{ lat, lng, accuracyM }`. A reading is **precise enough for a site pin** when `accuracyM ≤ max_accuracy_m` (D4). The threshold comes from company settings, already loaded by both clients.

### 4.2 Web: "Use my location" (`SiteEditPage`)

- Use `navigator.geolocation.watchPosition` with `enableHighAccuracy: true, maximumAge: 0` for up to **20 s**, keeping the most accurate reading. Stop as soon as a reading meets the gate, or at the deadline.
- While waiting: button shows a loader and the text *"Getting your location… ±N m"* (live best accuracy).
- **Gate met:** move the pin, draw an accuracy ring (a light circle of radius `accuracyM`) until the pin moves, and show *"Your location · accurate to ±N m"*.
- **Gate not met at the deadline:** the pin does **not** move. Show: *"Your location is only accurate to ±N m, more than the ±M m allowed. Search, paste from Google Maps, or drag the pin."* On a laptop this is the expected outcome and the message says so: *"Laptops usually cannot tell their exact position."*
- Errors (permission refused, unavailable) keep the current messages.

### 4.3 App: "Use my location" (`SiteEditScreen`)

- Keep `getBestFix(target, 20 s)`, but pass `target = maxAccuracyM` from settings instead of the hard-coded 20, and apply the same gate and messages as 4.2 (translated through the app's i18n).
- Show the reading's accuracy under the coordinates: `17.41668, 78.36637 · ±8 m`.

### 4.4 No placeholder pin on new sites

- **Web and app:** a new site starts with **no pin and no circle**. The map shows a zoomed-out view of the company's existing sites, or of India if there are none. Overlay text: *"Set the location: search, paste from Google Maps, use my location, or tap the map."*
- Tapping or clicking the map places the pin there.
- **Save is disabled until a pin exists.** Latitude/longitude fields (web) are empty rather than pre-filled.
- Editing an existing site is unchanged: it opens on the saved pin.

## 5. Paste from Google Maps

### 5.1 User flow (web and app)

A **"Paste from Google Maps"** field sits under the place search, with a help line: *"In Google Maps, tap Share → Copy link, or long-press the spot to copy its coordinates."* On paste (or Enter), the client:

1. Tries to parse **plain coordinates** locally (5.3). If they parse, it moves the pin; there is no server call.
2. Otherwise, sends the text to `POST /admin/places/resolve-link`.
3. On success, moves the pin, zooms to street level and shows *"From Google Maps · check the circle before saving."* On failure, shows the server's message and leaves the pin unchanged.

### 5.2 API: `POST /admin/places/resolve-link`

- **Auth:** admin only (same guard as other `/admin` routes). **Rate limit:** 30/min per IP address.
- **Body:** `{ text: string }` (1–2000 chars, strict schema).
- **Success 200:** `{ lat: number, lng: number, precision: 'pin' }`.
- **Failure 422:** `{ code, message }`, where `code` is one of:
  - `NOT_A_MAPS_LINK`: *"That doesn't look like a Google Maps link or coordinates."*
  - `NO_EXACT_PIN`: *"This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link."*
  - `LINK_UNREACHABLE`: *"Couldn't open that link. Check it, or copy the coordinates instead."*
- **Resolution:**
  1. Extract the first URL from `text`, or treat `text` as coordinates (5.3) and return them.
  2. **Host allowlist (SSRF guard):** `maps.app.goo.gl`, `goo.gl` (path `/maps/...` only), `maps.google.com`, `www.google.com` and `google.<tld>` with path starting `/maps`. Anything else is rejected as `NOT_A_MAPS_LINK`. Only `https:`.
  3. **Short links:** follow redirects manually (`redirect: 'manual'`), at most **5 hops**, each hop re-checked against the allowlist, **5 s** total timeout, no cookies, and the response body is never read. The final URL is what gets parsed.
  4. **Parse, in order of precision** (the first match wins):
     - `!3d<lat>!4d<lng>` in the `data=` part: the place's own pin.
     - `?q=<lat>,<lng>`, `query=<lat>,<lng>`, `/search/<lat>,<lng>`, `/place/<lat>,<lng>`: a dropped pin or coordinates search.
     - `@<lat>,<lng>,<zoom>` **alone** is the map's viewport centre, not a pin → `NO_EXACT_PIN`.
  5. Validate the range (lat −90..90, lng −180..180, not both 0).
- The endpoint logs the resolved host and outcome, never the full link (links can carry personal search text).

### 5.3 Coordinate parsing (`parseCoordinates` in `@ve/shared`)

Accepts, with optional spaces and a comma or space as separator:
- Decimal: `17.416682, 78.366365` and `17.416682 78.366365`.
- Degrees-minutes-seconds as Google shows it: `17°25'00.1"N 78°21'58.9"E` (N/S/E/W handled).

Returns `LatLng | null`. The same function runs in the web app, the phone app and the API.

## 6. Site editor layout (web)

- Two columns as today, but the **map column fills the viewport height** (from below the page header to the bottom, minimum 480 px), with search, paste and "use my location" stacked above the map.
- On screens narrower than 900 px, the form goes below the map, and the map is 60% of the viewport height.

## 7. Sites tab (web)

- **Layout:** the map on the left (about 60%, full height); the site list on the right (about 40%, scrolls independently). Below 900 px, the map (320 px) sits above the list.
- **Map:** every site as a pin plus its radius circle. Inactive sites are grey. The map fits all sites on load.
- **List:** each row shows the site name, address, radius and status, and has an Edit link; "Add site" is at the top.
- **Linking:** hovering a row highlights its circle; clicking a row zooms the map to that site; clicking a pin highlights and scrolls to its row.
- Data: the existing `listSites`. No API change.

## 8. Check-in / check-out preview (worker app)

### 8.1 Live position (native)

- New native methods on `NativeVeDevice`: `startLocationWatch(intervalMs)` and `stopLocationWatch()`, plus an `onLocationUpdate` event (a codegen `EventEmitter`) carrying `{ lat, lng, accuracyM, isMock }`.
- Implementation: the fused provider with `PRIORITY_HIGH_ACCURACY`, interval 1 s, min interval 1 s; the same `LocationManager` fallback as `Locator.bestFix`.
- **Lifecycle:** watch only while the home screen is focused **and** the app is in the foreground. Stop on blur, background, or logout. Nothing is sent to the server by the watch.
- If location is off or permission is missing, the existing `ensureLocationReady` flow shows its messages instead of the map.

### 8.2 Screen

- The **map** takes the top portion of the home screen. It shows the site circle, the worker's position as a blue dot, and an accuracy ring. When the blue dot leaves the visible area, the map refits to show it; a "centre" button fits the circle and the dot again.
- The **status line** is computed with `evaluateGeofence(point, accuracyM, site, maxAccuracyM)` (D5):
  - `ok` → 🟢 *"Inside the site · 23 m from the centre · ±8 m"*
  - `OUTSIDE_SITE` → 🟠 *"Outside the site · 140 m away"*
  - `LOW_ACCURACY` → ⏳ *"Getting a precise location… ±85 m"*
  - No reading yet → ⏳ *"Looking for your location…"* (different from the busy screen's "Finding your location…")
  - `isMock` → a warning line: *"A fake-location app is on. Check-ins will be flagged."*
- The **CHECK IN / CHECK OUT button** and the existing states (checked in, done, missed check-out, no site) are unchanged and **always enabled** (D3). Tapping runs the existing submit flow (fresh `getBestFix`, idempotency key, server decision). The watch pauses during a submit and resumes after.
- **No internet:** tiles fail silently; the circle, dot and status still render on a plain background.
- **Data:** the worker's site `{ lat, lng, radiusM }` and `maxAccuracyM`, both already in `MeTodayResponse` (`site`, `maxAccuracyM`). No API change.

## 9. Working-now map (web, Today page)

### 9.1 API change (additive)

`DashboardTodayDto` gains:

```ts
mapDays: Array<{
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
}>;
```

It covers today's work date in the company time zone: every day with status `CHECKED_IN` or `COMPLETED`. The existing `working` list stays for the table below the map.

### 9.2 Map

- A large map at the top of Today (about 55% of the viewport height), above the existing cards and list.
- Sites are drawn as faint circles.
- Each `CHECKED_IN` day is a **tag at its check-in position**: *"Anil · in 09:05"*. A green tag means no review needed; orange means `needsReview`.
- The switch **"Also show finished today"** adds `COMPLETED` days as grey tags: *"Ravi · 09:02–17:40"*.
- **Grouping:** when zoomed out so that tags overlap, tags group per site into a count bubble: *"Plot 7 · 12 working"*. Clicking a bubble zooms to the site.
- **Clicking a tag** opens the existing attendance day panel for that day.
- The map fits all tags on first load and keeps the user's pan and zoom across the page's 60 s auto-refresh.
- **Empty day:** the map shows the sites and the text *"No one has checked in yet today."*

## 10. Carry-overs

- **"Set by an admin":** when a day has the `ADMIN_CORRECTED` flag, the day panel's check-out card shows *"Set by an admin"* instead of the phone's distance and accuracy, and the map draws no check-out dot. The attempt list still shows every phone attempt.
- **Favicon:** an SVG icon in the brand colours (all current browsers support SVG favicons).
- **Code splitting:** route-level `React.lazy` for every page, with the map pages in their own chunks, so the first load does not download Leaflet. The build must have no chunk warning.

## 11. Error handling

- Every location message names the accuracy in metres and offers a next step (search, paste, drag, or move to open sky).
- `resolve-link` failures never throw to the UI; they map to the three messages in 5.2. Network errors use the existing "Cannot reach the server" message.
- A watch error on the phone shows *"Looking for your location…"* and retries; it never blocks the button.

## 12. Testing

Tests are written first, as in Phase 1.

- **Shared:** `parseCoordinates` (decimal, space-separated, DMS with all hemispheres, junk, out-of-range).
- **API:** `resolve-link`:
  - each URL pattern, from recorded real Google URLs
  - `@` viewport only → `NO_EXACT_PIN`
  - allowlist rejection
  - a redirect to a non-allowed host
  - the hop limit and timeout, using a stubbed fetch
  - auth and rate limit
- **API:** `mapDays` in the dashboard (right day in company time, statuses, coordinates).
- **Web:**
  - the accuracy gate (good reading moves the pin; poor reading does not and shows the message), with a fake `navigator.geolocation`
  - a new site has no pin and Save is disabled
  - paste flow success and each failure
  - Sites tab list↔map linking
  - Today map tags, grouping and "Also show finished"
  - "Set by an admin"
- **App:**
  - status line for each `evaluateGeofence` outcome and for mock locations
  - the button always enabled
  - the watch starts and stops with focus and app state
  - the site-edit gate and the no-pin start
- **Browser check** against the real API, and a **fresh APK** checked on a real phone: preview inside and outside, paste a real Google Maps link.
- **Before the PR:** the full local check set (lint, typecheck, all unit tests, API build, web build and Playwright smoke test, mobile tests, release APK build and size check). GitHub CI is disabled for this project.

## 13. Risks

- **OSM tile policy (D6):** worker phones now load tiles. The tile URL is configurable; move to a paid or self-hosted server before the worker count reaches the hundreds.
- **Google link formats change:** the parser is covered by recorded real URLs; an unknown format fails safely with `NO_EXACT_PIN` or `NOT_A_MAPS_LINK`, never a wrong pin.
- **Battery:** the 1 s watch runs only while the home screen is visible in the foreground.
