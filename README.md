# VE HR

Construction workforce attendance: geofenced check-in/check-out for workers, admin dashboard.

- `packages/shared`: schemas, error codes, DTO types, geo maths (used by API, web, mobile)
- `apps/api`: Fastify + Postgres REST API
- `apps/web`: React admin dashboard (Vite + Mantine)
- `apps/mobile`: React Native Android app (Android 10+) for workers and admins
- Design spec: `docs/superpowers/specs/2026-09-25-ve-hr-phase1-design.md`

## Local setup

Requires Node ≥ 22, Docker, and corepack (`corepack enable`).

```bash
pnpm install
docker compose up -d                      # Postgres on localhost:5433 (dbs: ve, ve_test)
cp apps/api/.env.example apps/api/.env    # set a real JWT_SECRET (≥ 32 chars)
pnpm --filter @ve/api db:migrate
ADMIN_PASSWORD='choose-a-long-password' pnpm --filter @ve/api seed:admin --email you@example.com --name "Your Name"
pnpm --filter @ve/api dev                 # http://localhost:3000/health
```

## Android app

One-time: JDK 17 and the Android SDK (see `docs/superpowers/plans/2026-09-25-ve-hr-mobile.md`, Task 2), then `pnpm --filter @ve/mobile fonts && pnpm --filter @ve/mobile leaflet`.

```bash
adb reverse tcp:3000 tcp:3000              # phone/emulator reaches the local API as localhost:3000
pnpm --filter @ve/mobile start             # Metro
pnpm --filter @ve/mobile android           # build + install the debug app
```

- `VE_API_URL` (default `http://localhost:3000`) and `VE_TILE_URL` (default OSM tiles) are read at build time.
- Release: `VE_API_URL=https://… ./gradlew assembleRelease` in `apps/mobile/android`. The build fails on a non-https URL. Set `VE_KEYSTORE_FILE`, `VE_KEYSTORE_PASSWORD`, `VE_KEY_ALIAS` and `VE_KEY_PASSWORD` to sign with the real key. Without them the APK is debug-signed.
- APKs are split per ABI. Most phones need `app-arm64-v8a-release.apk`.
- Before each release, run `docs/testing/mobile-manual-checklist.md`.

## Admin web dashboard

```bash
cp apps/web/.env.example apps/web/.env    # VITE_API_URL=http://localhost:3000
pnpm --filter @ve/web dev                 # http://localhost:5173 (API must be running)
```

Smoke test (real API + Chromium, uses a throwaway `ve_e2e` database):

```bash
docker compose up -d db
pnpm --filter @ve/web exec playwright install chromium   # once
pnpm --filter @ve/web e2e
```

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test  # API tests need the docker Postgres running
```

## Changing the database

Edit `apps/api/src/db/schema.ts`, then `pnpm --filter @ve/api db:generate --name <change>` and commit the new SQL in `apps/api/drizzle/`.

## Deployment notes

- Needs Postgres (Supabase works: use the direct/session connection string) and one always-on Node process. Sleeping free tiers add 30–60 s cold starts for workers.
- Run `node dist/scripts/migrate.js` (or `pnpm db:migrate`) on each deploy, from `apps/api` so `./drizzle` resolves (or set `MIGRATIONS_DIR`).
- Production env: `NODE_ENV=production`, `COOKIE_SECURE=true`, a random `JWT_SECRET`, `WEB_ORIGIN` = the admin site URL. Set `TRUST_PROXY=true` behind a load balancer so rate limits and logged IPs use the real client IP.
- The web dashboard and API **must share a registrable domain** (e.g. `admin.example.com` + `api.example.com`): the admin refresh cookie is `SameSite=Strict`.
- RLS is enabled on every table with no policies; the API connects as the table owner. Do not use Supabase's anon key from any client.
- The missed-checkout job runs inside the API process (at startup and every 15 minutes). It is idempotent, so running several instances is safe.
- Web: `VITE_API_URL=https://api.example.com pnpm --filter @ve/web build`, then serve `apps/web/dist` as static files, with every unknown path answered by `index.html`. Set the API's `WEB_ORIGIN` to the dashboard's exact origin.
