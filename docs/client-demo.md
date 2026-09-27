# Client demo: backend on this laptop, dashboard on Vercel, app as an APK

```
Phone app (APK) ──────────────► ngrok tunnel ──► API on this laptop ──► Postgres (docker)
Browser ──► Vercel dashboard ──► /backend/* proxy ──┘
```

The dashboard calls `/backend/...` on its own Vercel domain, and `apps/web/api/proxy.ts` forwards those calls to the API.
This proxy is needed because admins stay signed in with a same-site cookie. A browser never sends that cookie from
`*.vercel.app` to the ngrok address, so without the proxy every page reload would log the admin out.

Everything below runs from the repo root.

## One-time setup

1. **ngrok**
   - Log in once: `ngrok config add-authtoken <token>`.
   - In the ngrok dashboard, note your free static domain, e.g. `name.ngrok-free.dev`. It stays the same on every
     restart, so an APK built for it keeps working.
2. **Vercel project**
   - Import the GitHub repo.
   - Set **Root Directory** to `apps/web`, and leave "Include files outside the root directory" on.
   - `vercel.json` already sets the install command, build command and output folder, and the page rewrites.
   - Environment variable: `BACKEND_URL` = `https://name.ngrok-free.dev`, for Production and Preview.
   - Deploy.
   - Optional: rename the project or add a domain, e.g. `acme-hr.vercel.app`.

## Before each demo (about 10 minutes)

1. Start the backend, and keep this laptop awake and plugged in (turn off sleep, don't close the lid):
   ```bash
   docker start ve-db-1
   pnpm --filter @ve/api dev
   ngrok http 3000 --url https://name.ngrok-free.dev
   ```
2. Check the chain end to end:
   ```bash
   curl https://name.ngrok-free.dev/health                  # API through the tunnel
   curl https://<project>.vercel.app/backend/health         # API through the Vercel proxy
   ```
   Open `https://<project>.vercel.app`, log in, then reload the page. You should still be logged in.
3. Get the data ready: sites, workers and a few days of attendance that look real for this client.
   Create an admin for the client with:
   ```bash
   ADMIN_PASSWORD='at-least-10-chars' pnpm --filter @ve/api seed:admin --email demo@client.com --name "Client Admin"
   ```
4. Build the APK, and do it **after** running local CI: the CI build writes a dummy address into the same folder.
   ```bash
   cd apps/mobile/android
   JAVA_HOME=$HOME/.local/jdk/current ANDROID_HOME=$HOME/Android/Sdk \
     VE_API_URL=https://name.ngrok-free.dev ./gradlew assembleRelease --no-daemon
   unzip -p app/build/outputs/apk/release/app-arm64-v8a-release.apk | grep -ao 'name.ngrok-free.dev' | head -1
   ```
   - Send `app-arm64-v8a-release.apk`. It fits almost every current Android phone.
   - Use `app-armeabi-v7a-release.apk` for very old phones.
   - The client has to allow "Install unknown apps" for their browser or file manager.

## Several clients

- **Separate dashboards:** make one Vercel project per client from the same repo, e.g. `acme-hr` and `zenith-hr`,
  each with the same `BACKEND_URL`. Each client gets a link with their own name, and code changes redeploy all of them.
- **Shared data:** all clients share one database, because there is only one backend.
  - Demo to one client at a time, and set up that client's data before their session.
  - Or keep one neutral demo company for everyone.
  - Two clients who try the app at the same time will see each other's changes.
- **Same APK for everyone,** because the ngrok domain never changes.
- **When a client goes past a demo:** host the API and Postgres (e.g. Railway or Render, plus Neon), point that
  client's `BACKEND_URL` and APK at it, and their data is separate from then on.

## If something breaks

| Symptom | Check |
| --- | --- |
| App says "No internet" | Is ngrok running? `curl https://name.ngrok-free.dev/health` |
| Dashboard login fails with a server error | Run `curl https://<project>.vercel.app/backend/health`. A 502 means the laptop, the API or ngrok is down; a 500 means `BACKEND_URL` is missing in Vercel. |
| Dashboard logs out on reload | The page must be opened from the Vercel domain, not the ngrok one |
| Map tiles are missing | The client's network blocks `tile.openstreetmap.org` |

## Limits of this setup

- The demo stops the moment this laptop sleeps, loses internet, or the API or ngrok process stops.
- The free ngrok plan has monthly request limits. A few demos are fine; a client using it daily is not.
