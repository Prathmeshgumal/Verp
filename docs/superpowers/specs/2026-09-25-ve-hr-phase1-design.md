# VE HR — Phase 1 Design Spec

**Date:** 2026-09-25
**Status:** Draft — awaiting review
**Scope:** Employee accounts, authentication, geofenced attendance (check-in / check-out), admin attendance management, work sites with maps.

---

## 1. Goals and constraints

**Goal.** A reliable, tamper-resistant GPS attendance system for a construction business of ~50 employees. Attendance feeds pay, so correctness and auditability outrank features.

**Success criteria**

- An employee can open the app and record attendance with one tap, with no technical language shown at any point.
- Every attendance record has a server timestamp, a location, a distance from the site, and a full attempt trail.
- An employee cannot record attendance for someone else, from outside the site, or twice.
- Admins can see who is working now, filter history, fix missed checkouts with an audit trail, and export CSV for manual payroll.
- The app runs on Android 10+ on low-end phones.
- Only free / open-source map services; no Google Maps.

**Users**

| Role | Surfaces | Created by |
|---|---|---|
| Admin | Web dashboard + mobile app (admin mode) | Developer seed script (`pnpm seed:admin`); no self-registration |
| Employee | Mobile app only | Admin |

**Out of scope for Phase 1:** payroll calculation, leave, shifts, breaks, multiple sessions per day, performance management, complex reporting, offline attendance, push notifications from the server, satellite map imagery, Hindi/Marathi translations (infrastructure only), shifts crossing midnight.

## 2. Decisions log

| # | Decision | Reason |
|---|---|---|
| D1 | TypeScript end-to-end: Fastify API, React web, React Native CLI mobile, shared package | One language; shared validation schemas, API types and error codes |
| D2 | Own API owns all business rules; Supabase used only as managed Postgres | Testable rules in one place; PIN auth doesn't fit Supabase Auth; no vendor lock-in |
| D3 | Employee login: phone + 6-digit admin-issued PIN, stays logged in (180-day sliding) | Low-literacy friendly, free (no SMS), typed once per phone |
| D4 | No device binding; device ID logged on every attempt | Owner's choice; shared-phone patterns are visible to admins via logs |
| D5 | Online-only attendance with clear failure + retry; schema leaves room for offline later | Sites usually have usable 4G; no backdating possible |
| D6 | Missed checkout → local reminder notification at 7 PM, then auto-mark `MISSED_CHECKOUT` at 00:05; admin fixes with reason | Never invent hours; no push server needed |
| D7 | Mock GPS is flagged for review, never blocked | Owner's choice; workers are never stuck |
| D8 | English only at launch, i18n infrastructure in place | Hindi and Marathi to follow |
| D9 | Geofence radius belongs to the **site**, not the employee; employee is assigned to one site | Consistent geofence per site; multi-site later via join table |
| D10 | Check-out also requires being inside the geofence | Prevents checking out from home to inflate hours |
| D11 | Leaflet + OpenStreetMap tiles + Nominatim search; mobile admin map via WebView; no map in worker UI | Free, no API keys or billing; lightweight worker app |
| D12 | Hosting deferred | Design assumes only "Postgres + a long-running Node process" |

## 3. Architecture

```
┌──────────────────┐   ┌────────────────────┐
│ Mobile app (RN)  │   │ Web dashboard (SPA)│
│ worker + admin   │   │ admin only         │
└────────┬─────────┘   └─────────┬──────────┘
         │ HTTPS / JSON          │
         └──────────┬────────────┘
             ┌──────▼───────┐
             │ Fastify API  │  auth · RBAC · validation · geofence · attendance rules · jobs
             └──────┬───────┘
                    │ SQL (Drizzle)
             ┌──────▼───────┐
             │ PostgreSQL   │  (Supabase-managed; RLS on, no policies)
             └──────────────┘
```

Mobile and web talk **only** to the API. Neither touches the database or Supabase APIs directly.

### Repository layout (pnpm workspaces, `node-linker=hoisted`)

```
apps/api          Fastify + Drizzle ORM + pino
  src/app.ts, src/server.ts
  src/config/                 env parsed and validated with zod at startup
  src/db/                     drizzle schema, migrations (committed), client
  src/modules/<name>/         routes.ts → service.ts → repo.ts
     auth, employees, sites, attendance, dashboard, settings
  src/lib/geo.ts              haversine distance, geofence evaluation (pure)
  src/lib/workdate.ts         UTC instant → work date in company timezone (pure)
  src/lib/audit.ts            audit log writer
  src/plugins/auth.ts         access-token verification, requireRole()
  src/jobs/close-missed-checkouts.ts
apps/web          React + Vite + Mantine admin SPA
apps/mobile       React Native CLI app
packages/shared   zod schemas, API request/response types, error code enum
docker-compose.yml  local Postgres (same major version as Supabase)
```

**Layering rule:** routes do HTTP only (parse, call service, map result to response). Services hold business rules and own transactions. Repos hold SQL only. `lib/geo` and `lib/workdate` are pure and have no I/O.

## 4. Data model

All IDs are UUIDs. All timestamps are `timestamptz`, stored in UTC and **set by the server**. `work_date` is a `date` computed from the server time in the company timezone (default `Asia/Kolkata`).

### `users`

| Column | Notes |
|---|---|
| id | uuid PK |
| role | enum `admin` \| `employee` |
| name | required |
| phone | unique, E.164; required for employees |
| employee_code | unique, nullable |
| email | unique, nullable; required for admins |
| pin_hash | argon2id; employees |
| password_hash | argon2id; admins |
| site_id | FK → sites, nullable (employees) |
| is_active | bool, default true |
| failed_logins | int, default 0 |
| locked_until | timestamptz, nullable |
| created_at, updated_at | |

### `sites`

| Column | Notes |
|---|---|
| id | uuid PK |
| name | required |
| address | nullable |
| lat, lng | `double precision`, validated ranges |
| radius_m | int, default from settings (50), allowed 10–1000 |
| is_active | bool |
| created_at, updated_at | |

### `attendance_days`: the authoritative record payroll will read

| Column | Notes |
|---|---|
| id | uuid PK |
| employee_id | FK → users |
| work_date | date |
| site_id | FK → sites (snapshot of the site at check-in) |
| status | enum `CHECKED_IN` \| `COMPLETED` \| `MISSED_CHECKOUT` |
| check_in_at | timestamptz |
| check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m | |
| check_out_at | nullable |
| check_out_lat, check_out_lng, check_out_accuracy_m, check_out_distance_m | nullable |
| worked_minutes | int, nullable; set on checkout or admin fix |
| flags | text[] (e.g. `MOCK_LOCATION`, `CLOCK_MISMATCH`, `ADMIN_CORRECTED`) |
| needs_review | bool |
| reviewed_by, reviewed_at | nullable |
| created_at, updated_at | |

**Constraint:** `UNIQUE (employee_id, work_date)`.

### `attendance_events`: append-only log of every attempt, including rejections

| Column | Notes |
|---|---|
| id | uuid PK |
| employee_id | FK |
| attendance_day_id | FK, nullable (null when rejected before a day row exists) |
| type | enum `IN` \| `OUT` |
| result | enum: `ACCEPTED`, `OUTSIDE_SITE`, `LOW_ACCURACY`, `ALREADY_CHECKED_IN`, `ALREADY_CHECKED_OUT`, `NOT_CHECKED_IN`, `NO_SITE` |
| server_time | timestamptz |
| device_time | timestamptz, as reported (informational only) |
| lat, lng, accuracy_m, distance_m | |
| is_mock | bool, as reported by Android |
| device_id, device_model, app_version, ip | |
| idempotency_key | uuid, **UNIQUE** |
| response_body | jsonb: stored response, replayed for duplicate keys |

### `sessions`

`id, user_id, refresh_token_hash, device_id, device_model, user_agent, created_at, last_used_at, expires_at, revoked_at, replaced_by`

### `audit_logs`

`id, actor_id, action, entity_type, entity_id, before jsonb, after jsonb, reason, created_at`

### `company_settings` (single row)

`timezone ('Asia/Kolkata'), max_accuracy_m (50), default_radius_m (50), reminder_time ('19:00'), clock_mismatch_minutes (10)`

### Future extensions (all additive, none built in Phase 1)

`pay_rates (employee_id, type hourly|daily, amount, effective_from)`, `shifts`, `leaves`, `attendance_corrections`, `employee_sites` (multi-site join; `attendance_days.site_id` already snapshots the site), `attendance_sessions` (multiple sessions per day; `attendance_days` becomes their aggregate), and an offline `source` column on events.

## 5. Attendance flow

### Mobile home states (from `GET /me/today`)

| State | UI |
|---|---|
| Not checked in | Big green **CHECK IN** button |
| `CHECKED_IN` | "Working since 9:02" + big orange **CHECK OUT** button |
| `COMPLETED` | "✅ Done: 9:02 – 6:15 · 9h 13m" |
| Yesterday `MISSED_CHECKOUT` | Informational banner: "You did not check out yesterday. Tell your supervisor." |

### Client sequence (check-in and check-out are identical)

1. On tap, generate a UUID `idempotency_key` and persist it (MMKV) with the action type **before** any network call. Reuse it on every retry until a final (non-network) response arrives, including after app crash or force-close. On next launch, a pending key is resumed automatically.
2. Check location services are on and request foreground location permission (every tap; this covers Android 11 "only this time"). On Android 12+, if only approximate location was granted, show the "allow precise location" message.
3. Watch position with high accuracy for up to 20 s (show "Finding your location…"). Stop early when accuracy ≤ `max_accuracy_m`. Keep the best reading.
4. `POST /attendance/check-in` (or `/check-out`) with header `Idempotency-Key` and body `{ lat, lng, accuracyM, isMock, deviceTime, deviceId, deviceModel, appVersion }`. Timeout is 15 s.

### Server sequence

1. Authenticate the access token and reload the user from the DB. The user must be an active `employee`. **The employee ID comes only from the token.**
2. **Idempotency:** if an event with this key exists for this employee, return its stored `response_body` (same status code). A key reused by a different employee → 409.
3. Validate the body with the shared zod schema (lat −90..90, lng −180..180, accuracy > 0 and ≤ 5000, strict: unknown keys rejected).
4. Load the assigned site. None or inactive → `NO_SITE`.
5. `accuracyM > max_accuracy_m` → `LOW_ACCURACY`.
6. `distance = haversine(point, site)`. `distance > site.radius_m` → `OUTSIDE_SITE` (response includes rounded distance).
7. Transaction:
   - **Check-in:** `INSERT INTO attendance_days … ON CONFLICT (employee_id, work_date) DO NOTHING RETURNING`. No row returned → `ALREADY_CHECKED_IN` (response includes existing times).
   - **Check-out:** `SELECT … FOR UPDATE` today's row. Missing → `NOT_CHECKED_IN`. `COMPLETED` → `ALREADY_CHECKED_OUT`. Else set check-out fields, `worked_minutes = floor((out − in) / 60s)`, `status = COMPLETED`.
   - Compute flags: `is_mock` → `MOCK_LOCATION` + `needs_review = true`; `|deviceTime − serverTime| > clock_mismatch_minutes` → `CLOCK_MISMATCH` (informational).
   - Insert `attendance_events` with result and `response_body`, for **every** outcome, including rejections from steps 4–6.
8. Respond `{ code, serverTime, day? , distanceM? }`.

Concurrent duplicate requests are safe twice over: the unique idempotency key and the unique `(employee_id, work_date)` constraint.

### Ambiguous network outcomes

On a timeout or connection error, the app shows "Checking…", calls `GET /me/today` to see whether the action landed, and otherwise retries with the **same** key. The worker only ever sees "Saved ✅" or "Not saved: try again".

### Missed checkout

- **Reminder:** on a successful check-in the app schedules a local notification (Notifee) at `reminder_time` for today. A successful check-out cancels it. No server push.
- **Auto-close job:** runs at 00:05 company time via an in-process scheduler, **and once at API startup** to catch missed runs. It runs `UPDATE attendance_days SET status='MISSED_CHECKOUT', needs_review=true WHERE status='CHECKED_IN' AND work_date < today`. It is idempotent, and `worked_minutes` stays null.
- **Admin fix** (web only): enter the checkout time (must be after check-in and on the same work date) plus a required reason. This sets `COMPLETED`, computes minutes, adds the `ADMIN_CORRECTED` flag and writes `audit_logs`.

### Result codes → employee messages (icon + short text + one action)

| Code | Message |
|---|---|
| `OK` | ✅ Attendance saved, 9:02 AM |
| `LOCATION_OFF` / `PERMISSION_DENIED` (client) | 📍 Turn on location → [Open settings] |
| `PRECISE_LOCATION_REQUIRED` (client, Android 12+) | 📍 Allow *precise* location → [Open settings] |
| `LOW_ACCURACY` / no fix in 20 s | 📡 Can't find you clearly. Step outside and try again |
| `OUTSIDE_SITE` | 🚧 You are 120 m away from the site |
| `ALREADY_CHECKED_IN` / `ALREADY_CHECKED_OUT` | ℹ️ Already done today (shows times) |
| `NOT_CHECKED_IN` | ℹ️ You have not checked in today |
| `NO_SITE` / `ACCOUNT_INACTIVE` | 🙋 Please contact your supervisor |
| Network / timeout / 5xx | 📶 Not saved, no internet → [Try again] |

Raw errors, HTTP statuses and exceptions are never shown; they go to the device log only.

## 6. Authentication and security

**Credentials**
- Employees use phone + 6-digit numeric PIN. The admin generates the PIN, which is shown once. Admins use email + password (min 10 chars).
- Hashing is argon2id.
- Lockout: 5 consecutive failures → locked 15 min. `@fastify/rate-limit` on login endpoints per IP and per identifier. Admins can view and unlock locked accounts.

**Tokens**
- Access token: JWT, 15 min, claims `sub`, `role`, `sid`.
- Refresh token: 256-bit random, stored hashed in `sessions`, rotated on every refresh. Reuse of a rotated token revokes the session. Lifetime is 180 days sliding (employees) or 30 days (admins).
- Mobile stores tokens in the Android Keystore via `react-native-keychain`.
- Web keeps the refresh token in an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/auth` and the access token in memory only.
- PIN reset, deactivation and "log out everywhere" revoke all of that user's sessions.

**Authorization**
- `requireRole('admin')` on all `/admin/*`.
- Employee endpoints take no employee identifier; they act on `sub` only.
- Attendance and admin endpoints reload the user so deactivation is immediate.
- The API never trusts client-supplied employee ID, timestamp, role or status. Coordinates are validated and geofenced server-side; the mock flag and device time are informational only.

**Validation and transport**
- Shared zod schemas with strict objects.
- HTTPS only (Android `usesCleartextTraffic=false`).
- `@fastify/helmet`; CORS allowlist = web dashboard origin.
- pino with redaction of `pin`, `password`, tokens, `authorization`, cookies and precise coordinates.

**Database**
- The API uses a dedicated Postgres role.
- RLS is **enabled with no policies** on all tables so Supabase's auto-generated REST/GraphQL APIs expose nothing, even with a leaked anon key.
- Secrets come only from env vars, validated at startup.

**Audit**
- Every admin mutation writes `audit_logs`: employee create/edit/deactivate, PIN reset, session revoke, unlock, site create/edit, attendance fix/review, settings change.

## 7. API

All endpoints are JSON. Errors are `{ code, message }` with `code` from the shared enum.

```
Auth       POST /auth/employee/login        { phone, pin, deviceId, deviceModel }
           POST /auth/admin/login           { email, password }
           POST /auth/refresh               POST /auth/logout

Employee   GET  /me       GET /me/today      GET /me/attendance?from&to (max 31 days)
           POST /attendance/check-in        POST /attendance/check-out   (Idempotency-Key header)

Admin      GET  /admin/dashboard/today
           GET|POST  /admin/employees       GET|PATCH /admin/employees/:id
           POST /admin/employees/:id/reset-pin
           POST /admin/employees/:id/revoke-sessions
           POST /admin/employees/:id/unlock
           GET|POST  /admin/sites           GET|PATCH /admin/sites/:id
           GET  /admin/attendance?from&to&employeeId&siteId&status&needsReview&page&pageSize
           GET  /admin/attendance/:id       (includes attendance_events)
           PATCH /admin/attendance/:id/checkout   { checkOutAt, reason }
           POST /admin/attendance/:id/review
           GET  /admin/attendance/export.csv  (same filters)
           GET|PATCH /admin/settings

Health     GET  /health
```

## 8. Web dashboard

**Stack:** React + Vite + TypeScript SPA (static build), Mantine UI, mantine-react-table, TanStack Query, React Router, Mantine Form with shared zod schemas, react-leaflet, dayjs with timezone plugin. Next.js was not chosen: the API is separate and SEO is irrelevant, so a second server adds cost without benefit.

| Page | Contents |
|---|---|
| Login | Email + password |
| Dashboard | Cards: active employees, checked in today, working now, completed, not yet in, missed checkouts, needs review. "Working now" list. Refreshes every 60 s. |
| Employees | Searchable list (filters: site, active). Create (name, phone, employee code, site → PIN shown once). Detail: profile, last 30 days, devices/sessions seen, actions (reset PIN, log out everywhere, unlock, deactivate). Edit. |
| Sites | List; create/edit with map: draggable pin, radius circle + slider, Nominatim search (on submit), "use my location". |
| Attendance | Table with filters (date range defaulting to today, employee, site, status, needs review). Row detail drawer: mini-map with site circle and in/out pins, attempt timeline, flags, actions (fix checkout, mark reviewed). CSV export of current filter. |
| Settings | Timezone, max accuracy, default radius, reminder time, clock-mismatch threshold |

## 9. Mobile app

**Mode selection.** The login screen is dominated by the worker login (phone + PIN, numeric keypad). A small "Admin login" link sits at the bottom. After login, the role in the token decides which navigator mounts; admin screens are never mounted for employees, and the API enforces roles regardless.

**Employee screens:** Home (status + one button + result screen), My attendance (last 30 days, one row per day with icon, times, hours), and a small menu with Log out.

**Admin screens:** Today (dashboard summary), Employees (list, create, view, reset PIN), Sites (list, create/edit with Leaflet map in WebView + "use my location"), Attendance (filter by date/employee, detail view). Attendance fixes and settings are web-only in Phase 1.

**Worker UI rules:** touch targets ≥ 64 dp, one primary action per screen, icon + colour + ≤ 6 words, high contrast, no maps, no heavy animation, all strings via i18next.

**Libraries**

| Need | Library |
|---|---|
| Navigation | `@react-navigation/native-stack` |
| Server state | `@tanstack/react-query` |
| Location + mock detection | `react-native-geolocation-service` (fused provider, `mocked` field; `forceLocationManager` fallback when Play Services is unavailable). **Verify compatibility with current RN during planning.** Fallback: ~100-line Kotlin native module using `FusedLocationProviderClient` / `LocationManager` and `Location.isFromMockProvider()`. |
| Secure storage | `react-native-keychain` |
| Pending idempotency key, cached status | `react-native-mmkv` |
| Device info | `react-native-device-info` |
| Local reminder | `@notifee/react-native` |
| Admin map | `react-native-webview` + bundled Leaflet HTML (postMessage bridge) |
| i18n | `i18next` + `react-i18next` (English; Hindi/Marathi later) |

## 10. Android compatibility (Android 10+)

1. **Build-enforced:** `minSdkVersion 29`; `targetSdkVersion` = current Play requirement. Manifest merger fails the build if a dependency needs a higher minSdk. CI builds a release APK on every push.
2. **Library vetting rule:** a library may be added only if its minSdk is ≤ 29, it supports the project's RN version, and it is actively maintained.
3. **Version-specific behaviour:**
   - Android 10: foreground location only; background location is never requested.
   - Android 11: one-time permission; re-check on every tap.
   - Android 12+: approximate vs precise location; detect approximate and prompt for precise.
   - Android 13+: request `POST_NOTIFICATIONS` only on API 33+.
4. **No-GMS fallback:** use `LocationManager` when Google Play Services is missing or outdated.
5. **Self-contained JS:** Hermes is bundled, so worker screens don't depend on the system WebView. Only the admin map uses the WebView; Leaflet supports old browsers.
6. **Size and performance:** Hermes on, R8/minify on, per-ABI APK splits.
   - APK ≤ 20 MB per ABI
   - cold start ≤ 3 s on the low-end test phone
   - no crash under memory pressure
7. **TLS:** Android 10 supports TLS 1.3 and trusts current Let's Encrypt roots.

**Release test matrix:** emulators on API 29, 30, 31 and 34+, plus one physical phone with 2–3 GB RAM.

## 11. Error handling and logging

- API: one central error handler maps known domain errors to `{ code, message }` with the correct HTTP status. Unknown errors → 500 `INTERNAL`, full detail logged with a request ID, and nothing internal returned.
- Structured pino logs with request ID, user ID, route and latency.
- Every attendance attempt is persisted in `attendance_events` regardless of outcome.
- Mobile: error codes map to i18n messages. Unexpected errors go to the generic "Not saved, try again" with detail kept in a local log only.

## 12. Testing

| Layer | Tests |
|---|---|
| API unit (Vitest) | Haversine and geofence boundaries; accuracy rule; flag computation; work date around midnight IST |
| API integration (Vitest + real Postgres via docker compose) | Check-in/out happy path; **two concurrent check-ins → exactly one row**; idempotent replay returns identical response; key reuse by another employee → 409; outside-site / low-accuracy rejections logged as events; check-out without check-in; double check-out; employee blocked from `/admin/*`; lockout after 5 failures; refresh rotation and reuse detection; deactivation revokes sessions; missed-checkout job idempotent; admin fix writes audit log |
| Web | Playwright smoke: log in → create site → create employee → view attendance → export CSV |
| Mobile | Jest: home state machine, error-code → message mapping, pending-key resume. **Manual checklist** on the release matrix: GPS off, permission denied, approximate-only, airplane mode, force-close mid-request, fake GPS app, wrong device clock, outside radius, double tap, no Play Services |
| CI (GitHub Actions) | Lint, typecheck, unit and integration tests, web build, Android release build |

## 13. Maps and licensing

- **Tiles:** OpenStreetMap standard tiles, used only on admin screens (low volume), with visible "© OpenStreetMap contributors" attribution and no bulk prefetching, per the OSM Tile Usage Policy. The tile URL is a config value so it can be switched (e.g. MapTiler free plan with hard cap, or self-hosted) without code changes.
- **Geocoding:** Nominatim, search-on-submit only (≤ 1 req/s), with an identifying User-Agent/Referer and attribution.
- **Worker app:** no map. The geofence check is pure maths on stored coordinates.

## 14. Deferred / open items

- Hosting provider and backup schedule (deferred by owner). The design requires Postgres + one always-on Node process; note that sleeping free tiers add 30–60 s cold starts.
- App distribution (Play Store internal track vs direct APK).
- Hindi and Marathi translations.
- Offline attendance (schema-compatible; not built).
