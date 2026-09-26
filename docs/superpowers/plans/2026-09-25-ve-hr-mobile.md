# VE HR Mobile App Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android app (React Native CLI) that workers use to check in and out with GPS, and that admins use for today's summary, employees, sites and attendance. It talks to the Phase 1 API that is already merged.

**Architecture:**
- `apps/mobile` is a React Native 0.87 CLI app (New Architecture, Hermes) inside the pnpm monorepo. It imports types and zod schemas from `@ve/shared`.
- All device work goes through **one app-local Kotlin TurboModule**, `NativeVeDevice`: location with mock flag, secure storage, plain prefs, device info, the check-out reminder alarm and UUIDs. This replaces five third-party libraries that failed the spec's vetting rule (§10.2).
- Screen logic lives in small pure modules that are unit-tested with Jest: API client, home state, pending key, submit flow and messages. Screens stay thin and are tested with React Native Testing Library.

**Tech Stack:**
- React Native 0.87.1, React 19.2.3, TypeScript 6
- React Navigation 7 (native-stack, bottom-tabs), TanStack Query 5
- i18next 26 and react-i18next 17
- react-native-svg 15, react-native-webview 14, Leaflet 1.9.4 (admin map only)
- Kotlin with Google Play Services Location 21 (and a `LocationManager` fallback)
- Jest 29 and @testing-library/react-native 14

**Spec:** `docs/superpowers/specs/2026-09-25-ve-hr-phase1-design.md`: §5 (attendance flow and messages), §6 (tokens), §9 (mobile app), §10 (Android compatibility) and §12 (testing). Designs are in `docs/design/` (Site Ledger theme, PR #3).

## Global Constraints

- **Android:** `minSdkVersion 29`. `targetSdkVersion` and `compileSdkVersion` stay at the RN 0.87.1 template values (36 and 37). Only foreground location is used; `ACCESS_BACKGROUND_LOCATION` is never requested.
- **Library vetting (spec §10.2):** a library may be added only if its minSdk ≤ 29, it supports RN 0.87 and it is actively maintained. The only runtime dependencies allowed are the ones this plan lists.
- **Versions, pinned exactly:** react-native 0.87.1, react 19.2.3, @react-navigation/native 7.4.1, @react-navigation/native-stack 7.19.2, @react-navigation/bottom-tabs 7.19.2, react-native-screens 4.28.0, react-native-safe-area-context 5.10.0, @tanstack/react-query 5.103.2, i18next 26.4.2, react-i18next 17.0.15, react-native-svg 15.15.5, react-native-webview 14.0.1, leaflet 1.9.4.
- **Package:** the Android application id and Kotlin package are `com.vehr.app`. The npm package name is `@ve/mobile`.
- **Toolchain:** JDK 17 and the Android SDK under `$HOME/Android/Sdk` (`ANDROID_HOME`), with platform 36 and 37, build-tools 36.0.0 and 37.0.0, and NDK 27.1.12297006. Node ≥ 22, pnpm 10.
- **Transport:** debug builds may use cleartext HTTP only through the template's `usesCleartextTraffic` placeholder. Release builds are HTTPS-only, and the build fails unless `VE_API_URL` starts with `https://`.
- **Worker UI (spec §9):**
  - touch targets ≥ 64 dp
  - one primary action per screen
  - icon + colour + ≤ 6 words
  - no maps on worker screens
  - no heavy animation
  - no emoji: icons are stroke SVGs
- **Strings:** every user-visible string comes from i18next (`src/i18n/en.json`). English only in Phase 1. Don't use plural keys: Hermes has no `Intl.PluralRules`.
- **Theme:** Site Ledger tokens exactly as listed in `docs/design/README.md`, set in `src/theme/tokens.ts` (Task 6). Fonts: Archivo 800 for headings, Public Sans for body, IBM Plex Mono for times.
- **Errors:** raw errors, HTTP statuses and exceptions are never shown to a worker (spec §5). Unknown failures show "Not saved, no internet" with Try again. Details go to `console.warn` only.
- **Times** are shown in the phone's local time zone. The company and its phones are in the same zone (IST). Jest runs with `TZ=Asia/Kolkata`.
- **Timeouts:** 15 s per API request, 20 s for a GPS fix (spec §5).
- **Commits:** a single line, at most 10 words, plain words, no body, no trailers or attribution of any kind (user rule). Each task's commit message is given verbatim.
- **Branch:** all work happens on `feat/mobile-app`, cut from an up-to-date `main`. Never commit to main.

## Review Focus

These five inputs are the ones most likely to bite a real person, and no feature test covers them. Each has a named test in the task that owns the code:

1. **A pending check-in key from yesterday**, left by a force-close or dead battery before midnight. It must be thrown away the next day, not replayed. The worker gets a fresh key, and a new day's check-in is never answered with yesterday's stored response. The test is in Task 9: `keyFor discards a pending key from an earlier work date`.
2. **Two API calls that find an expired access token at the same moment**, e.g. the Home screen loading today and history together after the app wakes. They must share **one** refresh request. The API rotates refresh tokens, so a second parallel refresh would burn the session. The tests are in Task 7: `concurrent requests share one refresh` and `two 401s at once trigger one refresh`.
3. **The server saved the check-in but the response was lost** (timeout on a weak signal). The app must confirm through `GET /me/today` and show "Saved". It must never send a second request with a new key. The tests are in Task 10: `timeout after the server saved shows saved without resending` and `timeout retries with the same key`.
4. **Android 12+ user who picks "Approximate" location.** The app must not submit a coarse fix. It shows the "Allow precise location" message with Open settings. The test is in Task 4: `approximate-only permission on Android 12+ asks for precise location`.
5. **Session expired or account deactivated while the app is open**, for example when an admin deactivates a worker mid-shift. The app clears tokens and returns to login with a clear reason. There must be no refresh loop and no crash. The tests are in Task 7 (`refresh rejected ends the session once without retry loop` and `ACCOUNT_INACTIVE ends the session`) and Task 8 (`auth loss returns to login with the reason`).

---

## File Structure

```
apps/api/src/modules/me/service.ts        (Task 1: add timezone to /me/today)
packages/shared/src/types.ts               (Task 1: MeTodayResponse.timezone)
apps/mobile/
  package.json  app.json  index.js  babel.config.js  metro.config.js
  jest.config.js  jest.setup.js  tsconfig.json
  specs/NativeVeDevice.ts                  TurboModule spec (codegen input)
  scripts/fetch-fonts.sh                   downloads OFL fonts into android assets
  scripts/copy-leaflet.mjs                 copies Leaflet into android assets
  scripts/check-apk-size.sh                fails CI if an APK is over 20 MB
  android/…                                RN template + edits listed per task
  android/app/src/main/java/com/vehr/app/device/
    VeDeviceModule.kt  VeDevicePackage.kt  SecureStore.kt  PlainPrefs.kt
    Locator.kt  Reminder.kt  ReminderReceiver.kt
  android/app/src/main/assets/map/         index.html bridge.js leaflet.js leaflet.css
  src/
    App.tsx                                providers + root navigator
    services.ts  storageKeys.ts            client/api/query client; storage key names
    native/device.ts                       typed wrapper over NativeVeDevice
    native/location.ts                     permission + services check + best fix
    native/reminder.ts                     notification permission + schedule/cancel
    testing/fakeNative.ts                  in-memory NativeVeDevice for Jest
    testing/fakeApi.ts  testing/render.tsx testing/webView.ts   test helpers
    api/errors.ts  api/client.ts  api/tokenStore.ts  api/endpoints.ts
    auth/AuthContext.tsx  auth/session.ts  auth/loginErrors.ts
    attendance/format.ts  attendance/messages.ts  attendance/homeState.ts
    attendance/pendingAction.ts  attendance/submitFlow.ts  attendance/deps.ts
    attendance/history.ts  attendance/queryKeys.ts  attendance/useNow.ts  attendance/localDate.ts
    i18n/index.ts  i18n/en.json
    theme/tokens.ts
    ui/Icon.tsx  ui/Text.tsx  ui/Button.tsx  ui/Screen.tsx  ui/TextField.tsx
    ui/Banner.tsx  ui/Card.tsx  ui/TabBar.tsx  ui/Centered.tsx  ui/Avatar.tsx  ui/useDebounced.ts
    navigation/types.ts  navigation/RootNavigator.tsx  navigation/AuthNavigator.tsx
    navigation/WorkerNavigator.tsx  navigation/AdminNavigator.tsx
    screens/login/WorkerLoginScreen.tsx  screens/login/AdminLoginScreen.tsx
    screens/worker/HomeScreen.tsx  screens/worker/ResultView.tsx
    screens/worker/BusyView.tsx  screens/worker/HistoryScreen.tsx
    screens/worker/MenuSheet.tsx
    screens/admin/TodayScreen.tsx  screens/admin/AttendanceListScreen.tsx
    screens/admin/AttendanceDetailScreen.tsx  screens/admin/EmployeesScreen.tsx
    screens/admin/EmployeeCreateScreen.tsx  screens/admin/EmployeeDetailScreen.tsx
    screens/admin/SitesScreen.tsx  screens/admin/SiteEditScreen.tsx
    screens/admin/adminErrors.ts  screens/admin/PinReveal.tsx
    maps/LeafletMap.tsx
docs/testing/mobile-manual-checklist.md    (Task 15)
README.md                                  (Task 15: Android app section)
.github/workflows/ci.yml                   (Task 15: android job)
eslint.config.js                           (Task 2: lint apps/mobile)
```

Tests sit next to the code as `*.test.ts(x)`.

---

### Task 1: Add the company time zone to `/me/today`

The phone schedules the 7 PM reminder for the **company's** work date and time. It can only do that with the company time zone. `MeTodayResponse` currently has `workDate` and `reminderTime` but no zone.

**Files:**
- Modify: `packages/shared/src/types.ts` (`MeTodayResponse`)
- Modify: `apps/api/src/modules/me/service.ts` (`getToday`)
- Test: `apps/api/tests/me.test.ts`

**Interfaces:**
- Produces: `MeTodayResponse.timezone: string` (IANA name, e.g. `'Asia/Kolkata'`). Used by Task 5 (`scheduleCheckoutReminder`) and Task 10.

- [ ] **Step 1: Create the branch**

```bash
cd /home/prathmesh/Projects/VE
git checkout main && git pull
git checkout -b feat/mobile-app
```

- [ ] **Step 2: Write the failing test**

In `apps/api/tests/me.test.ts`, in the test `returns site, settings and no day before check-in`, add `timezone` to the expected object. Put it after `reminderTime: '19:00',`:

```ts
      reminderTime: '19:00',
      timezone: 'Asia/Kolkata',
```

- [ ] **Step 3: Run it to verify it fails**

Run: `docker compose up -d db && pnpm --filter @ve/api test -- tests/me.test.ts`
Expected: FAIL. The diff shows `+ "timezone": "Asia/Kolkata"` missing from the received object.

- [ ] **Step 4: Implement**

In `packages/shared/src/types.ts`, add the field to `MeTodayResponse` after `reminderTime`:

```ts
  reminderTime: string;
  /** IANA zone of the company; work dates and reminder time are in this zone. */
  timezone: string;
```

In `apps/api/src/modules/me/service.ts`, add the field to the returned object in `getToday`, after `reminderTime: settings.reminderTime,`:

```ts
    reminderTime: settings.reminderTime,
    timezone: settings.timezone,
```

- [ ] **Step 5: Run the API suite**

Run: `pnpm --filter @ve/api test && pnpm typecheck`
Expected: all API tests pass (121/121) and typecheck is clean.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts apps/api/src/modules/me/service.ts apps/api/tests/me.test.ts
git commit -m "send company time zone with today's status"
```

---

### Task 2: Android toolchain, app scaffold and monorepo wiring

This task gives the repo an app that builds (`assembleDebug`), one Jest test that imports `@ve/shared`, and lint and typecheck that cover `apps/mobile`.

**Files:**
- Create: `apps/mobile/**` (from the RN 0.87.1 template, then edited as below)
- Create: `apps/mobile/src/App.tsx`, `apps/mobile/src/smoke.test.ts`
- Modify: `eslint.config.js`, root `package.json` (devDependency `eslint-plugin-react-hooks`)

**Interfaces:**
- Produces:
  - the `@ve/mobile` workspace package with the scripts `test`, `typecheck`, `android`, `start`, `fonts` and `leaflet`
  - Jest config with the setup file `apps/mobile/jest.setup.js`, which later tasks extend
  - BuildConfig fields `API_URL` and `TILE_URL`, read by Task 3

- [ ] **Step 1: Ask the user before installing the toolchain**

This machine has no Java and no Android SDK. Installing adds about 6 GB under `$HOME` and edits `~/.zshrc`. **Stop and ask the user to approve** the three steps below before running them. Nothing is installed system-wide and `sudo` is not used.

- [ ] **Step 2: Install JDK 17 in user space**

```bash
mkdir -p ~/.local/jdk && cd ~/.local/jdk
curl -fsSL -o jdk17.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
tar xzf jdk17.tar.gz && rm jdk17.tar.gz
ln -sfn "$(ls -d jdk-17*/ | head -1)" current
~/.local/jdk/current/bin/java -version
```
Expected: `openjdk version "17.…"`.

- [ ] **Step 3: Install the Android command-line tools and SDK packages**

```bash
mkdir -p ~/Android/Sdk/cmdline-tools && cd ~/Android/Sdk/cmdline-tools
curl -fsSL -o tools.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
unzip -q tools.zip && rm tools.zip && mv cmdline-tools latest
export JAVA_HOME=$HOME/.local/jdk/current ANDROID_HOME=$HOME/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
yes | sdkmanager --licenses > /dev/null
sdkmanager "platform-tools" "platforms;android-36" "platforms;android-37" \
  "build-tools;36.0.0" "build-tools;37.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
```
If the zip URL returns 404, take the current "Command line tools only" Linux link from https://developer.android.com/studio#command-tools and record a ruling. If `unzip` is missing, use `python3 -m zipfile -e tools.zip .`.
Expected: `sdkmanager --list_installed` shows all seven packages.

- [ ] **Step 4: Persist the environment**

Append to `~/.zshrc`:

```bash
# Android / React Native (VE HR)
export JAVA_HOME=$HOME/.local/jdk/current
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
```

Every later shell command in this plan assumes these variables. Tool shells don't read `~/.zshrc`, so prefix gradle commands with `source ~/.zshrc &&` or export the variables inline.

- [ ] **Step 5: Generate the template into `apps/mobile`**

```bash
cd /home/prathmesh/Projects/VE
npx --yes @react-native-community/cli@20.2.0 init VeHr --version 0.87.1 \
  --package-name com.vehr.app --directory apps/mobile --skip-install --skip-git-init
cd apps/mobile
rm -rf ios Gemfile .bundle _eslintrc.js .eslintrc.js .prettierrc.js __tests__ App.tsx
ls android/app/src/main/java/com/vehr/app/
```
Expected: `MainActivity.kt  MainApplication.kt`. If the CLI rejects `--package-name`, init without it and rename the package in `android/app/build.gradle` (`namespace`, `applicationId`) and the Kotlin files' `package` line and folder. Record a ruling.

- [ ] **Step 6: Rewrite `apps/mobile/package.json`**

Keep the template's `devDependencies` that start with `@babel/` and `@react-native-community/cli*`, and change the rest so the file matches this shape:

```json
{
  "name": "@ve/mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "android": "react-native run-android",
    "start": "react-native start",
    "test": "TZ=Asia/Kolkata jest",
    "typecheck": "tsc --noEmit",
    "fonts": "bash scripts/fetch-fonts.sh",
    "leaflet": "node scripts/copy-leaflet.mjs"
  },
  "dependencies": {
    "@react-navigation/bottom-tabs": "7.19.2",
    "@react-navigation/native": "7.4.1",
    "@react-navigation/native-stack": "7.19.2",
    "@tanstack/react-query": "5.103.2",
    "@ve/shared": "workspace:*",
    "i18next": "26.4.2",
    "react": "19.2.3",
    "react-i18next": "17.0.15",
    "react-native": "0.87.1",
    "react-native-safe-area-context": "5.10.0",
    "react-native-screens": "4.28.0",
    "react-native-svg": "15.15.5",
    "react-native-webview": "14.0.1"
  },
  "devDependencies": {
    "@react-native/babel-preset": "0.87.1",
    "@react-native/jest-preset": "0.87.1",
    "@react-native/metro-config": "0.87.1",
    "@react-native/typescript-config": "0.87.1",
    "@testing-library/react-native": "14.0.1",
    "@types/jest": "^29.5.13",
    "@types/react": "^19.2.0",
    "jest": "^29.6.3",
    "leaflet": "1.9.4",
    "test-renderer": "^1.0.0",
    "typescript": "^6.0.3"
  },
  "codegenConfig": {
    "name": "VeHrSpec",
    "type": "modules",
    "jsSrcsDir": "specs",
    "android": { "javaPackageName": "com.vehr.app.specs" }
  },
  "engines": { "node": ">=22" }
}
```
(Add the kept `@babel/*` and `@react-native-community/cli*` entries back into `devDependencies`.) Removed on purpose:
- `@react-native/new-app-screen`
- `eslint`, `@react-native/eslint-config` and `prettier`: the root tooling covers them
- `react-test-renderer`: RNTL 14 uses `test-renderer`

- [ ] **Step 7: Monorepo config files**

`apps/mobile/metro.config.js`:

```js
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
  },
});
```

`apps/mobile/jest.config.js`:

```js
module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  restoreMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-webview|react-native-screens|react-native-safe-area-context)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
};
```

`apps/mobile/jest.setup.js` (later tasks add mocks here):

```js
// Shared Jest setup for @ve/mobile. Later tasks append native mocks below.
```

`apps/mobile/tsconfig.json`:

```json
{
  "extends": "@react-native/typescript-config",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "lib": ["es2022"],
    "types": ["jest"]
  },
  "include": ["src", "specs"],
  "exclude": ["node_modules", "android"]
}
```

`apps/mobile/index.js`:

```js
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

`apps/mobile/src/App.tsx` (temporary; Task 8 replaces it):

```tsx
import React from 'react';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>VE HR</Text>
    </View>
  );
}
```

- [ ] **Step 8: Point Gradle at the hoisted `node_modules`**

pnpm is configured with `node-linker=hoisted`, so `react-native` lives in the **repo root** `node_modules`, four levels up from `android/app`.

In `apps/mobile/android/settings.gradle`, replace every `../node_modules/` with `../../../node_modules/`. That covers both `includeBuild(...)` lines for `@react-native/gradle-plugin`.

In `apps/mobile/android/app/build.gradle`, set these lines inside the `react { … }` block (they are commented out in the template):

```groovy
    root = file("../../")
    reactNativeDir = file("../../../../node_modules/react-native")
    codegenDir = file("../../../../node_modules/@react-native/codegen")
    cliFile = file("../../../../node_modules/react-native/cli.js")
```

- [ ] **Step 9: minSdk 29, BuildConfig fields**

In `apps/mobile/android/build.gradle`, change `minSdkVersion = 24` to `minSdkVersion = 29`.

In `apps/mobile/android/app/build.gradle`, inside `android { defaultConfig { … } }`, add:

```groovy
        buildConfigField "String", "API_URL", "\"${System.getenv('VE_API_URL') ?: 'http://localhost:3000'}\""
        buildConfigField "String", "TILE_URL", "\"${System.getenv('VE_TILE_URL') ?: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}\""
```

Inside `android { … }`, add this block if the template doesn't already have it:

```groovy
    buildFeatures {
        buildConfig = true
    }
```

- [ ] **Step 10: Install and check hoisting**

```bash
cd /home/prathmesh/Projects/VE
pnpm install
ls node_modules/react-native/package.json node_modules/@react-native/gradle-plugin/package.json
ls apps/mobile/node_modules 2>/dev/null | head
```
Expected: both files exist at the root. If pnpm nested `react-native` under `apps/mobile/node_modules` because of a version conflict, point the Step 8 paths there instead and record a ruling. Read the `pnpm install` peer warnings. Any warning that names `react-native` or `react` as an unmet peer means a pinned version breaks the vetting rule: stop and record it.

- [ ] **Step 11: Write the failing smoke test**

`apps/mobile/src/smoke.test.ts`:

```ts
import { normalizePhone } from '@ve/shared';

test('the mobile app can import @ve/shared', () => {
  expect(normalizePhone('98765 43210')).toBe('+919876543210');
});
```

- [ ] **Step 12: Run it**

Run: `pnpm --filter @ve/mobile test`
Expected: PASS 1/1. It "fails first" in the sense that it cannot run before Steps 6–10. If Jest can't transform `@ve/shared`, add `'^@ve/shared$': '<rootDir>/../../packages/shared/src/index.ts'` to `moduleNameMapper` and record a ruling.

- [ ] **Step 13: Lint and typecheck cover the app**

Root: `pnpm add -Dw eslint-plugin-react-hooks@7.1.1`.

Replace `eslint.config.js` with:

```js
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/drizzle/**',
      '**/node_modules/**',
      'apps/web/**',
      'apps/mobile/android/**',
      'apps/mobile/*.js',
      'apps/mobile/scripts/**',
      '.superpowers/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
);
```

Run: `pnpm lint && pnpm typecheck`
Expected: both clean.

- [ ] **Step 14: Build the debug APK**

```bash
cd /home/prathmesh/Projects/VE/apps/mobile/android
./gradlew assembleDebug --no-daemon -q
ls -la app/build/outputs/apk/debug/
```
Expected: `BUILD SUCCESSFUL` and `app-debug.apk` present. The first run downloads Gradle and dependencies and can take 10+ minutes; send the output to a file and read its tail. If the manifest merger reports a library that needs minSdk > 29, stop: that library breaks the vetting rule.

- [ ] **Step 15: Commit**

Check `apps/mobile/.gitignore` from the template ignores `android/app/build`, `android/.gradle`, `*.keystore` except `debug.keystore`, and `node_modules`.

```bash
cd /home/prathmesh/Projects/VE
git add apps/mobile eslint.config.js package.json pnpm-lock.yaml
git commit -m "set up android app in the monorepo"
```

---

### Task 3: `NativeVeDevice` TurboModule: device info, UUIDs, secure store, prefs

A single app-local TurboModule replaces `react-native-device-info`, `react-native-keychain` and `react-native-mmkv`:

- **Refresh token:** encrypted with an AES-256-GCM key held in the AndroidKeyStore. The ciphertext is stored in SharedPreferences.
- **Pending idempotency key and cached user:** plain SharedPreferences written with `commit()` (synchronous), so the value is on disk before any network call.
- **Device ID:** a random install ID generated on first use. The API only logs it; there is no device lock.

Tasks 4 and 5 add location and reminder methods to the same spec. Codegen generates abstract methods only for what the spec declares, so each task adds its own methods.

**Files:**
- Create: `apps/mobile/specs/NativeVeDevice.ts`
- Create: `apps/mobile/android/app/src/main/java/com/vehr/app/device/{VeDeviceModule,VeDevicePackage,SecureStore,PlainPrefs}.kt`
- Modify: `apps/mobile/android/app/src/main/java/com/vehr/app/MainApplication.kt`
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml` (`allowBackup`)
- Create: `apps/mobile/src/native/device.ts`, `apps/mobile/src/testing/fakeNative.ts`
- Modify: `apps/mobile/jest.setup.js`
- Test: `apps/mobile/src/native/device.test.ts`

**Interfaces:**
- Produces (`src/native/device.ts`):
  - `interface DeviceInfo { deviceId: string; deviceModel: string; appVersion: string; apiUrl: string; tileUrl: string; sdkInt: number }`
  - `getDeviceInfo(): Promise<DeviceInfo>`: cached after the first successful call
  - `resetDeviceInfoCache(): void`: tests only
  - `randomUuid(): Promise<string>`
  - `secureStore: { get(key): Promise<string | null>; set(key, value): Promise<void>; remove(key): Promise<void> }`
  - `prefs: { get(key): Promise<string | null>; set(key, value): Promise<void>; remove(key): Promise<void>; getJson<T>(key): Promise<T | null>; setJson(key, value: unknown): Promise<void> }`
- Produces (`src/testing/fakeNative.ts`): `fakeNative` (implements `Spec`), `fakeState` (mutable test state) and `resetFakeNative()`. `jest.setup.js` installs it as the mock and resets it before each test.

- [ ] **Step 1: Write the spec**

`apps/mobile/specs/NativeVeDevice.ts`:

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type NativeDeviceInfo = {
  deviceId: string;
  deviceModel: string;
  appVersion: string;
  apiUrl: string;
  tileUrl: string;
  sdkInt: number;
};

export interface Spec extends TurboModule {
  getDeviceInfo(): Promise<NativeDeviceInfo>;
  randomUuid(): Promise<string>;
  secureGet(key: string): Promise<string | null>;
  secureSet(key: string, value: string): Promise<void>;
  secureDelete(key: string): Promise<void>;
  prefGet(key: string): Promise<string | null>;
  prefSet(key: string, value: string): Promise<void>;
  prefDelete(key: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeVeDevice');
```

- [ ] **Step 2: Write the fake and install it in Jest**

`apps/mobile/src/testing/fakeNative.ts`:

```ts
import type { NativeDeviceInfo, Spec } from '../../specs/NativeVeDevice';

export type FakeFix = { lat: number; lng: number; accuracyM: number; isMock: boolean };
export type FakeReminder = { workDate: string; reminderTime: string; timezone: string; title: string; body: string };

export interface FakeNativeState {
  secure: Map<string, string>;
  prefs: Map<string, string>;
  info: NativeDeviceInfo;
  locationEnabled: boolean;
  fix: FakeFix | null;
  reminders: FakeReminder[];
  uuidSeq: number;
}

function initialState(): FakeNativeState {
  return {
    secure: new Map(),
    prefs: new Map(),
    info: {
      deviceId: 'device-1',
      deviceModel: 'Test Phone',
      appVersion: '0.1.0',
      apiUrl: 'http://api.test',
      tileUrl: 'https://tiles.test/{z}/{x}/{y}.png',
      sdkInt: 34,
    },
    locationEnabled: true,
    fix: { lat: 18.5912, lng: 73.7389, accuracyM: 12, isMock: false },
    reminders: [],
    uuidSeq: 0,
  };
}

export const fakeState: FakeNativeState = initialState();

export function resetFakeNative(): void {
  Object.assign(fakeState, initialState());
}

/** In-memory stand-in for the Kotlin module. Methods added by later tasks live here too. */
export const fakeNative = {
  getDeviceInfo: async () => ({ ...fakeState.info }),
  randomUuid: async () => `00000000-0000-4000-8000-${String(++fakeState.uuidSeq).padStart(12, '0')}`,
  secureGet: async (key: string) => fakeState.secure.get(key) ?? null,
  secureSet: async (key: string, value: string) => {
    fakeState.secure.set(key, value);
  },
  secureDelete: async (key: string) => {
    fakeState.secure.delete(key);
  },
  prefGet: async (key: string) => fakeState.prefs.get(key) ?? null,
  prefSet: async (key: string, value: string) => {
    fakeState.prefs.set(key, value);
  },
  prefDelete: async (key: string) => {
    fakeState.prefs.delete(key);
  },
} satisfies Spec;
```

Replace `apps/mobile/jest.setup.js` with:

```js
// Shared Jest setup for @ve/mobile.
jest.mock('./specs/NativeVeDevice', () => ({
  __esModule: true,
  default: require('./src/testing/fakeNative').fakeNative,
}));

beforeEach(() => {
  require('./src/testing/fakeNative').resetFakeNative();
  require('./src/native/device').resetDeviceInfoCache();
});
```

- [ ] **Step 3: Write the failing test**

`apps/mobile/src/native/device.test.ts`:

```ts
import { fakeNative, fakeState } from '../testing/fakeNative';
import { getDeviceInfo, prefs, randomUuid, secureStore } from './device';

test('getDeviceInfo asks the native module once and caches it', async () => {
  const spy = jest.spyOn(fakeNative, 'getDeviceInfo');
  const [a, b] = await Promise.all([getDeviceInfo(), getDeviceInfo()]);
  expect(a).toEqual(b);
  expect(a.apiUrl).toBe('http://api.test');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('getDeviceInfo retries after a native failure', async () => {
  const spy = jest.spyOn(fakeNative, 'getDeviceInfo').mockRejectedValueOnce(new Error('boom'));
  await expect(getDeviceInfo()).rejects.toThrow('boom');
  await expect(getDeviceInfo()).resolves.toMatchObject({ deviceId: 'device-1' });
  expect(spy).toHaveBeenCalledTimes(2);
});

test('secure store and prefs round-trip and delete', async () => {
  await secureStore.set('refreshToken', 'abc');
  expect(await secureStore.get('refreshToken')).toBe('abc');
  await secureStore.remove('refreshToken');
  expect(await secureStore.get('refreshToken')).toBeNull();

  await prefs.setJson('user', { id: 'u1' });
  expect(await prefs.getJson<{ id: string }>('user')).toEqual({ id: 'u1' });
});

test('prefs.getJson returns null for corrupt JSON instead of throwing', async () => {
  fakeState.prefs.set('user', '{not json');
  expect(await prefs.getJson('user')).toBeNull();
});

test('randomUuid returns distinct values', async () => {
  expect(await randomUuid()).not.toBe(await randomUuid());
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @ve/mobile test -- src/native/device.test.ts`
Expected: FAIL with `Cannot find module './device'`.

- [ ] **Step 5: Implement the JS wrapper**

`apps/mobile/src/native/device.ts`:

```ts
import NativeVeDevice from '../../specs/NativeVeDevice';

export interface DeviceInfo {
  deviceId: string;
  deviceModel: string;
  appVersion: string;
  apiUrl: string;
  tileUrl: string;
  sdkInt: number;
}

let cached: Promise<DeviceInfo> | null = null;

export function getDeviceInfo(): Promise<DeviceInfo> {
  if (!cached) {
    cached = NativeVeDevice.getDeviceInfo().catch((err: unknown) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function resetDeviceInfoCache(): void {
  cached = null;
}

export const randomUuid = (): Promise<string> => NativeVeDevice.randomUuid();

export const secureStore = {
  get: (key: string) => NativeVeDevice.secureGet(key),
  set: (key: string, value: string) => NativeVeDevice.secureSet(key, value),
  remove: (key: string) => NativeVeDevice.secureDelete(key),
};

export const prefs = {
  get: (key: string) => NativeVeDevice.prefGet(key),
  set: (key: string, value: string) => NativeVeDevice.prefSet(key, value),
  remove: (key: string) => NativeVeDevice.prefDelete(key),
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await NativeVeDevice.prefGet(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJson: (key: string, value: unknown) => NativeVeDevice.prefSet(key, JSON.stringify(value)),
};
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @ve/mobile test -- src/native/device.test.ts`
Expected: PASS 5/5.

- [ ] **Step 7: Write the Kotlin side**

`android/app/src/main/java/com/vehr/app/device/PlainPrefs.kt`:

```kotlin
package com.vehr.app.device

import android.content.Context

/** Small plain key/value store. commit() is synchronous so values are on disk before we return. */
class PlainPrefs(context: Context) {
    private val prefs = context.getSharedPreferences("vehr_prefs", Context.MODE_PRIVATE)

    fun get(key: String): String? = prefs.getString(key, null)

    fun set(key: String, value: String) {
        check(prefs.edit().putString(key, value).commit()) { "prefs write failed" }
    }

    fun remove(key: String) {
        prefs.edit().remove(key).commit()
    }
}
```

`android/app/src/main/java/com/vehr/app/device/SecureStore.kt`:

```kotlin
package com.vehr.app.device

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Values encrypted with an AES-GCM key that never leaves the AndroidKeyStore. */
class SecureStore(context: Context) {
    private val prefs = context.getSharedPreferences("vehr_secure", Context.MODE_PRIVATE)

    fun get(name: String): String? {
        val stored = prefs.getString(name, null) ?: return null
        return try {
            val bytes = Base64.decode(stored, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, bytes, 0, IV_BYTES))
            String(cipher.doFinal(bytes, IV_BYTES, bytes.size - IV_BYTES), Charsets.UTF_8)
        } catch (e: Exception) {
            // Key lost (e.g. restored to a new phone): treat as missing so the user logs in again.
            prefs.edit().remove(name).commit()
            null
        }
    }

    fun set(name: String, value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val out = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        check(prefs.edit().putString(name, Base64.encodeToString(out, Base64.NO_WRAP)).commit()) {
            "secure write failed"
        }
    }

    fun remove(name: String) {
        prefs.edit().remove(name).commit()
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "vehr_secure_key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val TAG_BITS = 128
    }
}
```

`android/app/src/main/java/com/vehr/app/device/VeDeviceModule.kt`:

```kotlin
package com.vehr.app.device

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.vehr.app.BuildConfig
import com.vehr.app.specs.NativeVeDeviceSpec
import java.util.UUID

class VeDeviceModule(private val reactContext: ReactApplicationContext) : NativeVeDeviceSpec(reactContext) {
    private val prefs by lazy { PlainPrefs(reactContext) }
    private val secure by lazy { SecureStore(reactContext) }

    override fun getName() = NAME

    override fun getDeviceInfo(promise: Promise) = respond(promise) {
        Arguments.createMap().apply {
            putString("deviceId", installationId())
            putString("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}".take(128))
            putString("appVersion", BuildConfig.VERSION_NAME)
            putString("apiUrl", BuildConfig.API_URL)
            putString("tileUrl", BuildConfig.TILE_URL)
            putInt("sdkInt", Build.VERSION.SDK_INT)
        }
    }

    override fun randomUuid(promise: Promise) = respond(promise) { UUID.randomUUID().toString() }

    override fun secureGet(key: String, promise: Promise) = respond(promise) { secure.get(key) }

    override fun secureSet(key: String, value: String, promise: Promise) = respond(promise) {
        secure.set(key, value)
        null
    }

    override fun secureDelete(key: String, promise: Promise) = respond(promise) {
        secure.remove(key)
        null
    }

    override fun prefGet(key: String, promise: Promise) = respond(promise) { prefs.get(key) }

    override fun prefSet(key: String, value: String, promise: Promise) = respond(promise) {
        prefs.set(key, value)
        null
    }

    override fun prefDelete(key: String, promise: Promise) = respond(promise) {
        prefs.remove(key)
        null
    }

    @Synchronized
    private fun installationId(): String =
        prefs.get(INSTALL_ID) ?: UUID.randomUUID().toString().also { prefs.set(INSTALL_ID, it) }

    private inline fun respond(promise: Promise, block: () -> Any?) {
        try {
            promise.resolve(block())
        } catch (e: Exception) {
            promise.reject("E_DEVICE", e.message, e)
        }
    }

    companion object {
        const val NAME = "NativeVeDevice"
        private const val INSTALL_ID = "__install_id"
    }
}
```

`android/app/src/main/java/com/vehr/app/device/VeDevicePackage.kt`:

```kotlin
package com.vehr.app.device

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class VeDevicePackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == VeDeviceModule.NAME) VeDeviceModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            VeDeviceModule.NAME to ReactModuleInfo(
                VeDeviceModule.NAME,
                VeDeviceModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true, // isTurboModule
            ),
        )
    }
}
```

In `MainApplication.kt`, add `import com.vehr.app.device.VeDevicePackage`. In the `PackageList(this).packages.apply { … }` block, replace the commented `// add(MyReactNativePackage())` line with:

```kotlin
              add(VeDevicePackage())
```

In `AndroidManifest.xml`, make sure the `<application>` tag has `android:allowBackup="false"`, so a cloud backup never carries the encrypted token to another phone.

- [ ] **Step 8: Build to prove codegen and Kotlin compile**

Run: `cd apps/mobile/android && ./gradlew assembleDebug --no-daemon -q > /tmp/vehr-build.log 2>&1; tail -20 /tmp/vehr-build.log`
Expected: `BUILD SUCCESSFUL`. A `NativeVeDeviceSpec` "unresolved reference" error means the codegen package differs; check `app/build/generated/source/codegen/java/` for the real package and fix the import.

- [ ] **Step 9: Run the mobile suite, lint, typecheck**

Run: `pnpm --filter @ve/mobile test && pnpm lint && pnpm typecheck`
Expected: all green (6 tests).

- [ ] **Step 10: Commit**

```bash
git add apps/mobile
git commit -m "add native module for device info and storage"
```

---

### Task 4: Location: native best fix, and the JS permission flow

**Files:**
- Modify: `apps/mobile/specs/NativeVeDevice.ts`, `apps/mobile/src/testing/fakeNative.ts`
- Create: `apps/mobile/android/app/src/main/java/com/vehr/app/device/Locator.kt`
- Modify: `VeDeviceModule.kt`, `android/app/build.gradle` (play-services-location), `AndroidManifest.xml` (permissions)
- Create: `apps/mobile/src/native/location.ts`
- Test: `apps/mobile/src/native/location.test.ts`

**Interfaces:**
- Consumes: `getDeviceInfo()` (Task 3) for `sdkInt`.
- Produces (`src/native/location.ts`):
  - `type LocationProblem = 'LOCATION_OFF' | 'PERMISSION_DENIED' | 'PRECISE_LOCATION_REQUIRED'`
  - `interface Fix { lat: number; lng: number; accuracyM: number; isMock: boolean }`
  - `ensureLocationReady(): Promise<LocationProblem | null>`: `null` means ready
  - `getBestFix(targetAccuracyM: number, timeoutMs?: number): Promise<Fix | null>`: default timeout 20 000 ms; `null` means no reading at all
  - `openLocationSettings(): Promise<void>` and `openAppSettings(): Promise<void>`

- [ ] **Step 1: Extend the spec and the fake**

In `specs/NativeVeDevice.ts`, add this type above `Spec`:

```ts
export type NativeFix = { lat: number; lng: number; accuracyM: number; isMock: boolean };
```

Add these two members inside `Spec`:

```ts
  isLocationEnabled(): Promise<boolean>;
  /** Resolves with the best reading within timeoutMs (early once accuracy <= target); rejects with code NO_FIX if none. */
  getCurrentPosition(timeoutMs: number, targetAccuracyM: number): Promise<NativeFix>;
```

In `src/testing/fakeNative.ts`, add these to the `fakeNative` object:

```ts
  isLocationEnabled: async () => fakeState.locationEnabled,
  getCurrentPosition: async (_timeoutMs: number, _targetAccuracyM: number) => {
    if (!fakeState.fix) throw Object.assign(new Error('No location fix'), { code: 'NO_FIX' });
    return { ...fakeState.fix };
  },
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/native/location.test.ts`:

```ts
import { PermissionsAndroid } from 'react-native';
import { fakeNative, fakeState } from '../testing/fakeNative';
import { ensureLocationReady, getBestFix } from './location';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

function grant(fine: string, coarse: string) {
  return jest
    .spyOn(PermissionsAndroid, 'requestMultiple')
    .mockResolvedValue({ [FINE]: fine, [COARSE]: coarse } as never);
}

test('location services off asks to turn them on before any permission prompt', async () => {
  fakeState.locationEnabled = false;
  const request = grant('granted', 'granted');
  expect(await ensureLocationReady()).toBe('LOCATION_OFF');
  expect(request).not.toHaveBeenCalled();
});

test('precise permission granted is ready', async () => {
  const request = grant('granted', 'granted');
  expect(await ensureLocationReady()).toBeNull();
  expect(request).toHaveBeenCalledWith([FINE, COARSE]);
});

test('approximate-only permission on Android 12+ asks for precise location', async () => {
  fakeState.info.sdkInt = 31;
  grant('denied', 'granted');
  expect(await ensureLocationReady()).toBe('PRECISE_LOCATION_REQUIRED');
});

test('denied or never-ask-again permission is PERMISSION_DENIED', async () => {
  grant('denied', 'denied');
  expect(await ensureLocationReady()).toBe('PERMISSION_DENIED');
  jest.restoreAllMocks();
  grant('never_ask_again', 'never_ask_again');
  expect(await ensureLocationReady()).toBe('PERMISSION_DENIED');
});

test('coarse-only below Android 12 is PERMISSION_DENIED (no precise toggle exists there)', async () => {
  fakeState.info.sdkInt = 30;
  grant('denied', 'granted');
  expect(await ensureLocationReady()).toBe('PERMISSION_DENIED');
});

test('getBestFix asks for up to 20 s and stops at the target accuracy', async () => {
  const spy = jest.spyOn(fakeNative, 'getCurrentPosition');
  expect(await getBestFix(50)).toEqual({ lat: 18.5912, lng: 73.7389, accuracyM: 12, isMock: false });
  expect(spy).toHaveBeenCalledWith(20000, 50);
});

test('getBestFix passes the mock flag through untouched', async () => {
  fakeState.fix = { lat: 1, lng: 2, accuracyM: 5, isMock: true };
  expect((await getBestFix(50))?.isMock).toBe(true);
});

test('getBestFix returns null when there is no reading at all', async () => {
  fakeState.fix = null;
  expect(await getBestFix(50)).toBeNull();
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @ve/mobile test -- src/native/location.test.ts`
Expected: FAIL with `Cannot find module './location'`.

- [ ] **Step 4: Implement `location.ts`**

`apps/mobile/src/native/location.ts`:

```ts
import { Linking, PermissionsAndroid } from 'react-native';
import NativeVeDevice from '../../specs/NativeVeDevice';
import { getDeviceInfo } from './device';

export type LocationProblem = 'LOCATION_OFF' | 'PERMISSION_DENIED' | 'PRECISE_LOCATION_REQUIRED';

export interface Fix {
  lat: number;
  lng: number;
  accuracyM: number;
  isMock: boolean;
}

const FIX_TIMEOUT_MS = 20_000;

/** Run on every tap: covers Android 11 "only this time" and settings changed while the app was open. */
export async function ensureLocationReady(): Promise<LocationProblem | null> {
  if (!(await NativeVeDevice.isLocationEnabled())) return 'LOCATION_OFF';
  const { FINE, COARSE } = {
    FINE: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    COARSE: PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  };
  const result = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
  const granted = PermissionsAndroid.RESULTS.GRANTED;
  if (result[FINE] === granted) return null;
  const { sdkInt } = await getDeviceInfo();
  if (result[COARSE] === granted && sdkInt >= 31) return 'PRECISE_LOCATION_REQUIRED';
  return 'PERMISSION_DENIED';
}

export async function getBestFix(targetAccuracyM: number, timeoutMs = FIX_TIMEOUT_MS): Promise<Fix | null> {
  try {
    const fix = await NativeVeDevice.getCurrentPosition(timeoutMs, targetAccuracyM);
    return { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, isMock: fix.isMock };
  } catch (err) {
    console.warn('location: no fix', err);
    return null;
  }
}

export function openLocationSettings(): Promise<void> {
  return Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
}

export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @ve/mobile test -- src/native/location.test.ts`
Expected: PASS 8/8.

- [ ] **Step 6: Native side**

`android/app/build.gradle`, inside `dependencies { … }`:

```groovy
    implementation("com.google.android.gms:play-services-location:21.3.0")
```

`AndroidManifest.xml`, next to the existing `INTERNET` permission:

```xml
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

`android/app/src/main/java/com/vehr/app/device/Locator.kt`:

```kotlin
package com.vehr.app.device

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.core.location.LocationListenerCompat
import androidx.core.location.LocationManagerCompat
import androidx.core.location.LocationRequestCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Collects fresh fixes for up to [timeoutMs] and reports the most accurate one.
 * Uses the fused provider when Play Services is usable, else plain LocationManager (spec §10.4).
 * All callbacks run on the main looper, so the state below is only touched from one thread.
 */
class Locator(private val context: Context) {
    private val locationManager = context.getSystemService(LocationManager::class.java)

    fun isEnabled(): Boolean = LocationManagerCompat.isLocationEnabled(locationManager)

    @SuppressLint("MissingPermission") // JS checks ACCESS_FINE_LOCATION before calling.
    fun bestFix(timeoutMs: Long, targetAccuracyM: Float, done: (Location?) -> Unit) {
        val main = Handler(Looper.getMainLooper())
        main.post {
            var best: Location? = null
            var finished = false
            var stop: () -> Unit = {}
            lateinit var timeout: Runnable

            fun finish() {
                if (finished) return
                finished = true
                main.removeCallbacks(timeout)
                stop()
                done(best)
            }

            fun offer(location: Location) {
                if (finished || !location.hasAccuracy()) return
                val current = best
                if (current == null || location.accuracy < current.accuracy) best = location
                if (location.accuracy <= targetAccuracyM) finish()
            }

            timeout = Runnable { finish() }
            try {
                stop = if (hasPlayServices()) startFused(timeoutMs, ::offer) else startPlatform(::offer)
            } catch (e: SecurityException) {
                finished = true
                done(null)
                return@post
            }
            main.postDelayed(timeout, timeoutMs)
        }
    }

    @SuppressLint("MissingPermission")
    private fun startFused(timeoutMs: Long, offer: (Location) -> Unit): () -> Unit {
        val client = LocationServices.getFusedLocationProviderClient(context)
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
            .setMinUpdateIntervalMillis(500L)
            .setMaxUpdateAgeMillis(0L) // never hand back a cached fix
            .setDurationMillis(timeoutMs)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach(offer)
            }
        }
        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        return { client.removeLocationUpdates(callback) }
    }

    @SuppressLint("MissingPermission")
    private fun startPlatform(offer: (Location) -> Unit): () -> Unit {
        val listener = LocationListenerCompat { offer(it) }
        val request = LocationRequestCompat.Builder(1000L)
            .setQuality(LocationRequestCompat.QUALITY_HIGH_ACCURACY)
            .build()
        val executor = ContextCompat.getMainExecutor(context)
        listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { locationManager.isProviderEnabled(it) }
            .forEach { LocationManagerCompat.requestLocationUpdates(locationManager, it, request, executor, listener) }
        return { LocationManagerCompat.removeUpdates(locationManager, listener) }
    }

    private fun hasPlayServices(): Boolean =
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

    companion object {
        @Suppress("DEPRECATION")
        fun isMock(location: Location): Boolean =
            if (Build.VERSION.SDK_INT >= 31) location.isMock else location.isFromMockProvider
    }
}
```

In `VeDeviceModule.kt`, add `private val locator by lazy { Locator(reactContext) }` next to the other lazies. Add these methods:

```kotlin
    override fun isLocationEnabled(promise: Promise) = respond(promise) { locator.isEnabled() }

    override fun getCurrentPosition(timeoutMs: Double, targetAccuracyM: Double, promise: Promise) {
        locator.bestFix(timeoutMs.toLong(), targetAccuracyM.toFloat()) { location ->
            if (location == null) {
                promise.reject("NO_FIX", "No location fix")
            } else {
                promise.resolve(
                    Arguments.createMap().apply {
                        putDouble("lat", location.latitude)
                        putDouble("lng", location.longitude)
                        putDouble("accuracyM", location.accuracy.toDouble())
                        putBoolean("isMock", Locator.isMock(location))
                    },
                )
            }
        }
    }
```

- [ ] **Step 7: Build**

Run: `cd apps/mobile/android && ./gradlew assembleDebug --no-daemon -q > /tmp/vehr-build.log 2>&1; tail -20 /tmp/vehr-build.log`
Expected: `BUILD SUCCESSFUL`, and the manifest merger reports no minSdk conflicts.

- [ ] **Step 8: Suite, lint, typecheck, commit**

Run: `pnpm --filter @ve/mobile test && pnpm lint && pnpm typecheck`
Expected: all green.

```bash
git add apps/mobile
git commit -m "add gps location with precise permission check"
```

---

### Task 5: Check-out reminder: native alarm and JS wrapper

The reminder fires at the company `reminderTime` on the work date, in the company zone. The time is computed in Kotlin with `java.time`, available since API 26. The alarm is inexact (`setAndAllowWhileIdle`), so no exact-alarm permission is needed. A few minutes of drift is fine for a reminder.

Known gap: Android drops alarms on reboot. This task doesn't restore them; the manual checklist records it.

**Files:**
- Modify: `apps/mobile/specs/NativeVeDevice.ts`, `apps/mobile/src/testing/fakeNative.ts`
- Create: `android/app/src/main/java/com/vehr/app/device/{Reminder,ReminderReceiver}.kt`
- Create: `android/app/src/main/res/drawable/ic_stat_reminder.xml`
- Modify: `VeDeviceModule.kt`, `AndroidManifest.xml`
- Create: `apps/mobile/src/native/reminder.ts`
- Test: `apps/mobile/src/native/reminder.test.ts`

**Interfaces:**
- Consumes: `getDeviceInfo()` (Task 3) and `MeTodayResponse.timezone` (Task 1).
- Produces (`src/native/reminder.ts`):
  - `interface ReminderText { title: string; body: string }`
  - `ensureNotificationPermission(): Promise<boolean>`
  - `scheduleCheckoutReminder(today: Pick<MeTodayResponse, 'workDate' | 'reminderTime' | 'timezone'>, text: ReminderText): Promise<boolean>`: `false` when permission is denied or the time has already passed
  - `cancelCheckoutReminder(): Promise<void>`

- [ ] **Step 1: Extend the spec and the fake**

Add these members inside `Spec` in `specs/NativeVeDevice.ts`:

```ts
  /** Schedules the one check-out reminder; returns false if that moment has already passed. */
  scheduleReminder(workDate: string, reminderTime: string, timezone: string, title: string, body: string): Promise<boolean>;
  cancelReminder(): Promise<void>;
```

Add these to `fakeNative` in `src/testing/fakeNative.ts`:

```ts
  scheduleReminder: async (workDate: string, reminderTime: string, timezone: string, title: string, body: string) => {
    fakeState.reminders = [{ workDate, reminderTime, timezone, title, body }];
    return true;
  },
  cancelReminder: async () => {
    fakeState.reminders = [];
  },
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/native/reminder.test.ts`:

```ts
import { PermissionsAndroid } from 'react-native';
import { fakeState } from '../testing/fakeNative';
import { cancelCheckoutReminder, scheduleCheckoutReminder } from './reminder';

const today = { workDate: '2026-09-25', reminderTime: '19:00', timezone: 'Asia/Kolkata' };
const text = { title: 'Check out', body: 'Tap to check out' };

test('below Android 13 schedules without asking for notification permission', async () => {
  fakeState.info.sdkInt = 32;
  const request = jest.spyOn(PermissionsAndroid, 'request');
  expect(await scheduleCheckoutReminder(today, text)).toBe(true);
  expect(request).not.toHaveBeenCalled();
  expect(fakeState.reminders).toEqual([{ ...today, ...text }]);
});

test('Android 13+ asks for notification permission once, then schedules', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
  expect(await scheduleCheckoutReminder(today, text)).toBe(true);
  expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
});

test('Android 13+ with permission already granted does not prompt', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  const request = jest.spyOn(PermissionsAndroid, 'request');
  expect(await scheduleCheckoutReminder(today, text)).toBe(true);
  expect(request).not.toHaveBeenCalled();
});

test('denied notification permission skips scheduling', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  expect(await scheduleCheckoutReminder(today, text)).toBe(false);
  expect(fakeState.reminders).toEqual([]);
});

test('cancel removes the scheduled reminder', async () => {
  fakeState.info.sdkInt = 32;
  await scheduleCheckoutReminder(today, text);
  await cancelCheckoutReminder();
  expect(fakeState.reminders).toEqual([]);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @ve/mobile test -- src/native/reminder.test.ts`
Expected: FAIL with `Cannot find module './reminder'`.

- [ ] **Step 4: Implement `reminder.ts`**

`apps/mobile/src/native/reminder.ts`:

```ts
import { PermissionsAndroid } from 'react-native';
import type { MeTodayResponse } from '@ve/shared';
import NativeVeDevice from '../../specs/NativeVeDevice';
import { getDeviceInfo } from './device';

export interface ReminderText {
  title: string;
  body: string;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const { sdkInt } = await getDeviceInfo();
  if (sdkInt < 33) return true;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

export async function scheduleCheckoutReminder(
  today: Pick<MeTodayResponse, 'workDate' | 'reminderTime' | 'timezone'>,
  text: ReminderText,
): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  return NativeVeDevice.scheduleReminder(today.workDate, today.reminderTime, today.timezone, text.title, text.body);
}

export function cancelCheckoutReminder(): Promise<void> {
  return NativeVeDevice.cancelReminder();
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @ve/mobile test -- src/native/reminder.test.ts`
Expected: PASS 5/5.

- [ ] **Step 6: Native side**

`android/app/src/main/java/com/vehr/app/device/Reminder.kt`:

```kotlin
package com.vehr.app.device

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.AlarmManagerCompat
import androidx.core.app.NotificationManagerCompat
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

object Reminder {
    const val CHANNEL_ID = "checkout_reminder"
    const val NOTIFICATION_ID = 7001
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    private const val REQUEST_CODE = 7001

    fun schedule(context: Context, workDate: String, reminderTime: String, timezone: String, title: String, body: String): Boolean {
        val triggerAt = ZonedDateTime
            .of(LocalDate.parse(workDate), LocalTime.parse(reminderTime), ZoneId.of(timezone))
            .toInstant()
            .toEpochMilli()
        if (triggerAt <= System.currentTimeMillis()) return false
        val alarms = context.getSystemService(AlarmManager::class.java)
        AlarmManagerCompat.setAndAllowWhileIdle(alarms, AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent(context, title, body))
        return true
    }

    fun cancel(context: Context) {
        context.getSystemService(AlarmManager::class.java).cancel(pendingIntent(context, "", ""))
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    fun ensureChannel(context: Context, name: String) {
        val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH)
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    // Alarm identity ignores extras, so cancel() matches the scheduled intent.
    private fun pendingIntent(context: Context, title: String, body: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
```

`android/app/src/main/java/com/vehr/app/device/ReminderReceiver.kt`:

```kotlin
package com.vehr.app.device

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.vehr.app.R

class ReminderReceiver : BroadcastReceiver() {
    @SuppressLint("MissingPermission") // checked just below
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(Reminder.EXTRA_TITLE) ?: return
        val body = intent.getStringExtra(Reminder.EXTRA_BODY) ?: ""
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        Reminder.ensureChannel(context, title)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val content = launch?.let {
            PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        val notification = NotificationCompat.Builder(context, Reminder.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(content)
            .build()
        NotificationManagerCompat.from(context).notify(Reminder.NOTIFICATION_ID, notification)
    }
}
```

`android/app/src/main/res/drawable/ic_stat_reminder.xml` (a monochrome bell):

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF"
        android:pathData="M12,22a2,2 0,0 0,2 -2h-4a2,2 0,0 0,2 2zM18,16v-5c0,-3.07 -1.64,-5.64 -4.5,-6.32V4a1.5,1.5 0,0 0,-3 0v0.68C7.63,5.36 6,7.92 6,11v5l-2,2v1h16v-1l-2,-2z" />
</vector>
```

`AndroidManifest.xml`: add this permission next to the others:

```xml
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Add this inside `<application>`:

```xml
      <receiver android:name=".device.ReminderReceiver" android:exported="false" />
```

In `VeDeviceModule.kt`, add:

```kotlin
    override fun scheduleReminder(
        workDate: String,
        reminderTime: String,
        timezone: String,
        title: String,
        body: String,
        promise: Promise,
    ) = respond(promise) { Reminder.schedule(reactContext, workDate, reminderTime, timezone, title, body) }

    override fun cancelReminder(promise: Promise) = respond(promise) {
        Reminder.cancel(reactContext)
        null
    }
```

- [ ] **Step 7: Build, suite, commit**

Run: `cd apps/mobile/android && ./gradlew assembleDebug --no-daemon -q > /tmp/vehr-build.log 2>&1; tail -20 /tmp/vehr-build.log`
Expected: `BUILD SUCCESSFUL`.

Run: `pnpm --filter @ve/mobile test && pnpm lint && pnpm typecheck`
Expected: all green.

```bash
git add apps/mobile
git commit -m "add evening check-out reminder notification"
```

---

### Task 6: Theme, fonts, icons, i18n and base UI components

**Files:**
- Create: `apps/mobile/scripts/fetch-fonts.sh`, `apps/mobile/android/app/src/main/assets/fonts/*.ttf` (7 files, OFL)
- Create: `apps/mobile/src/theme/tokens.ts`
- Create: `apps/mobile/src/i18n/index.ts`, `apps/mobile/src/i18n/en.json`
- Create: `apps/mobile/src/ui/{Icon,Text,Button,Screen,TextField,Banner,Card,TabBar,Centered}.tsx`
- Modify: `apps/mobile/jest.setup.js` (svg mock, i18n init), `apps/mobile/tsconfig.json` (`resolveJsonModule`)
- Test: `apps/mobile/i18n-keys.test.js`, `apps/mobile/src/ui/Button.test.tsx`

**Interfaces:**
- Produces (`src/theme/tokens.ts`): `colors`, `fonts`, `radius`, `space`, `TOUCH_MIN = 64`. The token names are listed in the code below; later tasks use only these.
- Produces (`src/i18n/index.ts`): the default export `i18n`, initialised synchronously with `en`. Later tasks **add their own sections** to `en.json`. `i18n-keys.test.js` fails if any `t('…')` literal or any `…Key: '…'` string in `src` points to a missing key.
- Produces (`src/ui/*`):
  - `Icon({ name: IconName; size?: number; color?: string; strokeWidth?: number })`, with `type IconName` exported
  - `Text({ variant?: TextVariant; color?: string; style?; children; …TextProps })`, with `variant` one of `'display' | 'h1' | 'h2' | 'body' | 'bodyStrong' | 'label' | 'small' | 'mono' | 'monoLarge' | 'monoHuge'`
  - `Button({ label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'checkIn' | 'checkOut' | 'link'; size?: 'big' | 'large' | 'normal' | 'small'; icon?: IconName; disabled?: boolean; testID?: string })`
  - `Screen({ children; background?: string; edges?: Edge[]; style? })`: a safe-area root
  - `TextField({ label: string; error?: string | null; …TextInputProps })`
  - `Banner({ tone: 'warn' | 'info'; icon: IconName; title: string; body?: string })`
  - `Card({ children; style? })`
  - `TabBar({ state; navigation; items: Record<string, { icon: IconName; labelKey: string }>; height: number })`: pass it as `tabBar` to a bottom-tab navigator
  - `Loading()` and `ErrorState({ onRetry: () => void })` from `ui/Centered.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/mobile/i18n-keys.test.js` (plain JS at the app root: outside `tsconfig` and ignored by ESLint's `apps/mobile/*.js` rule, because it needs Node's `fs`):

```js
// Every literal t('…') key and every `…Key: '…'` string used in src must exist in en.json.
const fs = require('fs');
const path = require('path');
const en = require('./src/i18n/en.json');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

function hasKey(key) {
  const value = key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), en);
  return typeof value === 'string';
}

test('every translation key used in the app exists in en.json', () => {
  const missing = [];
  for (const file of sourceFiles(path.join(__dirname, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    const patterns = [/\bt\(\s*'([A-Za-z0-9_.]+)'/g, /Key:\s*'([A-Za-z0-9_.]+)'/g];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        if (!hasKey(match[1])) missing.push(`${path.relative(__dirname, file)}: ${match[1]}`);
      }
    }
  }
  expect(missing).toEqual([]);
});
```

`apps/mobile/src/ui/Button.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './Button';

test('calls onPress when tapped', () => {
  const onPress = jest.fn();
  render(<Button label="CHECK IN" variant="checkIn" size="big" icon="checkIn" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'CHECK IN' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a disabled button ignores taps and says so to screen readers', () => {
  const onPress = jest.fn();
  render(<Button label="Save" onPress={onPress} disabled />);
  const button = screen.getByRole('button', { name: 'Save' });
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  expect(button).toBeDisabled();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- i18n-keys Button`
Expected: FAIL. `Cannot find module './src/i18n/en.json'` and `Cannot find module './Button'`.

- [ ] **Step 3: Fonts**

`apps/mobile/scripts/fetch-fonts.sh`:

```bash
#!/usr/bin/env bash
# Downloads the Site Ledger fonts (SIL Open Font License) as static TTFs into the Android assets.
# Google Fonts serves TrueType to clients that do not send a browser User-Agent.
set -euo pipefail
dest="$(cd "$(dirname "$0")/.." && pwd)/android/app/src/main/assets/fonts"
mkdir -p "$dest"

fetch() { # family weight file
  local css url
  css=$(curl -fsS "https://fonts.googleapis.com/css2?family=$1:wght@$2")
  url=$(grep -o 'https://fonts.gstatic.com/[^)]*\.ttf' <<<"$css" | head -1)
  [ -n "$url" ] || { echo "no ttf for $1 $2" >&2; exit 1; }
  curl -fsSL "$url" -o "$dest/$3.ttf"
  echo "saved $3.ttf"
}

fetch Archivo 800 Archivo-ExtraBold
fetch Public+Sans 400 PublicSans-Regular
fetch Public+Sans 500 PublicSans-Medium
fetch Public+Sans 600 PublicSans-SemiBold
fetch Public+Sans 700 PublicSans-Bold
fetch IBM+Plex+Mono 500 IBMPlexMono-Medium
fetch IBM+Plex+Mono 600 IBMPlexMono-SemiBold
```

Run: `pnpm --filter @ve/mobile fonts && file apps/mobile/android/app/src/main/assets/fonts/*.ttf`
Expected: seven files, each reported as `TrueType Font data`. On Android the file name (without `.ttf`) is the `fontFamily`. Don't set `fontWeight` together with these families.

- [ ] **Step 4: Tokens**

`apps/mobile/src/theme/tokens.ts`:

```ts
/** Site Ledger theme (docs/design/README.md). */
export const colors = {
  bg: '#F4F1EA',
  surface: '#FFFFFF',
  text: '#1B1D1F',
  muted: '#4A4944',
  line: '#DDD6C8',
  lineSoft: '#EDE7DA',
  inputBorder: '#CFC7B6',
  dark: '#1B1D1F',
  onDark: '#F4F1EA',
  white: '#FFFFFF',

  checkIn: '#1E6B45',
  checkInShadow: '#144A30',
  checkOut: '#B8480F',
  checkOutShadow: '#7E300A',
  workingSub: '#D5EEDF',
  workingDot: '#8FE0B1',

  successBg: '#E3F0E8',
  successText: '#123D28',
  successMuted: '#2E5140',

  problemBg: '#FBEBDD',
  problemText: '#5C2306',
  problemMuted: '#6B3A1C',

  warnBg: '#FCEBD0',
  warnBorder: '#E3A64B',
  warnText: '#5A2E00',
  warnMuted: '#7A3E00',
  warnIconBg: '#F6D39B',

  info: '#1F4E8C',
  infoBg: '#E1EAF6',
  infoRing: '#C9D8EC',
  infoHalo: '#E6EDF6',
  infoText: '#16365F',
} as const;

export const fonts = {
  heading: 'Archivo-ExtraBold',
  body: 'PublicSans-Regular',
  bodyMedium: 'PublicSans-Medium',
  bodySemi: 'PublicSans-SemiBold',
  bodyBold: 'PublicSans-Bold',
  mono: 'IBMPlexMono-Medium',
  monoSemi: 'IBMPlexMono-SemiBold',
} as const;

export const radius = { sm: 10, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Minimum worker touch target (spec §9). */
export const TOUCH_MIN = 64;
```

- [ ] **Step 5: i18n**

In `apps/mobile/tsconfig.json`, add `"resolveJsonModule": true` to `compilerOptions`.

`apps/mobile/src/i18n/en.json` (base sections; later tasks add theirs):

```json
{
  "app": { "name": "VE HR" },
  "common": {
    "tryAgain": "Try again",
    "ok": "OK",
    "cancel": "Cancel",
    "save": "Save",
    "done": "Done",
    "back": "Back",
    "close": "Close",
    "loading": "Loading…",
    "loadMore": "Load more",
    "logout": "Log out",
    "noInternet": "No internet",
    "noInternetHelp": "Check your connection and try again"
  },
  "date": {
    "weekdays": "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
    "weekdaysShort": "Sun,Mon,Tue,Wed,Thu,Fri,Sat",
    "months": "January,February,March,April,May,June,July,August,September,October,November,December",
    "monthsShort": "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec",
    "am": "AM",
    "pm": "PM",
    "hoursMinutes": "{{h}} h {{m}} min",
    "hoursMinutesShort": "{{h}}h {{m}}m"
  },
  "tabs": {
    "home": "Home",
    "history": "My attendance",
    "today": "Today",
    "employees": "Employees",
    "sites": "Sites",
    "attendance": "Attendance"
  }
}
```

`apps/mobile/src/i18n/index.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

// Resources are bundled, so init completes synchronously. Hindi and Marathi are added later as more resources.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
```

Append to `apps/mobile/jest.setup.js`:

```js
require('./src/i18n');

jest.mock('react-native-svg', () => {
  const React = require('react');
  const host = (name) => {
    const Component = (props) => React.createElement(name, props, props.children);
    Component.displayName = name;
    return Component;
  };
  return { __esModule: true, default: host('Svg'), Svg: host('Svg'), Path: host('Path') };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
```

- [ ] **Step 6: UI components**

`apps/mobile/src/ui/Icon.tsx`:

```tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

const PATHS = {
  checkIn: ['M15 4h4v16h-4', 'm10 16 4-4-4-4', 'M14 12H3'],
  checkOut: ['M9 4H5v16h4', 'm14 16 4-4-4-4', 'M18 12H8'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  home: ['M3 11 12 4l9 7', 'M5 10v10h14V10'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18M8 3v4M16 3v4'],
  pin: ['M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z', 'M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
  check: ['M20 6 9 17l-5-5'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  signal: ['M4 20v-3', 'M9 20v-7', 'M14 20V9', 'M19 20V4'],
  fence: ['M4 21V6l2-2 2 2v15', 'M16 21V6l2-2 2 2v15', 'M8 10h8M8 16h8'],
  info: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', 'M12 16v-4', 'M12 8h.01'],
  person: ['M20 21a8 8 0 0 0-16 0', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'],
  wifiOff: ['M2 2l20 20', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 12.9a10 10 0 0 1 5.2-2.8', 'M19 12.9a10 10 0 0 0-2.4-1.7', 'M12 20h.01'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10 21h4'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  search: ['M21 21l-4.3-4.3', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  users: ['M16 21a6 6 0 0 0-12 0', 'M14 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M22 21a6 6 0 0 0-4-5.7', 'M16 4.1a4 4 0 0 1 0 7.8'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z', 'M9 4v14M15 6v14'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  locate: ['M12 2v3M12 19v3M2 12h3M19 12h3', 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'],
  backspace: ['M21 5H8l-6 7 6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z', 'M17 9l-6 6M11 9l6 6'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  refresh: ['M21 12a9 9 0 1 1-2.6-6.4', 'M21 3v6h-6'],
  key: ['M2 18v3h3l7.4-7.4', 'M17 11a5 5 0 1 0-5-5 5 5 0 0 0 5 5z'],
  close: ['M18 6 6 18M6 6l12 12'],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = colors.text, strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
```

`apps/mobile/src/ui/Text.tsx`:

```tsx
import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../theme/tokens';

const variants = {
  display: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 42 },
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 20 },
  monoLarge: { fontFamily: fonts.monoSemi, fontSize: 26, lineHeight: 32 },
  monoHuge: { fontFamily: fonts.monoSemi, fontSize: 44, lineHeight: 52 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof variants;

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
}

export function Text({ variant = 'body', color = colors.text, style, ...rest }: Props) {
  return <RNText maxFontSizeMultiplier={1.3} style={[variants[variant], { color }, style]} {...rest} />;
}
```

`apps/mobile/src/ui/Button.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, radius, TOUCH_MIN } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'checkIn' | 'checkOut' | 'link';
type Size = 'big' | 'large' | 'normal' | 'small';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
}

const palette: Record<Variant, { bg: string; fg: string; shadow?: string; border?: string }> = {
  primary: { bg: colors.dark, fg: colors.white },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.inputBorder },
  checkIn: { bg: colors.checkIn, fg: colors.white, shadow: colors.checkInShadow },
  checkOut: { bg: colors.checkOut, fg: colors.white, shadow: colors.checkOutShadow },
  link: { bg: 'transparent', fg: colors.info },
};

const heights: Record<Size, number> = { big: 150, large: 72, normal: 60, small: 48 };

export function Button({ label, onPress, variant = 'primary', size = 'normal', icon, disabled, testID }: Props) {
  const p = palette[variant];
  const big = size === 'big';
  const height = heights[size];
  return (
    <View style={[p.shadow && !disabled ? { backgroundColor: p.shadow, borderRadius: radius.xl, paddingBottom: 6 } : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: Math.max(height, size === 'small' ? 48 : TOUCH_MIN),
            backgroundColor: p.bg,
            borderRadius: big ? radius.xl : radius.lg,
            flexDirection: big ? 'column' : 'row',
            opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          },
          p.border ? { borderWidth: 1, borderColor: p.border } : null,
        ]}
      >
        {icon ? <Icon name={icon} size={big ? 40 : 22} color={p.fg} strokeWidth={big ? 2.2 : 2} /> : null}
        <Text
          color={p.fg}
          style={{
            fontFamily: big || size === 'large' ? fonts.heading : fonts.bodyBold,
            fontSize: big ? 30 : size === 'large' ? 24 : size === 'small' ? 15 : 18,
            letterSpacing: big ? 0.6 : 0,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
});
```

`apps/mobile/src/ui/Screen.tsx`:

```tsx
import React, { type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

interface Props {
  children: ReactNode;
  background?: string;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, background = colors.bg, edges = ['top'], style }: Props) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: background }, style]}>
      {children}
    </SafeAreaView>
  );
}
```

`apps/mobile/src/ui/TextField.tsx`:

```tsx
import React from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';
import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...rest }: Props) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          {
            minHeight: 52,
            borderWidth: 1,
            borderColor: error ? colors.checkOut : colors.inputBorder,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.body,
            fontSize: 16,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="small" color={colors.checkOut}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
```

`apps/mobile/src/ui/Banner.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface Props {
  tone: 'warn' | 'info';
  icon: IconName;
  title: string;
  body?: string;
}

export function Banner({ tone, icon, title, body }: Props) {
  const warn = tone === 'warn';
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderRadius: radius.lg,
        borderWidth: 2,
        backgroundColor: warn ? colors.warnBg : colors.infoBg,
        borderColor: warn ? colors.warnBorder : colors.infoRing,
      }}
    >
      <Icon name={icon} color={warn ? colors.warnMuted : colors.info} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={warn ? colors.warnText : colors.infoText}>
          {title}
        </Text>
        {body ? <Text color={warn ? colors.warnMuted : colors.info}>{body}</Text> : null}
      </View>
    </View>
  );
}
```

`apps/mobile/src/ui/Card.tsx`:

```tsx
import React, { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme/tokens';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 }, style]}>{children}</View>;
}
```

`apps/mobile/src/ui/TabBar.tsx`:

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface Props extends BottomTabBarProps {
  items: Record<string, { icon: IconName; labelKey: string }>;
  height: number;
}

export function TabBar({ state, navigation, items, height }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: colors.surface,
        paddingBottom: insets.bottom,
      }}
    >
      {state.routes.map((route, index) => {
        const item = items[route.name];
        if (!item) return null;
        const focused = state.index === index;
        const color = focused ? colors.text : colors.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(item.labelKey)}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, height, alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Icon name={item.icon} size={26} color={color} />
            <Text
              color={color}
              style={{ fontFamily: focused ? fonts.bodyBold : fonts.bodyMedium, fontSize: height >= 76 ? 15 : 13 }}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

`apps/mobile/src/ui/Centered.tsx`:

```tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export function Loading() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.text} />
      <Text color={colors.muted}>{t('common.loading')}</Text>
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.bg }}>
      <Icon name="wifiOff" size={48} color={colors.muted} />
      <Text variant="h2">{t('common.noInternet')}</Text>
      <Text color={colors.muted} style={{ textAlign: 'center' }}>
        {t('common.noInternetHelp')}
      </Text>
      <Button label={t('common.tryAgain')} icon="refresh" onPress={onRetry} />
    </View>
  );
}
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @ve/mobile test`
Expected: all pass. `i18n-keys` passes because only `common.*` and `tabs.*` keys are used so far, and the Button tests pass 2/2.

- [ ] **Step 8: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

```bash
git add apps/mobile
git commit -m "add app theme, fonts, icons and basic parts"
```

---

### Task 7: API client: timeouts, typed errors, single-flight refresh, endpoints

**Files:**
- Create: `apps/mobile/src/api/errors.ts`, `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/tokenStore.ts`, `apps/mobile/src/api/endpoints.ts`
- Test: `apps/mobile/src/api/client.test.ts`, `apps/mobile/src/api/endpoints.test.ts`

**Interfaces:**
- Consumes: `secureStore` (Task 3).
- Produces (`src/api/errors.ts`):
  - `class ApiError extends Error { status: number; code: string; body: unknown }`
  - `class NetworkError extends Error { reason: 'timeout' | 'offline' | 'server' }`
- Produces (`src/api/client.ts`):
  - `type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'`
  - `type Query = Record<string, string | number | boolean | undefined>`
  - `interface RequestOptions { body?: unknown; query?: Query; headers?: Record<string, string>; auth?: boolean; timeoutMs?: number }`
  - `interface TokenStore { getRefreshToken(): Promise<string | null>; setRefreshToken(token: string | null): Promise<void> }`
  - `interface ApiClient { request<T>(method, path, options?): Promise<T>; startSession(tokens: AuthTokens): Promise<void>; endSession(): Promise<void>; getRefreshToken(): Promise<string | null>; onAuthLost(listener: (code: string) => void): () => void }`
  - `type FetchLike = (url: string, init: RequestInit) => Promise<Response>`
  - `createApiClient(options: { baseUrl: string; tokenStore: TokenStore; fetchImpl?: FetchLike; timeoutMs?: number }): ApiClient`
  - `buildUrl(baseUrl, path, query?): string`
- Produces (`src/api/tokenStore.ts`): `secureTokenStore: TokenStore`.
- Produces (`src/api/endpoints.ts`):
  - `createApi(client: ApiClient)`, with `type Api = ReturnType<typeof createApi>` and the methods `loginEmployee`, `loginAdmin`, `logout`, `me`, `today`, `myAttendance`, `checkIn`, `checkOut`, `dashboard`, `listEmployees`, `getEmployee`, `createEmployee`, `resetPin`, `listSites`, `getSite`, `createSite`, `updateSite`, `listAttendance` and `getAttendance` (signatures in Step 7)
  - `ATTENDANCE_RESULT_CODES: ReadonlySet<string>`

**Behaviour rules:**
- Every request times out after 15 s. A timeout, a failed connection, any 5xx, or a body that isn't JSON raises `NetworkError`. That means "unknown outcome", and the caller may retry.
- A 4xx raises `ApiError` with the server's `code`.
- The access token lives only in memory. The refresh token lives in `TokenStore`. With no access token, or on a 401, the client refreshes **once for all concurrent callers** and retries the request once.
- A refresh answered with 401 or 403, a second 401 after a fresh token, or any `ACCOUNT_INACTIVE` clears both tokens and notifies `onAuthLost` listeners **once**. A refresh that fails with `NetworkError` keeps the session.
- Attendance endpoints return the `AttendanceResult` body for the six business outcomes, even though the HTTP status is 403, 409 or 422.

- [ ] **Step 1: Write the failing client tests**

`apps/mobile/src/api/client.test.ts`:

```ts
import type { AuthTokens } from '@ve/shared';
import { createApiClient, type FetchLike, type TokenStore } from './client';
import { ApiError, NetworkError } from './errors';

type Req = { method: string; url: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body?: unknown };

function makeFetch(handler: (req: Req, signal?: AbortSignal | null) => Reply | Promise<Reply>) {
  const calls: Req[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const req: Req = {
      method: init.method ?? 'GET',
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(req);
    const reply = await handler(req, init.signal);
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      text: async () => (reply.body === undefined ? '' : JSON.stringify(reply.body)),
    } as Response;
  };
  return { fetchImpl, calls };
}

function memoryStore(initial: string | null = null): TokenStore & { value: string | null } {
  const store = {
    value: initial,
    getRefreshToken: async () => store.value,
    setRefreshToken: async (token: string | null) => {
      store.value = token;
    },
  };
  return store;
}

const tokens = (n: number): AuthTokens => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  user: { id: 'u1', role: 'employee', name: 'Anil', phone: '+919876543210', email: null, siteId: null },
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const refreshCalls = (calls: Req[]) => calls.filter((c) => c.url.endsWith('/auth/refresh')).length;

/** Server where only `validAccess` is accepted and `refresh-1` rotates to tokens(2). */
function server(validAccess = 'access-2') {
  return makeFetch(async (req) => {
    if (req.url.endsWith('/auth/refresh')) {
      await delay(5);
      return (req.body as { refreshToken: string }).refreshToken === 'refresh-1'
        ? { status: 200, body: tokens(2) }
        : { status: 401, body: { code: 'SESSION_EXPIRED', message: 'Please log in again' } };
    }
    return req.headers.Authorization === `Bearer ${validAccess}`
      ? { status: 200, body: { ok: true, url: req.url } }
      : { status: 401, body: { code: 'UNAUTHORIZED', message: 'Login required' } };
  });
}

test('sends JSON with the bearer token and builds the query string', async () => {
  const { fetchImpl, calls } = server('access-1');
  const client = createApiClient({ baseUrl: 'http://api.test/', tokenStore: memoryStore(), fetchImpl });
  await client.startSession(tokens(1));
  await client.request('POST', '/x', { body: { a: 1 }, query: { from: '2026-09-01', skip: undefined } });
  expect(calls[0]).toMatchObject({
    method: 'POST',
    url: 'http://api.test/x?from=2026-09-01',
    body: { a: 1 },
    headers: { Authorization: 'Bearer access-1', 'Content-Type': 'application/json' },
  });
});

test('4xx becomes ApiError with the server code', async () => {
  const { fetchImpl } = makeFetch(() => ({ status: 404, body: { code: 'NOT_FOUND', message: 'nope' } }));
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore(), fetchImpl });
  const err = await client.request('GET', '/x', { auth: false }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 404, code: 'NOT_FOUND' });
});

test('5xx, connection failure and timeout become NetworkError', async () => {
  const s500 = makeFetch(() => ({ status: 502 }));
  await expect(
    createApiClient({ baseUrl: 'http://a', tokenStore: memoryStore(), fetchImpl: s500.fetchImpl }).request('GET', '/x', { auth: false }),
  ).rejects.toMatchObject({ name: 'NetworkError', reason: 'server' });

  const offline: FetchLike = async () => {
    throw new TypeError('Network request failed');
  };
  await expect(
    createApiClient({ baseUrl: 'http://a', tokenStore: memoryStore(), fetchImpl: offline }).request('GET', '/x', { auth: false }),
  ).rejects.toMatchObject({ reason: 'offline' });

  const hang: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
  const err = await createApiClient({ baseUrl: 'http://a', tokenStore: memoryStore(), fetchImpl: hang, timeoutMs: 20 })
    .request('GET', '/x', { auth: false })
    .catch((e: unknown) => e);
  expect(err).toBeInstanceOf(NetworkError);
  expect(err).toMatchObject({ reason: 'timeout' });
});

test('with no access token it refreshes first and stores the rotated refresh token', async () => {
  const { fetchImpl, calls } = server();
  const store = memoryStore('refresh-1');
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  await expect(client.request('GET', '/me')).resolves.toMatchObject({ ok: true });
  expect(refreshCalls(calls)).toBe(1);
  expect(store.value).toBe('refresh-2');
});

test('concurrent requests share one refresh', async () => {
  const { fetchImpl, calls } = server();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore('refresh-1'), fetchImpl });
  await Promise.all([client.request('GET', '/me/today'), client.request('GET', '/me/attendance')]);
  expect(refreshCalls(calls)).toBe(1);
  expect(calls.filter((c) => c.headers.Authorization === 'Bearer access-2')).toHaveLength(2);
});

test('two 401s at once trigger one refresh', async () => {
  const { fetchImpl, calls } = server();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore(), fetchImpl });
  await client.startSession(tokens(1)); // access-1 is now expired on the server
  const results = await Promise.all([client.request('GET', '/a'), client.request('GET', '/b')]);
  expect(results).toEqual([expect.objectContaining({ ok: true }), expect.objectContaining({ ok: true })]);
  expect(refreshCalls(calls)).toBe(1);
});

test('refresh rejected ends the session once without retry loop', async () => {
  const { fetchImpl, calls } = server();
  const store = memoryStore();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  const lost = jest.fn();
  client.onAuthLost(lost);
  await client.startSession({ ...tokens(1), refreshToken: 'refresh-revoked' });

  await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(calls).toHaveLength(2); // the 401 and one refresh, nothing else
  expect(store.value).toBeNull();
  expect(lost).toHaveBeenCalledTimes(1);
  expect(lost).toHaveBeenCalledWith('SESSION_EXPIRED');

  await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(calls).toHaveLength(2); // no token left, so no request is even attempted
  expect(lost).toHaveBeenCalledTimes(1);
});

test('ACCOUNT_INACTIVE ends the session', async () => {
  const { fetchImpl } = makeFetch(() => ({ status: 403, body: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' } }));
  const store = memoryStore();
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  const lost = jest.fn();
  client.onAuthLost(lost);
  await client.startSession(tokens(1));
  await expect(client.request('GET', '/me/today')).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
  expect(lost).toHaveBeenCalledWith('ACCOUNT_INACTIVE');
  expect(store.value).toBeNull();
});

test('a refresh that fails for lack of network keeps the session', async () => {
  const fetchImpl: FetchLike = async () => {
    throw new TypeError('Network request failed');
  };
  const store = memoryStore('refresh-1');
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store, fetchImpl });
  const lost = jest.fn();
  client.onAuthLost(lost);
  await expect(client.request('GET', '/me')).rejects.toBeInstanceOf(NetworkError);
  expect(store.value).toBe('refresh-1');
  expect(lost).not.toHaveBeenCalled();
});

test('auth:false requests never send a token or refresh', async () => {
  const { fetchImpl, calls } = makeFetch(() => ({ status: 204 }));
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore('refresh-1'), fetchImpl });
  await expect(client.request('POST', '/auth/logout', { auth: false, body: {} })).resolves.toBeUndefined();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.headers.Authorization).toBeUndefined();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/api/client.test.ts`
Expected: FAIL with `Cannot find module './client'`.

- [ ] **Step 3: Implement errors and client**

`apps/mobile/src/api/errors.ts`:

```ts
/** The server answered with a 4xx and a `{ code, message }` body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** We do not know what the server did: timeout, no connection, 5xx or unreadable reply. */
export class NetworkError extends Error {
  constructor(
    readonly reason: 'timeout' | 'offline' | 'server',
    message: string = reason,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
```

`apps/mobile/src/api/client.ts`:

```ts
import type { AuthTokens } from '@ve/shared';
import { ApiError, NetworkError } from './errors';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type Query = Record<string, string | number | boolean | undefined>;
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** false = public endpoint: no token, no refresh. */
  auth?: boolean;
  timeoutMs?: number;
}

export interface TokenStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
}

export interface ApiClient {
  request<T>(method: Method, path: string, options?: RequestOptions): Promise<T>;
  startSession(tokens: AuthTokens): Promise<void>;
  endSession(): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  onAuthLost(listener: (code: string) => void): () => void;
}

interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${baseUrl.replace(/\/+$/, '')}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

export function createApiClient({
  baseUrl,
  tokenStore,
  fetchImpl = (url, init) => fetch(url, init),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions): ApiClient {
  let accessToken: string | null = null;
  let refreshing: Promise<string> | null = null;
  const listeners = new Set<(code: string) => void>();

  async function send(method: Method, path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetchImpl(buildUrl(baseUrl, path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new NetworkError(controller.signal.aborted ? 'timeout' : 'offline', String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status >= 500) throw new NetworkError('server', `HTTP ${res.status}`);
    const text = await res.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new NetworkError('server', `Unreadable response (HTTP ${res.status})`);
      }
    }
    if (res.ok) return data as T;
    const body = (data ?? {}) as { code?: unknown; message?: unknown };
    throw new ApiError(
      res.status,
      typeof body.code === 'string' ? body.code : 'INTERNAL',
      typeof body.message === 'string' ? body.message : `HTTP ${res.status}`,
      data,
    );
  }

  /** Clears both tokens; tells listeners only if there was a session to lose. */
  async function loseSession(code: string): Promise<void> {
    const hadSession = accessToken !== null || (await tokenStore.getRefreshToken()) !== null;
    accessToken = null;
    await tokenStore.setRefreshToken(null);
    if (hadSession) listeners.forEach((listener) => listener(code));
  }

  async function doRefresh(): Promise<string> {
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) {
      accessToken = null;
      throw new ApiError(401, 'SESSION_EXPIRED', 'Please log in again', null);
    }
    try {
      const tokens = await parse<AuthTokens>(await send('POST', '/auth/refresh', { body: { refreshToken } }, null));
      if (tokens.refreshToken) await tokenStore.setRefreshToken(tokens.refreshToken);
      accessToken = tokens.accessToken;
      return tokens.accessToken;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) await loseSession(err.code);
      throw err;
    }
  }

  /** Single flight: the API rotates refresh tokens, so two parallel refreshes would burn the session. */
  function refreshAccess(): Promise<string> {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function finish<T>(res: Response): Promise<T> {
    try {
      return await parse<T>(res);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_INACTIVE') await loseSession(err.code);
      else if (err instanceof ApiError && err.status === 401) await loseSession('SESSION_EXPIRED');
      throw err;
    }
  }

  async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
    if (options.auth === false) return parse<T>(await send(method, path, options, null));
    const token = accessToken ?? (await refreshAccess());
    const first = await send(method, path, options, token);
    if (first.status !== 401) return finish<T>(first);
    // Someone else may already have refreshed while this request was in flight.
    const fresh = accessToken && accessToken !== token ? accessToken : await refreshAccess();
    return finish<T>(await send(method, path, options, fresh));
  }

  return {
    request,
    async startSession(tokens) {
      accessToken = tokens.accessToken;
      await tokenStore.setRefreshToken(tokens.refreshToken ?? null);
    },
    async endSession() {
      accessToken = null;
      await tokenStore.setRefreshToken(null);
    },
    getRefreshToken: () => tokenStore.getRefreshToken(),
    onAuthLost(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
```

`apps/mobile/src/api/tokenStore.ts`:

```ts
import { secureStore } from '../native/device';
import type { TokenStore } from './client';

const KEY = 'refreshToken';

export const secureTokenStore: TokenStore = {
  getRefreshToken: () => secureStore.get(KEY),
  setRefreshToken: (token) => (token ? secureStore.set(KEY, token) : secureStore.remove(KEY)),
};
```

- [ ] **Step 4: Run the client tests**

Run: `pnpm --filter @ve/mobile test -- src/api/client.test.ts`
Expected: PASS 10/10. If the `toBeInstanceOf(ApiError)` / `NetworkError` assertions fail, Babel is breaking `extends Error`; this is the test that catches it. Fix that before moving on (e.g. `Object.setPrototypeOf(this, new.target.prototype)` in both constructors) and record a ruling.

- [ ] **Step 5: Write the failing endpoint tests**

`apps/mobile/src/api/endpoints.test.ts`:

```ts
import type { AttendanceSubmit } from '@ve/shared';
import type { ApiClient } from './client';
import { createApi } from './endpoints';
import { ApiError } from './errors';

function clientReturning(impl: ApiClient['request']): ApiClient & { request: jest.Mock } {
  return {
    request: jest.fn(impl),
    startSession: jest.fn(),
    endSession: jest.fn(),
    getRefreshToken: jest.fn(),
    onAuthLost: jest.fn(),
  } as unknown as ApiClient & { request: jest.Mock };
}

const body: AttendanceSubmit = {
  lat: 18.59,
  lng: 73.73,
  accuracyM: 12,
  isMock: false,
  deviceTime: '2026-09-25T09:02:00.000+05:30',
  deviceId: 'device-1',
};

test('checkIn sends the idempotency key header', async () => {
  const client = clientReturning(async () => ({ code: 'OK', message: 'ok', serverTime: 'x' }) as never);
  await createApi(client).checkIn('key-1', body);
  expect(client.request).toHaveBeenCalledWith('POST', '/attendance/check-in', {
    body,
    headers: { 'Idempotency-Key': 'key-1' },
  });
});

test('business rejections come back as results, not errors', async () => {
  const result = { code: 'OUTSIDE_SITE', message: 'far', serverTime: 'x', distanceM: 120 };
  const client = clientReturning(async () => {
    throw new ApiError(422, 'OUTSIDE_SITE', 'far', result);
  });
  await expect(createApi(client).checkOut('key-1', body)).resolves.toEqual(result);
});

test('other API errors still throw', async () => {
  const client = clientReturning(async () => {
    throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'conflict', {});
  });
  await expect(createApi(client).checkIn('key-1', body)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
});

test('listEmployees sends isActive as the string the API expects and drops empty search', async () => {
  const client = clientReturning(async () => [] as never);
  await createApi(client).listEmployees({ q: '', isActive: false });
  expect(client.request).toHaveBeenCalledWith('GET', '/admin/employees', {
    query: { q: undefined, siteId: undefined, isActive: 'false' },
  });
});

test('login endpoints are public', async () => {
  const client = clientReturning(async () => ({}) as never);
  await createApi(client).loginEmployee({ phone: '9876543210', pin: '123456', deviceId: 'd' });
  expect(client.request).toHaveBeenCalledWith('POST', '/auth/employee/login', {
    auth: false,
    body: { phone: '9876543210', pin: '123456', deviceId: 'd' },
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @ve/mobile test -- src/api/endpoints.test.ts`
Expected: FAIL with `Cannot find module './endpoints'`.

- [ ] **Step 7: Implement endpoints**

`apps/mobile/src/api/endpoints.ts`:

```ts
import type {
  AdminDayDetailDto,
  AdminDayDto,
  AttendanceResult,
  AttendanceSubmit,
  AuthTokens,
  CreatedEmployeeDto,
  DashboardTodayDto,
  DayDto,
  EmployeeDetailDto,
  EmployeeDto,
  MeResponse,
  MeTodayResponse,
  Paginated,
  SiteDto,
} from '@ve/shared';
import type { ApiClient, Query } from './client';
import { ApiError } from './errors';

/** Outcomes the attendance endpoints report with a 403/409/422 but a normal AttendanceResult body. */
export const ATTENDANCE_RESULT_CODES: ReadonlySet<string> = new Set([
  'NO_SITE',
  'LOW_ACCURACY',
  'OUTSIDE_SITE',
  'ALREADY_CHECKED_IN',
  'ALREADY_CHECKED_OUT',
  'NOT_CHECKED_IN',
]);

export interface EmployeeLoginBody {
  phone: string;
  pin: string;
  deviceId: string;
  deviceModel?: string;
}

export interface AdminLoginBody {
  email: string;
  password: string;
  client: 'mobile';
  deviceId?: string;
  deviceModel?: string;
}

export interface EmployeeCreateBody {
  name: string;
  phone: string;
  employeeCode?: string;
  siteId?: string | null;
}

export interface SiteBody {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface SiteUpdateBody extends Partial<Omit<SiteBody, 'address'>> {
  /** null clears the address. */
  address?: string | null;
  isActive?: boolean;
}

export interface AttendanceListParams {
  from: string;
  to: string;
  employeeId?: string;
  page?: number;
  pageSize?: number;
}

export function createApi(client: ApiClient) {
  const get = <T>(path: string, query?: Query) => client.request<T>('GET', path, query ? { query } : undefined);

  async function submit(path: string, key: string, body: AttendanceSubmit): Promise<AttendanceResult> {
    try {
      return await client.request<AttendanceResult>('POST', path, { body, headers: { 'Idempotency-Key': key } });
    } catch (err) {
      if (err instanceof ApiError && ATTENDANCE_RESULT_CODES.has(err.code)) return err.body as AttendanceResult;
      throw err;
    }
  }

  return {
    loginEmployee: (body: EmployeeLoginBody) =>
      client.request<AuthTokens>('POST', '/auth/employee/login', { auth: false, body }),
    loginAdmin: (body: AdminLoginBody) => client.request<AuthTokens>('POST', '/auth/admin/login', { auth: false, body }),
    logout: (refreshToken: string) =>
      client.request<void>('POST', '/auth/logout', { auth: false, body: { refreshToken } }),

    me: () => get<MeResponse>('/me'),
    today: () => get<MeTodayResponse>('/me/today'),
    myAttendance: (from: string, to: string) => get<DayDto[]>('/me/attendance', { from, to }),
    checkIn: (key: string, body: AttendanceSubmit) => submit('/attendance/check-in', key, body),
    checkOut: (key: string, body: AttendanceSubmit) => submit('/attendance/check-out', key, body),

    dashboard: () => get<DashboardTodayDto>('/admin/dashboard/today'),
    listEmployees: (params: { q?: string; siteId?: string; isActive?: boolean }) =>
      get<EmployeeDto[]>('/admin/employees', {
        q: params.q?.trim() || undefined,
        siteId: params.siteId,
        isActive: params.isActive === undefined ? undefined : String(params.isActive),
      }),
    getEmployee: (id: string) => get<EmployeeDetailDto>(`/admin/employees/${id}`),
    createEmployee: (body: EmployeeCreateBody) =>
      client.request<CreatedEmployeeDto>('POST', '/admin/employees', { body }),
    resetPin: (id: string) => client.request<{ pin: string }>('POST', `/admin/employees/${id}/reset-pin`),

    listSites: () => get<SiteDto[]>('/admin/sites'),
    getSite: (id: string) => get<SiteDto>(`/admin/sites/${id}`),
    createSite: (body: SiteBody) => client.request<SiteDto>('POST', '/admin/sites', { body }),
    updateSite: (id: string, body: SiteUpdateBody) => client.request<SiteDto>('PATCH', `/admin/sites/${id}`, { body }),

    listAttendance: (params: AttendanceListParams) =>
      get<Paginated<AdminDayDto>>('/admin/attendance', { ...params }),
    getAttendance: (id: string) => get<AdminDayDetailDto>(`/admin/attendance/${id}`),
  };
}

export type Api = ReturnType<typeof createApi>;
```

- [ ] **Step 8: Run all API tests, lint, typecheck, commit**

Run: `pnpm --filter @ve/mobile test -- src/api && pnpm lint && pnpm typecheck`
Expected: PASS 15/15. Lint and typecheck are clean.

```bash
git add apps/mobile/src/api
git commit -m "add api client with safe token refresh"
```

---

### Task 8: Auth context, login screens, test helpers

The role inside the logged-in user decides which navigator mounts. `RootNavigator` is wired in Task 12, once both navigators exist. This task delivers:

- the session state machine
- the two login screens and their stack
- the service factory
- the helpers every later screen test uses

**Files:**
- Create: `apps/mobile/src/storageKeys.ts`, `apps/mobile/src/services.ts`
- Create: `apps/mobile/src/auth/{AuthContext.tsx,session.ts,loginErrors.ts}`
- Create: `apps/mobile/src/navigation/types.ts`, `apps/mobile/src/navigation/AuthNavigator.tsx`
- Create: `apps/mobile/src/screens/login/{WorkerLoginScreen,AdminLoginScreen}.tsx`
- Create: `apps/mobile/src/testing/{fakeApi.ts,render.tsx}`
- Modify: `apps/mobile/src/i18n/en.json` (add `login`)
- Test: `apps/mobile/src/auth/loginErrors.test.ts`, `apps/mobile/src/auth/AuthContext.test.tsx`, `apps/mobile/src/screens/login/WorkerLoginScreen.test.tsx`, `apps/mobile/src/screens/login/AdminLoginScreen.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 7: `ApiClient`, `createApiClient`, `FetchLike`, `Api`, `createApi`, `secureTokenStore`, `ApiError`, `NetworkError`
  - from Task 3: `getDeviceInfo`, `prefs`
  - from Task 5: `cancelCheckoutReminder`
- Produces:
  - `StorageKeys = { user: 'user', pendingAction: 'pendingAction' }`
  - `type AuthState = { status: 'loading' } | { status: 'loggedOut'; reason: string | null } | { status: 'loggedIn'; user: PublicUser }`
  - `interface AuthContextValue { state: AuthState; api: Api; loginEmployee(phone: string, pin: string): Promise<void>; loginAdmin(email: string, password: string): Promise<void>; logout(): Promise<void> }`
  - `AuthContext` (exported for tests), `AuthProvider({ client, api, children })`, `useAuth(): AuthContextValue`, `useUser(): PublicUser`
  - `clearLocalSession(): Promise<void>`, `loadCachedUser(): Promise<PublicUser | null>`, `saveCachedUser(user): Promise<void>`
  - `loginErrorKey(err: unknown, mode: 'worker' | 'admin'): string`, `lostReasonKey(reason: string | null): string | null`
  - `interface Services { client: ApiClient; api: Api; queryClient: QueryClient }` and `createServices(baseUrl: string, fetchImpl?: FetchLike): Services`
  - param lists `AuthStackParamList`, `WorkerTabParamList`, `AdminTabParamList`, `AttendanceStackParamList`, `EmployeesStackParamList`, `SitesStackParamList`
  - `AuthNavigator()`
  - test helpers:
    - `fakeApi(overrides?: Partial<Api>): Api`: an un-stubbed method rejects with "fakeApi.<name> not stubbed"
    - `renderWithAuth(ui, { api?, state?, auth? })`, which returns RNTL utils plus `{ auth, queryClient }`
    - `fakeNavigation()`, `employeeUser`, `adminUser`, `loggedIn(user)`

- [ ] **Step 1: Add the `login` strings**

Add this top-level section to `src/i18n/en.json`:

```json
  "login": {
    "title": "Log in",
    "subtitle": "Your phone number and PIN",
    "phone": "Phone number",
    "pin": "PIN",
    "pinEntered": "{{n}} of 6 digits entered",
    "deleteDigit": "Delete",
    "adminLink": "Admin login",
    "busy": "Logging in…",
    "adminTitle": "Admin login",
    "adminSubtitle": "Email and password",
    "email": "Email",
    "password": "Password",
    "submit": "Log in",
    "workerLink": "Worker login",
    "errors": {
      "wrong": "Wrong phone or PIN",
      "wrongAdmin": "Wrong email or password",
      "locked": "Too many tries. Wait 15 minutes",
      "inactive": "Please contact your supervisor",
      "tooMany": "Too many tries. Wait a minute",
      "invalidPhone": "Enter a valid phone number",
      "invalid": "Check what you typed",
      "network": "No internet. Try again",
      "generic": "Something went wrong. Try again",
      "sessionExpired": "Please log in again"
    }
  }
```

- [ ] **Step 2: Write the test helpers**

`apps/mobile/src/storageKeys.ts`:

```ts
/** Keys in the plain prefs store (NativeVeDevice prefGet/prefSet). */
export const StorageKeys = {
  user: 'user',
  pendingAction: 'pendingAction',
} as const;
```

`apps/mobile/src/testing/fakeApi.ts`:

```ts
import type { Api } from '../api/endpoints';

/** An Api whose unstubbed methods reject loudly, so a test never silently hits a default. */
export function fakeApi(overrides: Partial<Api> = {}): Api {
  return new Proxy(overrides, {
    get(target, prop) {
      if (prop === 'then') return undefined; // not a thenable
      if (prop in target) return target[prop as keyof Api];
      return () => Promise.reject(new Error(`fakeApi.${String(prop)} not stubbed`));
    },
  }) as Api;
}
```

`apps/mobile/src/testing/render.tsx`:

```tsx
import React, { type ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicUser } from '@ve/shared';
import { AuthContext, type AuthContextValue, type AuthState } from '../auth/AuthContext';
import type { Api } from '../api/endpoints';
import { fakeApi } from './fakeApi';

export const employeeUser: PublicUser = {
  id: 'emp-1',
  role: 'employee',
  name: 'Anil Pawar',
  phone: '+919876543210',
  email: null,
  siteId: 'site-1',
};

export const adminUser: PublicUser = {
  id: 'adm-1',
  role: 'admin',
  name: 'Priya Kulkarni',
  phone: null,
  email: 'admin@ve.test',
  siteId: null,
};

export const loggedIn = (user: PublicUser): AuthState => ({ status: 'loggedIn', user });

interface Options {
  api?: Api;
  state?: AuthState;
  auth?: Partial<AuthContextValue>;
}

export function renderWithAuth(ui: ReactElement, { api = fakeApi(), state = loggedIn(employeeUser), auth }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const value: AuthContextValue = {
    state,
    api,
    loginEmployee: jest.fn(async () => {}),
    loginAdmin: jest.fn(async () => {}),
    logout: jest.fn(async () => {}),
    ...auth,
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, auth: value, queryClient };
}

/** Screens take navigation/route as props; tests pass this instead of a real navigator. */
export function fakeNavigation() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
  };
}
```

- [ ] **Step 3: Write the failing tests**

`apps/mobile/src/auth/loginErrors.test.ts`:

```ts
import i18n from '../i18n';
import { ApiError, NetworkError } from '../api/errors';
import { loginErrorKey, lostReasonKey } from './loginErrors';

const api = (code: string, status = 401) => new ApiError(status, code, code, null);

test.each([
  [api('INVALID_CREDENTIALS'), 'worker', 'login.errors.wrong'],
  [api('INVALID_CREDENTIALS'), 'admin', 'login.errors.wrongAdmin'],
  [api('ACCOUNT_LOCKED', 423), 'worker', 'login.errors.locked'],
  [api('ACCOUNT_INACTIVE', 403), 'worker', 'login.errors.inactive'],
  [api('RATE_LIMITED', 429), 'admin', 'login.errors.tooMany'],
  [api('VALIDATION_ERROR', 400), 'worker', 'login.errors.wrong'],
  [api('VALIDATION_ERROR', 400), 'admin', 'login.errors.invalid'],
  [new NetworkError('offline'), 'worker', 'login.errors.network'],
  [new Error('boom'), 'worker', 'login.errors.generic'],
] as const)('%s (%s) → %s', (err, mode, key) => {
  expect(loginErrorKey(err, mode)).toBe(key);
  expect(i18n.exists(key)).toBe(true);
});

test('lost-session reasons map to a message', () => {
  expect(lostReasonKey(null)).toBeNull();
  expect(lostReasonKey('ACCOUNT_INACTIVE')).toBe('login.errors.inactive');
  expect(lostReasonKey('SESSION_EXPIRED')).toBe('login.errors.sessionExpired');
});
```

`apps/mobile/src/auth/AuthContext.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthTokens } from '@ve/shared';
import { createApiClient, type FetchLike } from '../api/client';
import { createApi } from '../api/endpoints';
import { secureTokenStore } from '../api/tokenStore';
import { fakeState } from '../testing/fakeNative';
import { employeeUser } from '../testing/render';
import { StorageKeys } from '../storageKeys';
import { AuthProvider, useAuth, type AuthContextValue } from './AuthContext';

const tokens: AuthTokens = { accessToken: 'access-1', refreshToken: 'refresh-1', user: employeeUser };

function setup(fetchImpl: FetchLike) {
  const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: secureTokenStore, fetchImpl });
  const api = createApi(client);
  let ctx: AuthContextValue | null = null;
  function Probe() {
    ctx = useAuth();
    const s = ctx.state;
    return <Text testID="state">{s.status === 'loggedOut' ? `loggedOut:${s.reason ?? ''}` : s.status}</Text>;
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider client={client} api={api}>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { api, auth: () => ctx as unknown as AuthContextValue };
}

const reply = (status: number, body?: unknown) =>
  ({ status, ok: status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

test('with nothing stored the app starts logged out', async () => {
  setup(async () => reply(500));
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:'));
});

test('a stored session starts logged in without any network call', async () => {
  fakeState.secure.set('refreshToken', 'refresh-1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(employeeUser));
  const fetchImpl = jest.fn<Promise<Response>, Parameters<FetchLike>>();
  setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedIn'));
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('employee login sends the device id and keeps the session', async () => {
  const fetchImpl = jest.fn<Promise<Response>, Parameters<FetchLike>>(async () => reply(200, tokens));
  const { auth } = setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:'));
  await act(() => auth().loginEmployee('98765 43210', '123456'));
  expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string)).toEqual({
    phone: '98765 43210',
    pin: '123456',
    deviceId: 'device-1',
    deviceModel: 'Test Phone',
  });
  expect(screen.getByTestId('state')).toHaveTextContent('loggedIn');
  expect(fakeState.secure.get('refreshToken')).toBe('refresh-1');
  expect(JSON.parse(fakeState.prefs.get(StorageKeys.user) ?? 'null')).toEqual(employeeUser);
});

test('auth loss returns to login with the reason', async () => {
  fakeState.secure.set('refreshToken', 'refresh-1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(employeeUser));
  fakeState.prefs.set(StorageKeys.pendingAction, '{"key":"k","action":"checkIn","workDate":"2026-09-25"}');
  fakeState.reminders = [{ workDate: '2026-09-25', reminderTime: '19:00', timezone: 'Asia/Kolkata', title: 't', body: 'b' }];
  const fetchImpl: FetchLike = async (url) =>
    url.endsWith('/auth/refresh') ? reply(200, tokens) : reply(403, { code: 'ACCOUNT_INACTIVE', message: 'inactive' });
  const { api } = setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedIn'));

  await expect(api.today()).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });

  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:ACCOUNT_INACTIVE'));
  expect(fakeState.secure.has('refreshToken')).toBe(false);
  expect(fakeState.prefs.has(StorageKeys.user)).toBe(false);
  expect(fakeState.prefs.has(StorageKeys.pendingAction)).toBe(false);
  expect(fakeState.reminders).toEqual([]);
});

test('logout clears the phone even when the server cannot be reached', async () => {
  fakeState.secure.set('refreshToken', 'refresh-1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(employeeUser));
  const fetchImpl = jest.fn<Promise<Response>, Parameters<FetchLike>>(async () => {
    throw new TypeError('Network request failed');
  });
  const { auth } = setup(fetchImpl);
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('loggedIn'));
  await act(() => auth().logout());
  expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.test/auth/logout');
  expect(screen.getByTestId('state')).toHaveTextContent('loggedOut:');
  expect(fakeState.secure.has('refreshToken')).toBe(false);
});
```

`apps/mobile/src/screens/login/WorkerLoginScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { fakeNavigation, renderWithAuth } from '../../testing/render';
import { WorkerLoginScreen } from './WorkerLoginScreen';

const loggedOut = (reason: string | null = null) => ({ status: 'loggedOut' as const, reason });

function renderLogin(loginEmployee = jest.fn(async () => {}), reason: string | null = null) {
  const navigation = fakeNavigation();
  renderWithAuth(<WorkerLoginScreen navigation={navigation as never} route={{} as never} />, {
    state: loggedOut(reason),
    auth: { loginEmployee },
  });
  return { navigation, loginEmployee };
}

function typePin(pin: string) {
  for (const digit of pin) fireEvent.press(screen.getByRole('button', { name: digit }));
}

test('phone plus six digits logs in', async () => {
  const { loginEmployee } = renderLogin();
  fireEvent.changeText(screen.getByLabelText('Phone number'), '98765 43210');
  typePin('123456');
  await waitFor(() => expect(loginEmployee).toHaveBeenCalledWith('98765 43210', '123456'));
});

test('an invalid phone number is caught before calling the server', async () => {
  const { loginEmployee } = renderLogin();
  fireEvent.changeText(screen.getByLabelText('Phone number'), '12345');
  typePin('123456');
  expect(await screen.findByText('Enter a valid phone number')).toBeOnTheScreen();
  expect(loginEmployee).not.toHaveBeenCalled();
});

test('a wrong PIN shows a plain message and clears the PIN', async () => {
  renderLogin(
    jest.fn(async () => {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid phone or PIN', null);
    }),
  );
  fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
  typePin('111111');
  expect(await screen.findByText('Wrong phone or PIN')).toBeOnTheScreen();
  expect(screen.getByLabelText('0 of 6 digits entered')).toBeOnTheScreen();
});

test('delete removes the last digit', () => {
  renderLogin();
  typePin('12');
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByLabelText('1 of 6 digits entered')).toBeOnTheScreen();
});

test('shows why the worker was logged out', () => {
  renderLogin(undefined, 'ACCOUNT_INACTIVE');
  expect(screen.getByText('Please contact your supervisor')).toBeOnTheScreen();
});

test('admin login link opens the admin screen', () => {
  const { navigation } = renderLogin();
  fireEvent.press(screen.getByRole('button', { name: 'Admin login' }));
  expect(navigation.navigate).toHaveBeenCalledWith('AdminLogin');
});
```

`apps/mobile/src/screens/login/AdminLoginScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { fakeNavigation, renderWithAuth } from '../../testing/render';
import { AdminLoginScreen } from './AdminLoginScreen';

function renderAdmin(loginAdmin = jest.fn(async () => {})) {
  const navigation = fakeNavigation();
  renderWithAuth(<AdminLoginScreen navigation={navigation as never} route={{} as never} />, {
    state: { status: 'loggedOut', reason: null },
    auth: { loginAdmin },
  });
  return { navigation, loginAdmin };
}

test('logs in with email and password', async () => {
  const { loginAdmin } = renderAdmin();
  fireEvent.changeText(screen.getByLabelText('Email'), 'admin@ve.test');
  fireEvent.changeText(screen.getByLabelText('Password'), 'long-password-1');
  fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(loginAdmin).toHaveBeenCalledWith('admin@ve.test', 'long-password-1'));
});

test('wrong credentials show a plain message', async () => {
  renderAdmin(
    jest.fn(async () => {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'x', null);
    }),
  );
  fireEvent.changeText(screen.getByLabelText('Email'), 'admin@ve.test');
  fireEvent.changeText(screen.getByLabelText('Password'), 'nope-nope-nope');
  fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByText('Wrong email or password')).toBeOnTheScreen();
});

test('worker login link goes back', () => {
  const { navigation } = renderAdmin();
  fireEvent.press(screen.getByRole('button', { name: 'Worker login' }));
  expect(navigation.goBack).toHaveBeenCalled();
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/auth src/screens/login`
Expected: FAIL with `Cannot find module` for `./loginErrors`, `./AuthContext` and the screen modules.

- [ ] **Step 5: Implement session helpers, errors, context, services**

`apps/mobile/src/auth/session.ts`:

```ts
import type { PublicUser } from '@ve/shared';
import { prefs } from '../native/device';
import { cancelCheckoutReminder } from '../native/reminder';
import { StorageKeys } from '../storageKeys';

export const loadCachedUser = () => prefs.getJson<PublicUser>(StorageKeys.user);

export const saveCachedUser = (user: PublicUser) => prefs.setJson(StorageKeys.user, user);

/** Everything on the phone that belongs to the signed-in person. Tokens are cleared by the API client. */
export async function clearLocalSession(): Promise<void> {
  await Promise.all([prefs.remove(StorageKeys.user), prefs.remove(StorageKeys.pendingAction)]);
  try {
    await cancelCheckoutReminder();
  } catch (err) {
    console.warn('session: could not cancel reminder', err);
  }
}
```

`apps/mobile/src/auth/loginErrors.ts`:

```ts
import { ApiError, NetworkError } from '../api/errors';

export function loginErrorKey(err: unknown, mode: 'worker' | 'admin'): string {
  if (err instanceof NetworkError) return 'login.errors.network';
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return mode === 'worker' ? 'login.errors.wrong' : 'login.errors.wrongAdmin';
      case 'ACCOUNT_LOCKED':
        return 'login.errors.locked';
      case 'ACCOUNT_INACTIVE':
        return 'login.errors.inactive';
      case 'RATE_LIMITED':
        return 'login.errors.tooMany';
      case 'VALIDATION_ERROR':
        // The phone is checked on the phone, so for workers this means a bad PIN or number.
        return mode === 'worker' ? 'login.errors.wrong' : 'login.errors.invalid';
    }
  }
  console.warn('login failed', err);
  return 'login.errors.generic';
}

export function lostReasonKey(reason: string | null): string | null {
  if (!reason) return null;
  return reason === 'ACCOUNT_INACTIVE' ? 'login.errors.inactive' : 'login.errors.sessionExpired';
}
```

`apps/mobile/src/auth/AuthContext.tsx`:

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthTokens, PublicUser } from '@ve/shared';
import type { ApiClient } from '../api/client';
import type { Api } from '../api/endpoints';
import { getDeviceInfo } from '../native/device';
import { clearLocalSession, loadCachedUser, saveCachedUser } from './session';

export type AuthState =
  | { status: 'loading' }
  | { status: 'loggedOut'; reason: string | null }
  | { status: 'loggedIn'; user: PublicUser };

export interface AuthContextValue {
  state: AuthState;
  api: Api;
  loginEmployee(phone: string, pin: string): Promise<void>;
  loginAdmin(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function useUser(): PublicUser {
  const { state } = useAuth();
  if (state.status !== 'loggedIn') throw new Error('useUser needs a logged-in user');
  return state.user;
}

interface Props {
  client: ApiClient;
  api: Api;
  children: ReactNode;
}

export function AuthProvider({ client, api, children }: Props) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const endLocal = useCallback(
    async (reason: string | null) => {
      await clearLocalSession();
      queryClient.clear();
      setState({ status: 'loggedOut', reason });
    },
    [queryClient],
  );

  useEffect(() => client.onAuthLost((code) => void endLocal(code)), [client, endLocal]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [refreshToken, user] = await Promise.all([client.getRefreshToken(), loadCachedUser()]);
      if (cancelled) return;
      if (refreshToken && user) {
        // Stay logged in across restarts; the first API call refreshes the access token.
        setState({ status: 'loggedIn', user });
        return;
      }
      await client.endSession();
      await clearLocalSession();
      if (!cancelled) setState({ status: 'loggedOut', reason: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const begin = useCallback(
    async (tokens: AuthTokens) => {
      await client.startSession(tokens);
      await saveCachedUser(tokens.user);
      setState({ status: 'loggedIn', user: tokens.user });
    },
    [client],
  );

  const loginEmployee = useCallback(
    async (phone: string, pin: string) => {
      const { deviceId, deviceModel } = await getDeviceInfo();
      await begin(await api.loginEmployee({ phone, pin, deviceId, deviceModel }));
    },
    [api, begin],
  );

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const { deviceId, deviceModel } = await getDeviceInfo();
      await begin(await api.loginAdmin({ email: email.trim(), password, client: 'mobile', deviceId, deviceModel }));
    },
    [api, begin],
  );

  const logout = useCallback(async () => {
    const refreshToken = await client.getRefreshToken();
    if (refreshToken) {
      try {
        await api.logout(refreshToken);
      } catch (err) {
        console.warn('logout: server call failed', err);
      }
    }
    await client.endSession();
    await endLocal(null);
  }, [api, client, endLocal]);

  const value = useMemo(
    () => ({ state, api, loginEmployee, loginAdmin, logout }),
    [state, api, loginEmployee, loginAdmin, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

`apps/mobile/src/services.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';
import { createApiClient, type ApiClient, type FetchLike } from './api/client';
import { createApi, type Api } from './api/endpoints';
import { NetworkError } from './api/errors';
import { secureTokenStore } from './api/tokenStore';

export interface Services {
  client: ApiClient;
  api: Api;
  queryClient: QueryClient;
}

export function createServices(baseUrl: string, fetchImpl?: FetchLike): Services {
  const client = createApiClient({ baseUrl, tokenStore: secureTokenStore, fetchImpl });
  const queryClient = new QueryClient({
    defaultOptions: {
      // Only network trouble is worth retrying; a 4xx will not change on its own.
      queries: { retry: (count, err) => err instanceof NetworkError && count < 2, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  return { client, api: createApi(client), queryClient };
}
```

- [ ] **Step 6: Navigation types and auth stack**

`apps/mobile/src/navigation/types.ts`:

```ts
import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  WorkerLogin: undefined;
  AdminLogin: undefined;
};

export type WorkerTabParamList = {
  Home: undefined;
  History: undefined;
};

export type AttendanceStackParamList = {
  AttendanceList: { employeeId?: string; employeeName?: string } | undefined;
  AttendanceDetail: { id: string };
};

export type EmployeesStackParamList = {
  Employees: undefined;
  EmployeeCreate: undefined;
  EmployeeDetail: { id: string };
};

export type SitesStackParamList = {
  Sites: undefined;
  SiteEdit: { id?: string };
};

export type AdminTabParamList = {
  TodayTab: undefined;
  EmployeesTab: NavigatorScreenParams<EmployeesStackParamList>;
  SitesTab: NavigatorScreenParams<SitesStackParamList>;
  AttendanceTab: NavigatorScreenParams<AttendanceStackParamList>;
};
```

`apps/mobile/src/navigation/AuthNavigator.tsx`:

```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminLoginScreen } from '../screens/login/AdminLoginScreen';
import { WorkerLoginScreen } from '../screens/login/WorkerLoginScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkerLogin" component={WorkerLoginScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 7: Login screens**

`apps/mobile/src/screens/login/WorkerLoginScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { normalizePhone } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { loginErrorKey, lostReasonKey } from '../../auth/loginErrors';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, radius, TOUCH_MIN } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

type Props = NativeStackScreenProps<AuthStackParamList, 'WorkerLogin'>;

const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export function WorkerLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { state, loginEmployee } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(
    state.status === 'loggedOut' ? lostReasonKey(state.reason) : null,
  );

  async function submit(fullPin: string) {
    if (!normalizePhone(phone)) {
      setErrorKey('login.errors.invalidPhone');
      setPin('');
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      await loginEmployee(phone, fullPin);
    } catch (err) {
      setErrorKey(loginErrorKey(err, 'worker'));
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function press(key: (typeof KEYS)[number]) {
    if (busy) return;
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(next);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, gap: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
            <Text color={colors.onDark} style={{ fontFamily: fonts.heading, fontSize: 16 }}>
              VE
            </Text>
          </View>
          <Text variant="h2" style={{ fontSize: 22 }}>
            {t('app.name')}
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text variant="h1" style={{ fontSize: 32 }}>
            {t('login.title')}
          </Text>
          <Text color={colors.muted}>{t('login.subtitle')}</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label">{t('login.phone')}</Text>
          <TextInput
            accessibilityLabel={t('login.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={16}
            editable={!busy}
            style={{
              height: TOUCH_MIN,
              borderWidth: 2,
              borderColor: colors.dark,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              backgroundColor: colors.surface,
              color: colors.text,
              fontFamily: fonts.monoSemi,
              fontSize: 24,
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label">{t('login.pin')}</Text>
          <View
            accessible
            accessibilityLabel={t('login.pinEntered', { n: pin.length })}
            style={{ flexDirection: 'row', gap: 8 }}
          >
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: radius.sm,
                  borderWidth: 2,
                  borderColor: i === pin.length ? colors.dark : colors.inputBorder,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i < pin.length ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.dark }} /> : null}
              </View>
            ))}
          </View>
        </View>

        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        {busy ? <Text color={colors.muted}>{t('login.busy')}</Text> : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KEYS.map((key, i) =>
            key === '' ? (
              <View key={`blank-${i}`} style={{ width: '31.5%' }} />
            ) : (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === 'del' ? t('login.deleteDigit') : key}
                onPress={() => press(key)}
                style={({ pressed }) => ({
                  width: '31.5%',
                  height: TOUCH_MIN,
                  borderRadius: radius.md,
                  backgroundColor: key === 'del' ? 'transparent' : pressed ? colors.lineSoft : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {key === 'del' ? (
                  <Icon name="backspace" size={28} />
                ) : (
                  <Text style={{ fontFamily: fonts.monoSemi, fontSize: 26 }}>{key}</Text>
                )}
              </Pressable>
            ),
          )}
        </View>

        <View style={{ flexGrow: 1 }} />
        <Button label={t('login.adminLink')} variant="link" size="small" onPress={() => navigation.navigate('AdminLogin')} />
      </ScrollView>
    </Screen>
  );
}
```

`apps/mobile/src/screens/login/AdminLoginScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { loginErrorKey } from '../../auth/loginErrors';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminLogin'>;

export function AdminLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErrorKey(null);
    try {
      await loginAdmin(email, password);
    } catch (err) {
      setErrorKey(loginErrorKey(err, 'admin'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text variant="h1">{t('login.adminTitle')}</Text>
          <Text color={colors.muted}>{t('login.adminSubtitle')}</Text>
        </View>
        <TextField
          label={t('login.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
        />
        <TextField
          label={t('login.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!busy}
        />
        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button
          label={busy ? t('login.busy') : t('login.submit')}
          onPress={() => void submit()}
          disabled={busy || !email.trim() || !password}
        />
        <Button label={t('login.workerLink')} variant="link" size="small" onPress={() => navigation.goBack()} />
      </ScrollView>
    </Screen>
  );
}
```

Note: the admin test presses the button by its name `Log in`, which is the label when not busy.

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter @ve/mobile test`
Expected: all pass: loginErrors 10, AuthContext 5, WorkerLogin 6, AdminLogin 3, plus the earlier suites and `i18n-keys`.

- [ ] **Step 9: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

```bash
git add apps/mobile/src
git commit -m "add login screens and keep workers logged in"
```

---

### Task 9: Attendance rules: formatting, result messages, home state, pending key

These are pure modules with no UI. They hold the rules the spec's Jest line asks for: the home state machine, error code → message mapping, and pending-key resume.

**Files:**
- Create: `apps/mobile/src/attendance/{format,messages,homeState,pendingAction}.ts`
- Modify: `apps/mobile/src/i18n/en.json` (add `result`)
- Test: `apps/mobile/src/attendance/{format,messages,homeState,pendingAction}.test.ts`

**Interfaces:**
- Consumes:
  - `prefs` and `randomUuid` (Task 3)
  - `StorageKeys` (Task 8)
  - `LocationProblem` (Task 4)
  - `IconName` (Task 6)
- Produces (`format.ts`, all using the phone's local zone):
  - `formatTime(iso, t, withSuffix = true): string`: "9:02 AM", or "9:02" without the suffix
  - `formatDuration(minutes, t, short = false): string`: "9 h 13 min", or "9h 04m" when short
  - `minutesSince(iso, now: Date): number`
  - `formatLongDate(date: Date, t): string`: "Friday, 25 September"
  - `formatWorkDateShort(workDate, t): string`: "Fri 25"
  - `formatWorkDateMedium(workDate, t): string`: "Fri 25 Sep"
  - `addDays(workDate, n): string`
  - `toIsoWithOffset(date: Date): string`: e.g. `2026-09-25T09:02:00.000+05:30`
- Produces (`messages.ts`):
  - `type AttendanceAction = 'checkIn' | 'checkOut'`
  - `type ClientCode = LocationProblem | 'NO_FIX' | 'NETWORK'`
  - `type Tone = 'success' | 'problem' | 'info'`
  - `type OutcomeAction = 'ok' | 'retry' | 'openAppSettings' | 'openLocationSettings'`
  - `interface OutcomeView { tone; icon: IconName; titleKey: string; titleParams?: Record<string, string | number>; detailKey?: string; time?: string; range?: { from: string; to: string | null }; actionKey: string; action: OutcomeAction }`
  - `outcomeView(code: string, action: AttendanceAction, result?: AttendanceResult): OutcomeView`
- Produces (`homeState.ts`):
  - `type HomeView = { kind: 'noSite' } | { kind: 'checkIn'; siteName: string } | { kind: 'working'; siteName: string; since: string } | { kind: 'done'; checkInAt: string; checkOutAt: string | null; workedMinutes: number | null }`
  - `homeView(today: MeTodayResponse): { view: HomeView; missedYesterday: boolean }`
- Produces (`pendingAction.ts`):
  - `interface PendingAction { key: string; action: AttendanceAction; workDate: string }`
  - `loadPending(): Promise<PendingAction | null>`, `savePending(p): Promise<void>`, `clearPending(): Promise<void>`
  - `keyFor(action, workDate): Promise<string>`: reuses a matching pending key, else creates **and saves** a new one before returning
  - `type PendingState = 'landed' | 'discard' | 'keep'`
  - `reconcilePending(p, today: MeTodayResponse): PendingState`

- [ ] **Step 1: Add the `result` strings**

Add this top-level section to `src/i18n/en.json`:

```json
  "result": {
    "saved": "Attendance saved",
    "checkedInAt": "Checked in at",
    "checkedOutAt": "Checked out at",
    "notSaved": "Not saved",
    "openSettings": "Open settings",
    "locationOff": "Turn on location",
    "locationOffHelp": "Location is off on this phone",
    "permissionDenied": "Allow location",
    "permissionHelp": "VE HR needs your location to save attendance",
    "preciseRequired": "Allow precise location",
    "preciseHelp": "Turn on \"Use precise location\"",
    "lowAccuracy": "Can't find you clearly",
    "lowAccuracyHelp": "Step outside and try again",
    "outside": "You are {{distance}} m away from the site",
    "outsideHelp": "Walk closer and try again",
    "alreadyIn": "Already checked in today",
    "alreadyOut": "Already checked out today",
    "notCheckedIn": "You have not checked in today",
    "contactSupervisor": "Please contact your supervisor",
    "network": "Not saved, no internet",
    "networkHelp": "Check your signal and try again"
  }
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/attendance/format.test.ts` (Jest runs with `TZ=Asia/Kolkata`):

```ts
import i18n from '../i18n';
import {
  addDays,
  formatDuration,
  formatLongDate,
  formatTime,
  formatWorkDateMedium,
  formatWorkDateShort,
  minutesSince,
  toIsoWithOffset,
} from './format';

const t = i18n.t.bind(i18n);

test('times are shown in 12-hour local time', () => {
  expect(formatTime('2026-09-25T03:32:00Z', t)).toBe('9:02 AM');
  expect(formatTime('2026-09-25T12:45:00Z', t)).toBe('6:15 PM');
  expect(formatTime('2026-09-25T18:30:00Z', t)).toBe('12:00 AM');
  expect(formatTime('2026-09-25T12:45:00Z', t, false)).toBe('6:15');
});

test('durations in long and short form', () => {
  expect(formatDuration(553, t)).toBe('9 h 13 min');
  expect(formatDuration(544, t, true)).toBe('9h 04m');
  expect(formatDuration(0, t, true)).toBe('0h 00m');
});

test('minutesSince never goes negative', () => {
  const now = new Date('2026-09-25T07:00:00Z');
  expect(minutesSince('2026-09-25T03:32:00Z', now)).toBe(208);
  expect(minutesSince('2026-09-25T08:00:00Z', now)).toBe(0);
});

test('dates', () => {
  expect(formatLongDate(new Date('2026-09-25T06:00:00Z'), t)).toBe('Friday, 25 September');
  expect(formatWorkDateShort('2026-09-25', t)).toBe('Fri 25');
  expect(formatWorkDateMedium('2026-09-25', t)).toBe('Fri 25 Sep');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(addDays('2026-09-25', -29)).toBe('2026-08-27');
});

test('device time carries the local offset, as the API schema requires', () => {
  expect(toIsoWithOffset(new Date('2026-09-25T03:32:00.123Z'))).toBe('2026-09-25T09:02:00.123+05:30');
});
```

`apps/mobile/src/attendance/messages.test.ts`:

```ts
import type { AttendanceResult, DayDto } from '@ve/shared';
import i18n from '../i18n';
import { outcomeView } from './messages';

const day: DayDto = {
  id: 'd1',
  workDate: '2026-09-25',
  siteId: 's1',
  status: 'COMPLETED',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: '2026-09-25T12:45:00Z',
  workedMinutes: 553,
  flags: [],
  needsReview: false,
};
const result = (code: string, extra: Partial<AttendanceResult> = {}): AttendanceResult =>
  ({ code, message: code, serverTime: '2026-09-25T12:45:00Z', ...extra }) as AttendanceResult;

test.each([
  ['LOCATION_OFF', 'problem', 'result.locationOff', 'openLocationSettings'],
  ['PERMISSION_DENIED', 'problem', 'result.permissionDenied', 'openAppSettings'],
  ['PRECISE_LOCATION_REQUIRED', 'problem', 'result.preciseRequired', 'openAppSettings'],
  ['LOW_ACCURACY', 'problem', 'result.lowAccuracy', 'retry'],
  ['NO_FIX', 'problem', 'result.lowAccuracy', 'retry'],
  ['OUTSIDE_SITE', 'problem', 'result.outside', 'retry'],
  ['ALREADY_CHECKED_IN', 'info', 'result.alreadyIn', 'ok'],
  ['ALREADY_CHECKED_OUT', 'info', 'result.alreadyOut', 'ok'],
  ['NOT_CHECKED_IN', 'info', 'result.notCheckedIn', 'ok'],
  ['NO_SITE', 'info', 'result.contactSupervisor', 'ok'],
  ['ACCOUNT_INACTIVE', 'info', 'result.contactSupervisor', 'ok'],
  ['NETWORK', 'problem', 'result.network', 'retry'],
  ['INTERNAL', 'problem', 'result.network', 'retry'],
  ['IDEMPOTENCY_KEY_CONFLICT', 'problem', 'result.network', 'retry'],
])('%s → %s / %s / %s', (code, tone, titleKey, action) => {
  const view = outcomeView(code, 'checkIn', result(code));
  expect(view).toMatchObject({ tone, titleKey, action });
  expect(i18n.exists(view.titleKey)).toBe(true);
  expect(i18n.exists(view.actionKey)).toBe(true);
  if (view.detailKey) expect(i18n.exists(view.detailKey)).toBe(true);
});

test('OK shows the saved time for the action', () => {
  expect(outcomeView('OK', 'checkIn', result('OK', { day }))).toMatchObject({
    tone: 'success',
    titleKey: 'result.saved',
    detailKey: 'result.checkedInAt',
    time: day.checkInAt,
  });
  expect(outcomeView('OK', 'checkOut', result('OK', { day }))).toMatchObject({
    detailKey: 'result.checkedOutAt',
    time: day.checkOutAt,
  });
});

test('OUTSIDE_SITE shows the distance', () => {
  expect(outcomeView('OUTSIDE_SITE', 'checkIn', result('OUTSIDE_SITE', { distanceM: 120 })).titleParams).toEqual({
    distance: 120,
  });
});

test('ALREADY_CHECKED_OUT shows the existing times', () => {
  expect(outcomeView('ALREADY_CHECKED_OUT', 'checkOut', result('ALREADY_CHECKED_OUT', { day })).range).toEqual({
    from: day.checkInAt,
    to: day.checkOutAt,
  });
});
```

`apps/mobile/src/attendance/homeState.test.ts`:

```ts
import type { DayDto, MeTodayResponse } from '@ve/shared';
import { homeView } from './homeState';

const site = { id: 's1', name: 'Plot 7, Hinjewadi', lat: 18.59, lng: 73.73, radiusM: 100 };
const base: MeTodayResponse = {
  serverTime: '2026-09-25T04:00:00Z',
  workDate: '2026-09-25',
  day: null,
  missedYesterday: false,
  site,
  maxAccuracyM: 50,
  reminderTime: '19:00',
  timezone: 'Asia/Kolkata',
};
const day = (status: DayDto['status'], extra: Partial<DayDto> = {}): DayDto => ({
  id: 'd1',
  workDate: '2026-09-25',
  siteId: 's1',
  status,
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  workedMinutes: null,
  flags: [],
  needsReview: false,
  ...extra,
});

test('no day yet and a site → check in', () => {
  expect(homeView(base)).toEqual({ view: { kind: 'checkIn', siteName: site.name }, missedYesterday: false });
});

test('no site assigned → contact supervisor, no button', () => {
  expect(homeView({ ...base, site: null }).view).toEqual({ kind: 'noSite' });
});

test('checked in → working since check-in time', () => {
  expect(homeView({ ...base, day: day('CHECKED_IN') }).view).toEqual({
    kind: 'working',
    siteName: site.name,
    since: '2026-09-25T03:32:00Z',
  });
});

test('checked in but the site was since removed still offers check-out', () => {
  expect(homeView({ ...base, site: null, day: day('CHECKED_IN') }).view.kind).toBe('working');
});

test('completed → done with times and minutes', () => {
  const done = day('COMPLETED', { checkOutAt: '2026-09-25T12:45:00Z', workedMinutes: 553 });
  expect(homeView({ ...base, day: done }).view).toEqual({
    kind: 'done',
    checkInAt: done.checkInAt,
    checkOutAt: done.checkOutAt,
    workedMinutes: 553,
  });
});

test("yesterday's missed checkout is reported alongside any state", () => {
  expect(homeView({ ...base, missedYesterday: true }).missedYesterday).toBe(true);
});
```

`apps/mobile/src/attendance/pendingAction.test.ts`:

```ts
import type { MeTodayResponse } from '@ve/shared';
import { fakeState } from '../testing/fakeNative';
import { StorageKeys } from '../storageKeys';
import { clearPending, keyFor, loadPending, reconcilePending, savePending } from './pendingAction';

const today = (extra: Partial<MeTodayResponse> = {}): MeTodayResponse => ({
  serverTime: '2026-09-25T04:00:00Z',
  workDate: '2026-09-25',
  day: null,
  missedYesterday: false,
  site: null,
  maxAccuracyM: 50,
  reminderTime: '19:00',
  timezone: 'Asia/Kolkata',
  ...extra,
});

test('keyFor saves the key before returning and reuses it for the same action and day', async () => {
  const first = await keyFor('checkIn', '2026-09-25');
  expect(JSON.parse(fakeState.prefs.get(StorageKeys.pendingAction) ?? 'null')).toEqual({
    key: first,
    action: 'checkIn',
    workDate: '2026-09-25',
  });
  expect(await keyFor('checkIn', '2026-09-25')).toBe(first);
});

test('keyFor discards a pending key from an earlier work date', async () => {
  await savePending({ key: 'yesterdays-key', action: 'checkIn', workDate: '2026-09-24' });
  const key = await keyFor('checkIn', '2026-09-25');
  expect(key).not.toBe('yesterdays-key');
  expect(await loadPending()).toEqual({ key, action: 'checkIn', workDate: '2026-09-25' });
});

test('keyFor uses a new key when the pending one was for the other action', async () => {
  await savePending({ key: 'in-key', action: 'checkIn', workDate: '2026-09-25' });
  expect(await keyFor('checkOut', '2026-09-25')).not.toBe('in-key');
});

test('a corrupt stored value is ignored', async () => {
  fakeState.prefs.set(StorageKeys.pendingAction, '{"key":42}');
  expect(await loadPending()).toBeNull();
  await clearPending();
  expect(fakeState.prefs.has(StorageKeys.pendingAction)).toBe(false);
});

test.each([
  ['an earlier work date', { key: 'k', action: 'checkIn', workDate: '2026-09-24' }, today(), 'discard'],
  ['check-in that reached the server', { key: 'k', action: 'checkIn', workDate: '2026-09-25' }, today({ day: { status: 'CHECKED_IN' } as never }), 'landed'],
  ['check-in that did not', { key: 'k', action: 'checkIn', workDate: '2026-09-25' }, today(), 'keep'],
  ['check-out that completed the day', { key: 'k', action: 'checkOut', workDate: '2026-09-25' }, today({ day: { status: 'COMPLETED' } as never }), 'landed'],
  ['check-out that did not', { key: 'k', action: 'checkOut', workDate: '2026-09-25' }, today({ day: { status: 'CHECKED_IN' } as never }), 'keep'],
] as const)('reconcile: %s → %s', (_name, pending, t, expected) => {
  expect(reconcilePending(pending, t)).toBe(expected);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/attendance`
Expected: FAIL, with `Cannot find module` for each of the four modules.

- [ ] **Step 4: Implement**

`apps/mobile/src/attendance/format.ts`:

```ts
import type { TFunction } from 'i18next';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const list = (t: TFunction, key: string) => t(key).split(',');

/** Local time, 12-hour: "9:02 AM". */
export function formatTime(iso: string, t: TFunction, withSuffix = true): string {
  const d = new Date(iso);
  const h = d.getHours();
  const clock = `${h % 12 || 12}:${pad(d.getMinutes())}`;
  return withSuffix ? `${clock} ${h >= 12 ? t('date.pm') : t('date.am')}` : clock;
}

/** "9 h 13 min", or "9h 04m" when short. */
export function formatDuration(minutes: number, t: TFunction, short = false): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return short ? t('date.hoursMinutesShort', { h, m: pad(m) }) : t('date.hoursMinutes', { h, m });
}

export function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
}

/** "Friday, 25 September" */
export function formatLongDate(date: Date, t: TFunction): string {
  return `${list(t, 'date.weekdays')[date.getDay()]}, ${date.getDate()} ${list(t, 'date.months')[date.getMonth()]}`;
}

const utcDate = (workDate: string) => new Date(`${workDate}T00:00:00Z`);

/** "Fri 25" */
export function formatWorkDateShort(workDate: string, t: TFunction): string {
  const d = utcDate(workDate);
  return `${list(t, 'date.weekdaysShort')[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** "Fri 25 Sep" */
export function formatWorkDateMedium(workDate: string, t: TFunction): string {
  const d = utcDate(workDate);
  return `${formatWorkDateShort(workDate, t)} ${list(t, 'date.monthsShort')[d.getUTCMonth()]}`;
}

export function addDays(workDate: string, n: number): string {
  const d = utcDate(workDate);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO 8601 with the phone's UTC offset, e.g. 2026-09-25T09:02:00.000+05:30. */
export function toIsoWithOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
```

`apps/mobile/src/attendance/messages.ts`:

```ts
import type { AttendanceResult } from '@ve/shared';
import type { LocationProblem } from '../native/location';
import type { IconName } from '../ui/Icon';

export type AttendanceAction = 'checkIn' | 'checkOut';
export type ClientCode = LocationProblem | 'NO_FIX' | 'NETWORK';
export type Tone = 'success' | 'problem' | 'info';
export type OutcomeAction = 'ok' | 'retry' | 'openAppSettings' | 'openLocationSettings';

export interface OutcomeView {
  tone: Tone;
  icon: IconName;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  detailKey?: string;
  /** ISO time shown large under the detail. */
  time?: string;
  /** Existing times for "already done" answers. */
  range?: { from: string; to: string | null };
  actionKey: string;
  action: OutcomeAction;
}

const retry = { actionKey: 'common.tryAgain', action: 'retry' } as const;
const ok = { actionKey: 'common.ok', action: 'ok' } as const;
const settings = { actionKey: 'result.openSettings' } as const;

/** Spec §5 "Result codes → employee messages". Unknown codes fall back to "Not saved, no internet". */
export function outcomeView(code: string, action: AttendanceAction, result?: AttendanceResult): OutcomeView {
  const day = result?.day;
  switch (code) {
    case 'OK':
      return {
        tone: 'success',
        icon: 'check',
        titleKey: 'result.saved',
        detailKey: action === 'checkIn' ? 'result.checkedInAt' : 'result.checkedOutAt',
        time: (action === 'checkIn' ? day?.checkInAt : day?.checkOutAt) ?? result?.serverTime,
        ...ok,
      };
    case 'LOCATION_OFF':
      return { tone: 'problem', icon: 'pin', titleKey: 'result.locationOff', detailKey: 'result.locationOffHelp', ...settings, action: 'openLocationSettings' };
    case 'PERMISSION_DENIED':
      return { tone: 'problem', icon: 'pin', titleKey: 'result.permissionDenied', detailKey: 'result.permissionHelp', ...settings, action: 'openAppSettings' };
    case 'PRECISE_LOCATION_REQUIRED':
      return { tone: 'problem', icon: 'pin', titleKey: 'result.preciseRequired', detailKey: 'result.preciseHelp', ...settings, action: 'openAppSettings' };
    case 'LOW_ACCURACY':
    case 'NO_FIX':
      return { tone: 'problem', icon: 'signal', titleKey: 'result.lowAccuracy', detailKey: 'result.lowAccuracyHelp', ...retry };
    case 'OUTSIDE_SITE':
      return {
        tone: 'problem',
        icon: 'fence',
        titleKey: 'result.outside',
        titleParams: { distance: result?.distanceM ?? '?' },
        detailKey: 'result.outsideHelp',
        ...retry,
      };
    case 'ALREADY_CHECKED_IN':
      return { tone: 'info', icon: 'info', titleKey: 'result.alreadyIn', detailKey: 'result.checkedInAt', time: day?.checkInAt, ...ok };
    case 'ALREADY_CHECKED_OUT':
      return {
        tone: 'info',
        icon: 'info',
        titleKey: 'result.alreadyOut',
        range: day ? { from: day.checkInAt, to: day.checkOutAt } : undefined,
        ...ok,
      };
    case 'NOT_CHECKED_IN':
      return { tone: 'info', icon: 'info', titleKey: 'result.notCheckedIn', ...ok };
    case 'NO_SITE':
    case 'ACCOUNT_INACTIVE':
    case 'FORBIDDEN':
      return { tone: 'info', icon: 'person', titleKey: 'result.contactSupervisor', ...ok };
    default:
      return { tone: 'problem', icon: 'wifiOff', titleKey: 'result.network', detailKey: 'result.networkHelp', ...retry };
  }
}
```

`apps/mobile/src/attendance/homeState.ts`:

```ts
import type { MeTodayResponse } from '@ve/shared';

export type HomeView =
  | { kind: 'noSite' }
  | { kind: 'checkIn'; siteName: string }
  | { kind: 'working'; siteName: string; since: string }
  | { kind: 'done'; checkInAt: string; checkOutAt: string | null; workedMinutes: number | null };

/** Spec §5 "Mobile home states". */
export function homeView(today: MeTodayResponse): { view: HomeView; missedYesterday: boolean } {
  const { day, site } = today;
  let view: HomeView;
  if (day?.status === 'CHECKED_IN') {
    view = { kind: 'working', siteName: site?.name ?? '', since: day.checkInAt };
  } else if (day) {
    // COMPLETED, or (defensively) MISSED_CHECKOUT, which the server only sets for past days.
    view = { kind: 'done', checkInAt: day.checkInAt, checkOutAt: day.checkOutAt, workedMinutes: day.workedMinutes };
  } else if (!site) {
    view = { kind: 'noSite' };
  } else {
    view = { kind: 'checkIn', siteName: site.name };
  }
  return { view, missedYesterday: today.missedYesterday };
}
```

`apps/mobile/src/attendance/pendingAction.ts`:

```ts
import type { MeTodayResponse } from '@ve/shared';
import { prefs, randomUuid } from '../native/device';
import { StorageKeys } from '../storageKeys';
import type { AttendanceAction } from './messages';

export interface PendingAction {
  key: string;
  action: AttendanceAction;
  workDate: string;
}

function isPending(value: unknown): value is PendingAction {
  const v = value as Partial<PendingAction> | null;
  return (
    !!v &&
    typeof v.key === 'string' &&
    (v.action === 'checkIn' || v.action === 'checkOut') &&
    typeof v.workDate === 'string'
  );
}

export async function loadPending(): Promise<PendingAction | null> {
  const stored = await prefs.getJson<unknown>(StorageKeys.pendingAction);
  return isPending(stored) ? stored : null;
}

export const savePending = (pending: PendingAction) => prefs.setJson(StorageKeys.pendingAction, pending);

export const clearPending = () => prefs.remove(StorageKeys.pendingAction);

/**
 * The idempotency key for this tap. Reuses the saved key for the same action and work date,
 * so a retry after a crash or timeout can never create a second record. A key from another day
 * or action is dropped. The key is on disk before this returns, i.e. before any network call.
 */
export async function keyFor(action: AttendanceAction, workDate: string): Promise<string> {
  const pending = await loadPending();
  if (pending && pending.action === action && pending.workDate === workDate) return pending.key;
  const key = await randomUuid();
  await savePending({ key, action, workDate });
  return key;
}

export type PendingState = 'landed' | 'discard' | 'keep';

export function reconcilePending(pending: PendingAction, today: MeTodayResponse): PendingState {
  if (pending.workDate !== today.workDate) return 'discard';
  if (pending.action === 'checkIn') return today.day ? 'landed' : 'keep';
  return today.day?.status === 'COMPLETED' ? 'landed' : 'keep';
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @ve/mobile test -- src/attendance i18n-keys`
Expected: PASS: format 5, messages 17, homeState 6, pendingAction 9, `i18n-keys` 1.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

```bash
git add apps/mobile/src
git commit -m "add attendance rules for messages and saved keys"
```

---

### Task 10: Submit flow: one tap from key to result, with ambiguous-outcome recovery

This task implements spec §5 "Client sequence" and "Ambiguous network outcomes". The worker only ever sees "Saved", a clear reason it wasn't saved, or "Not saved, try again". An unknown outcome is checked against `GET /me/today` before any resend. A resend always reuses the same key.

**Files:**
- Create: `apps/mobile/src/attendance/submitFlow.ts`, `apps/mobile/src/attendance/deps.ts`
- Modify: `apps/mobile/src/i18n/en.json` (add `reminder`)
- Test: `apps/mobile/src/attendance/submitFlow.test.ts`

**Interfaces:**
- Consumes:
  - from Task 9: `keyFor`, `loadPending`, `clearPending`, `reconcilePending`, `toIsoWithOffset`, `AttendanceAction`
  - from Task 7: `Api`, `ApiError`, `NetworkError`
  - from Tasks 3–5: `DeviceInfo`, `Fix`, `LocationProblem`, `ensureLocationReady`, `getBestFix`, `getDeviceInfo`, `scheduleCheckoutReminder`, `cancelCheckoutReminder`
- Produces (`submitFlow.ts`):
  - `type SubmitStep = 'locating' | 'saving' | 'checking'`
  - `interface SubmitOutcome { code: string; result?: AttendanceResult }`: `code` is `'OK'`, an API code or a `ClientCode`
  - `interface SubmitDeps { api: Pick<Api, 'checkIn' | 'checkOut' | 'today'>; ensureLocationReady(): Promise<LocationProblem | null>; getBestFix(targetAccuracyM: number): Promise<Fix | null>; deviceInfo(): Promise<DeviceInfo>; reminder: { schedule(today: MeTodayResponse): Promise<unknown>; cancel(): Promise<unknown> }; now(): Date }`
  - `submitAttendance(action: AttendanceAction, today: MeTodayResponse, deps: SubmitDeps, onStep?: (step: SubmitStep) => void): Promise<SubmitOutcome>`
  - `resumePendingOnLaunch(today: MeTodayResponse, deps: Pick<SubmitDeps, 'reminder'>): Promise<PendingState | null>`
- Produces (`deps.ts`): `createSubmitDeps(api: Api, t: TFunction): SubmitDeps` (real native wiring).

**Flow rules:**
1. Get the key (`keyFor`). It is saved before anything else happens.
2. Location check: a problem returns the problem code, and nothing is sent.
3. Best fix within 20 s. No reading at all returns `NO_FIX`, and nothing is sent.
4. Send. There are two possible replies:
   - **Any server answer** (`OK` or a business code): clear the key, update the reminder, return it.
   - **`NetworkError`**: show "Checking…" and call `today()`:
     - landed → clear the key and return `OK`
     - a different work date now → clear the key and return `NETWORK`
     - not landed → send again with the **same key**, at most 2 sends per tap
     - `today()` also fails → return `NETWORK` and keep the key
5. Other `ApiError`s are final: clear the key and return their code. The exceptions are 429 and 401, which keep the key; a 401 has already ended the session in the client.
6. Reminder:
   - check-in with `OK` or `ALREADY_CHECKED_IN` schedules it
   - check-out with `OK` or `ALREADY_CHECKED_OUT` cancels it
   - a reminder failure never changes the outcome

- [ ] **Step 1: Add the `reminder` strings**

Add to `src/i18n/en.json`:

```json
  "reminder": {
    "title": "Did you check out?",
    "body": "Open VE HR and tap CHECK OUT before you leave"
  }
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/attendance/submitFlow.test.ts`:

```ts
import type { AttendanceResult, DayDto, MeTodayResponse } from '@ve/shared';
import { ApiError, NetworkError } from '../api/errors';
import type { Fix, LocationProblem } from '../native/location';
import { fakeState } from '../testing/fakeNative';
import { StorageKeys } from '../storageKeys';
import { loadPending, savePending } from './pendingAction';
import { resumePendingOnLaunch, submitAttendance, type SubmitDeps } from './submitFlow';

const site = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100 };
const today = (extra: Partial<MeTodayResponse> = {}): MeTodayResponse => ({
  serverTime: '2026-09-25T03:32:00Z',
  workDate: '2026-09-25',
  day: null,
  missedYesterday: false,
  site,
  maxAccuracyM: 50,
  reminderTime: '19:00',
  timezone: 'Asia/Kolkata',
  ...extra,
});
const checkedIn: DayDto = {
  id: 'd1',
  workDate: '2026-09-25',
  siteId: 's1',
  status: 'CHECKED_IN',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  workedMinutes: null,
  flags: [],
  needsReview: false,
};
const ok = (day: DayDto = checkedIn): AttendanceResult => ({ code: 'OK', message: 'ok', serverTime: day.checkInAt, day });

function makeDeps(overrides: Partial<SubmitDeps['api']> = {}) {
  const deps = {
    api: {
      checkIn: jest.fn(async (_key: string) => ok()),
      checkOut: jest.fn(async (_key: string) => ok({ ...checkedIn, status: 'COMPLETED', checkOutAt: '2026-09-25T12:45:00Z' })),
      today: jest.fn(async () => today()),
      ...overrides,
    },
    ensureLocationReady: jest.fn<Promise<LocationProblem | null>, []>(async () => null),
    getBestFix: jest.fn<Promise<Fix | null>, [number]>(async () => ({ lat: 18.5912, lng: 73.7389, accuracyM: 12, isMock: false })),
    deviceInfo: jest.fn(async () => ({ ...fakeState.info })),
    reminder: { schedule: jest.fn(async () => true), cancel: jest.fn(async () => undefined) },
    now: () => new Date('2026-09-25T03:32:00.000Z'),
  };
  return deps as typeof deps & SubmitDeps;
}

const keysUsed = (mock: jest.Mock) => mock.mock.calls.map((call) => call[0] as string);

test('a check-in sends the fix, device details and local time, then schedules the reminder', async () => {
  const deps = makeDeps();
  const steps: string[] = [];
  const outcome = await submitAttendance('checkIn', today(), deps, (s) => steps.push(s));
  expect(outcome.code).toBe('OK');
  expect(deps.api.checkIn).toHaveBeenCalledWith(expect.any(String), {
    lat: 18.5912,
    lng: 73.7389,
    accuracyM: 12,
    isMock: false,
    deviceTime: '2026-09-25T09:02:00.000+05:30',
    deviceId: 'device-1',
    deviceModel: 'Test Phone',
    appVersion: '0.1.0',
  });
  expect(deps.getBestFix).toHaveBeenCalledWith(50);
  expect(steps).toEqual(['locating', 'saving']);
  expect(deps.reminder.schedule).toHaveBeenCalledWith(expect.objectContaining({ workDate: '2026-09-25' }));
  expect(await loadPending()).toBeNull();
});

test('the key is saved before the request goes out', async () => {
  let savedDuringSend: string | undefined;
  const deps = makeDeps({
    checkIn: jest.fn(async (key: string) => {
      savedDuringSend = JSON.parse(fakeState.prefs.get(StorageKeys.pendingAction) ?? '{}').key;
      expect(savedDuringSend).toBe(key);
      return ok();
    }),
  });
  await submitAttendance('checkIn', today(), deps);
  expect(savedDuringSend).toBeDefined();
});

test('a location problem stops before any request', async () => {
  const deps = makeDeps();
  deps.ensureLocationReady.mockResolvedValue('PRECISE_LOCATION_REQUIRED');
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('PRECISE_LOCATION_REQUIRED');
  expect(deps.getBestFix).not.toHaveBeenCalled();
  expect(deps.api.checkIn).not.toHaveBeenCalled();
});

test('no GPS reading at all is NO_FIX and nothing is sent', async () => {
  const deps = makeDeps();
  deps.getBestFix.mockResolvedValue(null);
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NO_FIX');
  expect(deps.api.checkIn).not.toHaveBeenCalled();
});

test('a server rejection is final: key cleared, no reminder', async () => {
  const outside: AttendanceResult = { code: 'OUTSIDE_SITE', message: 'far', serverTime: 'x', distanceM: 120 };
  const deps = makeDeps({ checkIn: jest.fn(async () => outside) });
  expect(await submitAttendance('checkIn', today(), deps)).toEqual({ code: 'OUTSIDE_SITE', result: outside });
  expect(await loadPending()).toBeNull();
  expect(deps.reminder.schedule).not.toHaveBeenCalled();
});

test('timeout after the server saved shows saved without resending', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new NetworkError('timeout');
    }),
    today: jest.fn(async () => today({ day: checkedIn })),
  });
  const steps: string[] = [];
  const outcome = await submitAttendance('checkIn', today(), deps, (s) => steps.push(s));
  expect(outcome.code).toBe('OK');
  expect(outcome.result?.day).toEqual(checkedIn);
  expect(deps.api.checkIn).toHaveBeenCalledTimes(1);
  expect(steps).toEqual(['locating', 'saving', 'checking']);
  expect(deps.reminder.schedule).toHaveBeenCalled();
  expect(await loadPending()).toBeNull();
});

test('timeout retries with the same key', async () => {
  const checkIn = jest
    .fn(async (_key: string) => ok())
    .mockRejectedValueOnce(new NetworkError('timeout'));
  const deps = makeDeps({ checkIn });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('OK');
  const [first, second] = keysUsed(checkIn);
  expect(checkIn).toHaveBeenCalledTimes(2);
  expect(second).toBe(first);
});

test('two unknown outcomes keep the key so Try again reuses it', async () => {
  const checkIn = jest.fn(async (_key: string): Promise<AttendanceResult> => {
    throw new NetworkError('offline');
  });
  const deps = makeDeps({ checkIn });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NETWORK');
  expect(checkIn).toHaveBeenCalledTimes(2);
  const pending = await loadPending();
  expect(pending?.key).toBe(keysUsed(checkIn)[0]);

  checkIn.mockImplementation(async () => ok());
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('OK');
  expect(new Set(keysUsed(checkIn)).size).toBe(1);
});

test('when the status check also fails the key is kept and nothing is resent', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new NetworkError('offline');
    }),
    today: jest.fn(async () => {
      throw new NetworkError('offline');
    }),
  });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NETWORK');
  expect(deps.api.checkIn).toHaveBeenCalledTimes(1);
  expect(await loadPending()).not.toBeNull();
});

test('midnight passing during the request drops the key', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new NetworkError('timeout');
    }),
    today: jest.fn(async () => today({ workDate: '2026-09-26' })),
  });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('NETWORK');
  expect(await loadPending()).toBeNull();
});

test('an idempotency conflict is final and clears the key', async () => {
  const deps = makeDeps({
    checkIn: jest.fn(async () => {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'conflict', {});
    }),
  });
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  expect(await loadPending()).toBeNull();
});

test('check-out cancels the reminder, also when already checked out', async () => {
  const deps = makeDeps();
  await submitAttendance('checkOut', today({ day: checkedIn }), deps);
  expect(deps.reminder.cancel).toHaveBeenCalledTimes(1);

  deps.api.checkOut.mockResolvedValue({ code: 'ALREADY_CHECKED_OUT', message: 'x', serverTime: 'x' } as AttendanceResult);
  await submitAttendance('checkOut', today({ day: checkedIn }), deps);
  expect(deps.reminder.cancel).toHaveBeenCalledTimes(2);
});

test('a reminder failure does not turn a saved check-in into an error', async () => {
  const deps = makeDeps();
  deps.reminder.schedule.mockRejectedValue(new Error('alarm service down'));
  expect((await submitAttendance('checkIn', today(), deps)).code).toBe('OK');
});

describe('resumePendingOnLaunch', () => {
  const reminder = () => ({ schedule: jest.fn(async () => true), cancel: jest.fn(async () => undefined) });

  test('a check-in that landed while the app was closed clears the key and sets the reminder', async () => {
    await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-25' });
    const r = reminder();
    expect(await resumePendingOnLaunch(today({ day: checkedIn }), { reminder: r })).toBe('landed');
    expect(r.schedule).toHaveBeenCalled();
    expect(await loadPending()).toBeNull();
  });

  test("yesterday's key is discarded without touching the reminder", async () => {
    await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-24' });
    const r = reminder();
    expect(await resumePendingOnLaunch(today(), { reminder: r })).toBe('discard');
    expect(r.schedule).not.toHaveBeenCalled();
    expect(await loadPending()).toBeNull();
  });

  test('a key that has not landed is kept for the next tap', async () => {
    await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-25' });
    expect(await resumePendingOnLaunch(today(), { reminder: reminder() })).toBe('keep');
    expect((await loadPending())?.key).toBe('k');
  });

  test('nothing pending → null', async () => {
    expect(await resumePendingOnLaunch(today(), { reminder: reminder() })).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @ve/mobile test -- src/attendance/submitFlow.test.ts`
Expected: FAIL with `Cannot find module './submitFlow'`.

- [ ] **Step 4: Implement**

`apps/mobile/src/attendance/submitFlow.ts`:

```ts
import type { AttendanceResult, AttendanceSubmit, MeTodayResponse } from '@ve/shared';
import type { Api } from '../api/endpoints';
import { ApiError, NetworkError } from '../api/errors';
import type { DeviceInfo } from '../native/device';
import type { Fix, LocationProblem } from '../native/location';
import { toIsoWithOffset } from './format';
import type { AttendanceAction } from './messages';
import { clearPending, keyFor, loadPending, reconcilePending, type PendingState } from './pendingAction';

export type SubmitStep = 'locating' | 'saving' | 'checking';

export interface SubmitOutcome {
  code: string;
  result?: AttendanceResult;
}

export interface SubmitDeps {
  api: Pick<Api, 'checkIn' | 'checkOut' | 'today'>;
  ensureLocationReady(): Promise<LocationProblem | null>;
  getBestFix(targetAccuracyM: number): Promise<Fix | null>;
  deviceInfo(): Promise<DeviceInfo>;
  reminder: { schedule(today: MeTodayResponse): Promise<unknown>; cancel(): Promise<unknown> };
  now(): Date;
}

const MAX_SENDS = 2;

async function updateReminder(action: AttendanceAction, code: string, today: MeTodayResponse, deps: Pick<SubmitDeps, 'reminder'>) {
  try {
    if (action === 'checkIn' && (code === 'OK' || code === 'ALREADY_CHECKED_IN')) await deps.reminder.schedule(today);
    if (action === 'checkOut' && (code === 'OK' || code === 'ALREADY_CHECKED_OUT')) await deps.reminder.cancel();
  } catch (err) {
    console.warn('attendance: reminder update failed', err);
  }
}

async function finalError(err: unknown): Promise<SubmitOutcome> {
  if (err instanceof ApiError) {
    // 429 may pass and 401 has already ended the session; every other 4xx is a final answer.
    if (err.status !== 429 && err.status !== 401) await clearPending();
    return { code: err.code };
  }
  console.warn('attendance: unexpected error', err);
  return { code: 'NETWORK' };
}

export async function submitAttendance(
  action: AttendanceAction,
  today: MeTodayResponse,
  deps: SubmitDeps,
  onStep: (step: SubmitStep) => void = () => {},
): Promise<SubmitOutcome> {
  const key = await keyFor(action, today.workDate);

  const problem = await deps.ensureLocationReady();
  if (problem) return { code: problem };

  onStep('locating');
  const fix = await deps.getBestFix(today.maxAccuracyM);
  if (!fix) return { code: 'NO_FIX' };

  const info = await deps.deviceInfo();
  const body: AttendanceSubmit = {
    lat: fix.lat,
    lng: fix.lng,
    accuracyM: fix.accuracyM,
    isMock: fix.isMock,
    deviceTime: toIsoWithOffset(deps.now()),
    deviceId: info.deviceId,
    deviceModel: info.deviceModel,
    appVersion: info.appVersion,
  };
  const send = (k: string) => (action === 'checkIn' ? deps.api.checkIn(k, body) : deps.api.checkOut(k, body));

  for (let attempt = 1; attempt <= MAX_SENDS; attempt++) {
    onStep('saving');
    try {
      const result = await send(key);
      await clearPending();
      await updateReminder(action, result.code, today, deps);
      return { code: result.code, result };
    } catch (err) {
      if (!(err instanceof NetworkError)) return finalError(err);
      console.warn(`attendance: unknown outcome (attempt ${attempt})`, err);
    }

    // We do not know whether the server saved it. Ask before sending again.
    onStep('checking');
    let fresh: MeTodayResponse;
    try {
      fresh = await deps.api.today();
    } catch (err) {
      console.warn('attendance: status check failed', err);
      return { code: 'NETWORK' };
    }
    const state = reconcilePending({ key, action, workDate: today.workDate }, fresh);
    if (state === 'landed') {
      await clearPending();
      await updateReminder(action, 'OK', fresh, deps);
      return {
        code: 'OK',
        result: { code: 'OK', message: 'Saved', serverTime: fresh.serverTime, day: fresh.day ?? undefined },
      };
    }
    if (state === 'discard') {
      await clearPending();
      return { code: 'NETWORK' };
    }
  }
  return { code: 'NETWORK' };
}

/** On app start: settle a key left behind by a crash or force-close (spec §5 client step 1). */
export async function resumePendingOnLaunch(
  today: MeTodayResponse,
  deps: Pick<SubmitDeps, 'reminder'>,
): Promise<PendingState | null> {
  const pending = await loadPending();
  if (!pending) return null;
  const state = reconcilePending(pending, today);
  if (state === 'landed') await updateReminder(pending.action, 'OK', today, deps);
  if (state !== 'keep') await clearPending();
  return state;
}
```

`apps/mobile/src/attendance/deps.ts`:

```ts
import type { TFunction } from 'i18next';
import type { Api } from '../api/endpoints';
import { getDeviceInfo } from '../native/device';
import { ensureLocationReady, getBestFix } from '../native/location';
import { cancelCheckoutReminder, scheduleCheckoutReminder } from '../native/reminder';
import type { SubmitDeps } from './submitFlow';

export function createSubmitDeps(api: Api, t: TFunction): SubmitDeps {
  return {
    api,
    ensureLocationReady,
    getBestFix: (targetAccuracyM) => getBestFix(targetAccuracyM),
    deviceInfo: getDeviceInfo,
    reminder: {
      schedule: (today) => scheduleCheckoutReminder(today, { title: t('reminder.title'), body: t('reminder.body') }),
      cancel: cancelCheckoutReminder,
    },
    now: () => new Date(),
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @ve/mobile test -- src/attendance`
Expected: PASS: submitFlow 17, plus the Task 9 suites.

- [ ] **Step 6: Suite, lint, typecheck, commit**

Run: `pnpm --filter @ve/mobile test && pnpm lint && pnpm typecheck`
Expected: all green.

```bash
git add apps/mobile/src
git commit -m "add check-in flow that never saves twice"
```

---

### Task 11: Worker screens: Home, result, history, menu

**Files:**
- Create: `apps/mobile/src/attendance/{queryKeys,history,useNow}.ts`
- Modify: `apps/mobile/src/attendance/format.ts` (add `formatHhMm`), `apps/mobile/src/attendance/format.test.ts`
- Create: `apps/mobile/src/screens/worker/{HomeScreen,BusyView,ResultView,HistoryScreen,MenuSheet}.tsx`
- Create: `apps/mobile/src/navigation/WorkerNavigator.tsx`
- Modify: `apps/mobile/src/i18n/en.json` (add `home`, `busy`, `history`, `menu`)
- Test: `apps/mobile/src/attendance/history.test.ts`, `apps/mobile/src/screens/worker/HomeScreen.test.tsx`, `apps/mobile/src/screens/worker/HistoryScreen.test.tsx`, `apps/mobile/src/navigation/WorkerNavigator.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 10: `submitAttendance`, `resumePendingOnLaunch`, `createSubmitDeps`, `SubmitStep`, `SubmitOutcome`
  - from Task 9: `homeView`, `outcomeView`, `format.*`
  - from Task 8: `useAuth`, `useUser`, `renderWithAuth`, `fakeApi`
  - from Task 6: `ui/*`, `TabBar`
  - from Task 4: `openAppSettings`, `openLocationSettings`
- Produces:
  - `queryKeys = { today: ['me', 'today'], history: (workDate: string) => ['me', 'attendance', workDate], dashboard: ['admin', 'dashboard'], employees: (filter: object) => ['admin', 'employees', filter], employee: (id: string) => ['admin', 'employee', id], sites: ['admin', 'sites'], site: (id: string) => ['admin', 'site', id], attendance: (params: object) => ['admin', 'attendance', params], attendanceDay: (id: string) => ['admin', 'attendanceDay', id] }` (the admin keys are used by Tasks 12–14)
  - `buildHistoryRows(today: string, days: DayDto[], count = 30): HistoryRow[]`, with `type HistoryRow = { workDate: string; kind: 'completed' | 'working' | 'missed' | 'absent'; checkInAt?: string; checkOutAt?: string | null; workedMinutes?: number | null }`
  - `useNow(intervalMs = 60_000): Date`
  - `formatHhMm(hhmm: string, t): string`: "19:00" → "7:00 PM"
  - `HomeScreen`, `HistoryScreen`, `WorkerNavigator`
  - `MenuSheet({ visible, onClose })`, `confirmLogout(t, logout, onDone?)`: both reused by the admin Today screen

- [ ] **Step 1: Add strings**

Add to `src/i18n/en.json`:

```json
  "home": {
    "greeting": "Namaste, {{name}}",
    "menu": "Menu",
    "yourSite": "Your site",
    "checkIn": "CHECK IN",
    "checkOut": "CHECK OUT",
    "checkInHint": "Stand inside the site, then tap",
    "working": "Working",
    "since": "Since {{time}}",
    "soFar": "{{site}} · {{duration}} so far",
    "reminderAt": "Reminder at {{time}}",
    "doneTitle": "Done for today",
    "worked": "{{duration}} worked",
    "missedTitle": "You did not check out yesterday",
    "missedBody": "Tell your supervisor",
    "noSiteTitle": "No site assigned",
    "noSiteBody": "Please contact your supervisor"
  },
  "busy": {
    "locating": "Finding your location…",
    "locatingHelp": "Stay still for a few seconds",
    "saving": "Saving…",
    "checking": "Checking…"
  },
  "history": {
    "title": "My attendance",
    "subtitle": "Last 30 days",
    "today": "Today, {{day}}",
    "notPresent": "Not present",
    "noCheckout": "No check-out · {{time}} – ?",
    "working": "Working · since {{time}}"
  },
  "menu": {
    "appVersion": "App version {{version}}",
    "logoutTitle": "Log out?",
    "logoutBody": "You will need your phone number and PIN to log in again."
  }
```

- [ ] **Step 2: Write the failing tests**

Append to `apps/mobile/src/attendance/format.test.ts`, and add `formatHhMm` to its import list:

```ts
test('company clock times are shown in 12-hour form', () => {
  expect(formatHhMm('19:00', t)).toBe('7:00 PM');
  expect(formatHhMm('00:05', t)).toBe('12:05 AM');
  expect(formatHhMm('12:30', t)).toBe('12:30 PM');
});
```

`apps/mobile/src/attendance/history.test.ts`:

```ts
import type { DayDto } from '@ve/shared';
import { buildHistoryRows } from './history';

const day = (workDate: string, status: DayDto['status'], extra: Partial<DayDto> = {}): DayDto => ({
  id: workDate,
  workDate,
  siteId: 's1',
  status,
  checkInAt: `${workDate}T03:32:00Z`,
  checkOutAt: status === 'COMPLETED' ? `${workDate}T12:45:00Z` : null,
  workedMinutes: status === 'COMPLETED' ? 553 : null,
  flags: [],
  needsReview: false,
  ...extra,
});

test('one row per day for 30 days, newest first, gaps are absent days', () => {
  const rows = buildHistoryRows('2026-09-25', [
    day('2026-09-25', 'CHECKED_IN'),
    day('2026-09-24', 'MISSED_CHECKOUT'),
    day('2026-09-22', 'COMPLETED'),
  ]);
  expect(rows).toHaveLength(30);
  expect(rows.slice(0, 4).map((r) => [r.workDate, r.kind])).toEqual([
    ['2026-09-25', 'working'],
    ['2026-09-24', 'missed'],
    ['2026-09-23', 'absent'],
    ['2026-09-22', 'completed'],
  ]);
  expect(rows[3]).toMatchObject({ workedMinutes: 553, checkOutAt: '2026-09-22T12:45:00Z' });
  expect(rows[29]?.workDate).toBe('2026-08-27');
});
```

`apps/mobile/src/screens/worker/HomeScreen.test.tsx`:

```tsx
import React from 'react';
import { Alert, Linking, PermissionsAndroid } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { AttendanceResult, DayDto, MeTodayResponse } from '@ve/shared';
import { NetworkError } from '../../api/errors';
import { loadPending, savePending } from '../../attendance/pendingAction';
import { fakeApi } from '../../testing/fakeApi';
import { fakeState } from '../../testing/fakeNative';
import { renderWithAuth } from '../../testing/render';
import { HomeScreen } from './HomeScreen';

const site = { id: 's1', name: 'Plot 7, Hinjewadi', lat: 18.59, lng: 73.73, radiusM: 100 };
const today = (extra: Partial<MeTodayResponse> = {}): MeTodayResponse => ({
  serverTime: '2026-09-25T03:30:00Z',
  workDate: '2026-09-25',
  day: null,
  missedYesterday: false,
  site,
  maxAccuracyM: 50,
  reminderTime: '19:00',
  timezone: 'Asia/Kolkata',
  ...extra,
});
const checkedIn: DayDto = {
  id: 'd1',
  workDate: '2026-09-25',
  siteId: 's1',
  status: 'CHECKED_IN',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  workedMinutes: null,
  flags: [],
  needsReview: false,
};
const completed: DayDto = { ...checkedIn, status: 'COMPLETED', checkOutAt: '2026-09-25T12:45:00Z', workedMinutes: 553 };
const okIn: AttendanceResult = { code: 'OK', message: 'ok', serverTime: checkedIn.checkInAt, day: checkedIn };

beforeEach(() => {
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: 'granted',
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted',
  } as never);
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
});

test('not checked in: CHECK IN saves, shows the time and sets the reminder', async () => {
  const api = fakeApi({ today: jest.fn(async () => today()), checkIn: jest.fn(async () => okIn) });
  renderWithAuth(<HomeScreen />, { api });
  expect(await screen.findByText('Plot 7, Hinjewadi')).toBeOnTheScreen();
  expect(screen.getByText('Namaste, Anil')).toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: 'CHECK IN' }));
  expect(await screen.findByText('Attendance saved')).toBeOnTheScreen();
  expect(screen.getByText('9:02 AM')).toBeOnTheScreen();
  expect(fakeState.reminders).toHaveLength(1);

  fireEvent.press(screen.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(screen.queryByText('Attendance saved')).toBeNull());
  await waitFor(() => expect(api.today).toHaveBeenCalledTimes(2));
});

test('a double tap sends only one request', async () => {
  const checkIn = jest.fn(() => new Promise<AttendanceResult>((resolve) => setTimeout(() => resolve(okIn), 20)));
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()), checkIn }) });
  const button = await screen.findByRole('button', { name: 'CHECK IN' });
  fireEvent.press(button);
  fireEvent.press(button);
  expect(await screen.findByText('Attendance saved')).toBeOnTheScreen();
  expect(checkIn).toHaveBeenCalledTimes(1);
});

test('outside the site: shows the distance, Not saved, and Try again sends again', async () => {
  const outside: AttendanceResult = { code: 'OUTSIDE_SITE', message: 'far', serverTime: 'x', distanceM: 120 };
  const checkIn = jest.fn(async () => outside);
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()), checkIn }) });
  fireEvent.press(await screen.findByRole('button', { name: 'CHECK IN' }));
  expect(await screen.findByText('You are 120 m away from the site')).toBeOnTheScreen();
  expect(screen.getByText('Not saved')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(2));
});

test('location off: nothing is sent and Open settings opens location settings', async () => {
  fakeState.locationEnabled = false;
  const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
  const checkIn = jest.fn(async () => okIn);
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()), checkIn }) });
  fireEvent.press(await screen.findByRole('button', { name: 'CHECK IN' }));
  expect(await screen.findByText('Turn on location')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
  expect(sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
  expect(checkIn).not.toHaveBeenCalled();
});

test('working: shows since time, reminder, and CHECK OUT', async () => {
  const checkOut = jest.fn(async () => ({ code: 'OK', message: 'ok', serverTime: 'x', day: completed }) as AttendanceResult);
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ day: checkedIn })), checkOut }) });
  expect(await screen.findByText('Since 9:02 AM')).toBeOnTheScreen();
  expect(screen.getByText('Reminder at 7:00 PM')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'CHECK OUT' }));
  expect(await screen.findByText('6:15 PM')).toBeOnTheScreen();
  expect(checkOut).toHaveBeenCalledTimes(1);
});

test('done: times and hours, no button', async () => {
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ day: completed })) }) });
  expect(await screen.findByText('Done for today')).toBeOnTheScreen();
  expect(screen.getByText('9:02 – 6:15')).toBeOnTheScreen();
  expect(screen.getByText('9 h 13 min worked')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /CHECK/ })).toBeNull();
});

test("yesterday's missed check-out shows a banner", async () => {
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ missedYesterday: true })) }) });
  expect(await screen.findByText('You did not check out yesterday')).toBeOnTheScreen();
  expect(screen.getByText('Tell your supervisor')).toBeOnTheScreen();
});

test('no site assigned: contact supervisor, no button', async () => {
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ site: null })) }) });
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'CHECK IN' })).toBeNull();
});

test('no internet on load: Try again reloads', async () => {
  const todayFn = jest
    .fn(async () => today())
    .mockRejectedValueOnce(new NetworkError('offline'));
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: todayFn }) });
  fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'CHECK IN' })).toBeOnTheScreen();
});

test('a check-in that landed before a force-close is settled on launch', async () => {
  await savePending({ key: 'k', action: 'checkIn', workDate: '2026-09-25' });
  renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today({ day: checkedIn })) }) });
  expect(await screen.findByText('Since 9:02 AM')).toBeOnTheScreen();
  await waitFor(async () => expect(await loadPending()).toBeNull());
  expect(fakeState.reminders).toHaveLength(1);
});

test('menu → Log out asks first, then logs out', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { auth } = renderWithAuth(<HomeScreen />, { api: fakeApi({ today: jest.fn(async () => today()) }) });
  fireEvent.press(await screen.findByRole('button', { name: 'Menu' }));
  fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
  const buttons = alert.mock.calls[0]?.[2] ?? [];
  expect(auth.logout).not.toHaveBeenCalled();
  await act(async () => buttons[1]?.onPress?.());
  expect(auth.logout).toHaveBeenCalled();
});
```

`apps/mobile/src/screens/worker/HistoryScreen.test.tsx`:

```tsx
import React from 'react';
import { screen } from '@testing-library/react-native';
import type { DayDto, MeTodayResponse } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { renderWithAuth } from '../../testing/render';
import { HistoryScreen } from './HistoryScreen';

const today = { workDate: '2026-09-25' } as MeTodayResponse;
const day = (workDate: string, status: DayDto['status'], out: string | null, minutes: number | null): DayDto => ({
  id: workDate,
  workDate,
  siteId: 's1',
  status,
  checkInAt: `${workDate}T03:32:00Z`,
  checkOutAt: out,
  workedMinutes: minutes,
  flags: [],
  needsReview: false,
});

test('lists the last 30 days with times, hours, missed and absent days', async () => {
  const myAttendance = jest.fn(async () => [
    day('2026-09-25', 'COMPLETED', '2026-09-25T12:45:00Z', 553),
    day('2026-09-24', 'MISSED_CHECKOUT', null, null),
  ]);
  renderWithAuth(<HistoryScreen />, { api: fakeApi({ today: jest.fn(async () => today), myAttendance }) });
  expect(await screen.findByText('Today, Fri 25')).toBeOnTheScreen();
  expect(screen.getByText('9:02 – 6:15')).toBeOnTheScreen();
  expect(screen.getByText('9h 13m')).toBeOnTheScreen();
  expect(screen.getByText('Thu 24')).toBeOnTheScreen();
  expect(screen.getByText('No check-out · 9:02 – ?')).toBeOnTheScreen();
  expect(screen.getAllByText('Not present').length).toBeGreaterThan(0);
  expect(myAttendance).toHaveBeenCalledWith('2026-08-27', '2026-09-25');
});
```

`apps/mobile/src/navigation/WorkerNavigator.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { MeTodayResponse } from '@ve/shared';
import { fakeApi } from '../testing/fakeApi';
import { renderWithAuth } from '../testing/render';
import { WorkerNavigator } from './WorkerNavigator';

test('two tabs: Home and My attendance', async () => {
  const api = fakeApi({
    today: jest.fn(async () => ({ workDate: '2026-09-25', site: null, day: null, missedYesterday: false }) as MeTodayResponse),
    myAttendance: jest.fn(async () => []),
  });
  renderWithAuth(
    <NavigationContainer>
      <WorkerNavigator />
    </NavigationContainer>,
    { api },
  );
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('tab', { name: 'My attendance' }));
  expect(await screen.findByText('Last 30 days')).toBeOnTheScreen();
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/attendance src/screens/worker src/navigation`
Expected: FAIL. `formatHhMm is not a function`, and `Cannot find module` for `./history`, `./HomeScreen`, `./HistoryScreen` and `./WorkerNavigator`.

- [ ] **Step 4: Implement the helpers**

Append to `apps/mobile/src/attendance/format.ts`:

```ts
/** Company clock time "19:00" → "7:00 PM". */
export function formatHhMm(hhmm: string, t: TFunction): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? t('date.pm') : t('date.am')}`;
}
```

`apps/mobile/src/attendance/queryKeys.ts`:

```ts
export const queryKeys = {
  today: ['me', 'today'] as const,
  history: (workDate: string) => ['me', 'attendance', workDate] as const,
  dashboard: ['admin', 'dashboard'] as const,
  employees: (filter: object) => ['admin', 'employees', filter] as const,
  employee: (id: string) => ['admin', 'employee', id] as const,
  sites: ['admin', 'sites'] as const,
  site: (id: string) => ['admin', 'site', id] as const,
  attendance: (params: object) => ['admin', 'attendance', params] as const,
  attendanceDay: (id: string) => ['admin', 'attendanceDay', id] as const,
};
```

`apps/mobile/src/attendance/history.ts`:

```ts
import type { DayDto } from '@ve/shared';
import { addDays } from './format';

export type HistoryRow = {
  workDate: string;
  kind: 'completed' | 'working' | 'missed' | 'absent';
  checkInAt?: string;
  checkOutAt?: string | null;
  workedMinutes?: number | null;
};

/** One row per calendar day, newest first; days without a record are "absent". */
export function buildHistoryRows(today: string, days: DayDto[], count = 30): HistoryRow[] {
  const byDate = new Map(days.map((d) => [d.workDate, d]));
  return Array.from({ length: count }, (_, i) => {
    const workDate = addDays(today, -i);
    const d = byDate.get(workDate);
    if (!d) return { workDate, kind: 'absent' };
    const kind = d.status === 'COMPLETED' ? 'completed' : d.status === 'CHECKED_IN' ? 'working' : 'missed';
    return { workDate, kind, checkInAt: d.checkInAt, checkOutAt: d.checkOutAt, workedMinutes: d.workedMinutes };
  });
}
```

`apps/mobile/src/attendance/useNow.ts`:

```ts
import { useEffect, useState } from 'react';

/** Re-renders the caller every intervalMs so "3 h 28 min so far" stays current. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

- [ ] **Step 5: Implement the worker screens**

`apps/mobile/src/screens/worker/BusyView.tsx`:

```tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SubmitStep } from '../../attendance/submitFlow';
import { colors } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

export function BusyView({ step }: { step: SubmitStep | 'starting' }) {
  const { t } = useTranslation();
  const locating = step === 'starting' || step === 'locating';
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 28 }}>
        <View style={{ width: 220, height: 220, borderRadius: 110, backgroundColor: colors.infoHalo, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: colors.infoRing, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.info, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={locating ? 'pin' : 'refresh'} size={40} color={colors.white} />
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text variant="h1" style={{ fontSize: 32, textAlign: 'center' }} accessibilityRole="header">
            {locating ? t('busy.locating') : step === 'saving' ? t('busy.saving') : t('busy.checking')}
          </Text>
          {locating ? <Text color={colors.muted} style={{ fontSize: 18 }}>{t('busy.locatingHelp')}</Text> : null}
        </View>
        <ActivityIndicator size="large" color={colors.info} />
      </View>
    </Screen>
  );
}
```

`apps/mobile/src/screens/worker/ResultView.tsx`:

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../../attendance/format';
import type { OutcomeView, Tone } from '../../attendance/messages';
import { colors, fonts } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

const TONES: Record<Tone, { bg: string; circle: string; text: string; muted: string }> = {
  success: { bg: colors.successBg, circle: colors.checkIn, text: colors.successText, muted: colors.successMuted },
  problem: { bg: colors.problemBg, circle: colors.checkOut, text: colors.problemText, muted: colors.problemMuted },
  info: { bg: colors.infoBg, circle: colors.info, text: colors.infoText, muted: colors.info },
};

export function ResultView({ view, onAction }: { view: OutcomeView; onAction: () => void }) {
  const { t } = useTranslation();
  const tone = TONES[view.tone];
  return (
    <Screen background={tone.bg} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 28 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <View style={{ width: 168, height: 168, borderRadius: 84, backgroundColor: tone.circle, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={view.icon} size={84} color={colors.white} strokeWidth={2.4} />
          </View>
          <Text variant="display" color={tone.text} style={{ textAlign: 'center' }} accessibilityRole="header">
            {t(view.titleKey, view.titleParams)}
          </Text>
          {view.detailKey ? (
            <Text color={tone.muted} style={{ fontSize: 18, textAlign: 'center' }}>
              {t(view.detailKey)}
            </Text>
          ) : null}
          {view.time ? (
            <Text variant="monoHuge" color={tone.text}>
              {formatTime(view.time, t)}
            </Text>
          ) : null}
          {view.range ? (
            <Text variant="monoLarge" color={tone.text}>
              {`${formatTime(view.range.from, t)} – ${view.range.to ? formatTime(view.range.to, t) : '?'}`}
            </Text>
          ) : null}
          {view.tone === 'problem' ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text variant="bodyStrong" color={tone.text}>
                {t('result.notSaved')}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(view.actionKey)}
          onPress={onAction}
          style={({ pressed }) => ({
            height: 72,
            borderRadius: 18,
            backgroundColor: tone.text,
            opacity: pressed ? 0.85 : 1,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {view.action === 'retry' ? <Icon name="refresh" color={colors.white} /> : null}
          <Text color={colors.white} style={{ fontFamily: fonts.heading, fontSize: 24 }}>
            {t(view.actionKey)}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
```

`apps/mobile/src/screens/worker/MenuSheet.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '../../auth/AuthContext';
import { getDeviceInfo } from '../../native/device';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';

/** Shared confirm-then-logout used by the worker menu and the admin Today screen. */
export function confirmLogout(t: TFunction, logout: () => Promise<void>, onDone?: () => void) {
  Alert.alert(t('menu.logoutTitle'), t('menu.logoutBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.logout'),
      style: 'destructive',
      onPress: () => {
        onDone?.();
        void logout();
      },
    },
  ]);
}

export function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useUser();
  const { logout } = useAuth();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    getDeviceInfo()
      .then((info) => setVersion(info.appVersion))
      .catch(() => setVersion(null));
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(27,29,31,0.4)' }} />
      <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 16 }}>
        <View style={{ gap: 2 }}>
          <Text variant="h2">{user.name}</Text>
          {user.phone ? <Text variant="mono" color={colors.muted}>{user.phone}</Text> : null}
        </View>
        <Button label={t('common.logout')} variant="secondary" icon="logout" onPress={() => confirmLogout(t, logout, onClose)} />
        <Button label={t('common.close')} variant="link" size="small" onPress={onClose} />
        {version ? (
          <Text variant="small" color={colors.muted} style={{ textAlign: 'center' }}>
            {t('menu.appVersion', { version })}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
```

`apps/mobile/src/screens/worker/HomeScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '../../auth/AuthContext';
import { createSubmitDeps } from '../../attendance/deps';
import { formatDuration, formatHhMm, formatLongDate, formatTime, minutesSince } from '../../attendance/format';
import { homeView, type HomeView } from '../../attendance/homeState';
import { outcomeView, type AttendanceAction } from '../../attendance/messages';
import { queryKeys } from '../../attendance/queryKeys';
import { resumePendingOnLaunch, submitAttendance, type SubmitOutcome, type SubmitStep } from '../../attendance/submitFlow';
import { useNow } from '../../attendance/useNow';
import { openAppSettings, openLocationSettings } from '../../native/location';
import { colors } from '../../theme/tokens';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { BusyView } from './BusyView';
import { MenuSheet } from './MenuSheet';
import { ResultView } from './ResultView';

type Phase =
  | { kind: 'idle' }
  | { kind: 'busy'; step: SubmitStep | 'starting' }
  | { kind: 'result'; action: AttendanceAction; outcome: SubmitOutcome };

export function HomeScreen() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const user = useUser();
  const queryClient = useQueryClient();
  const now = useNow();
  const deps = useMemo(() => createSubmitDeps(api, t), [api, t]);
  const todayQuery = useQuery({ queryKey: queryKeys.today, queryFn: () => api.today() });
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [menuOpen, setMenuOpen] = useState(false);
  const inFlight = useRef(false);
  const resumed = useRef(false);
  const today = todayQuery.data;

  useEffect(() => {
    if (!today || resumed.current) return;
    resumed.current = true;
    resumePendingOnLaunch(today, deps).catch((err: unknown) => console.warn('home: resume failed', err));
  }, [today, deps]);

  const run = useCallback(
    async (action: AttendanceAction) => {
      if (inFlight.current || !today) return;
      inFlight.current = true;
      setPhase({ kind: 'busy', step: 'starting' });
      try {
        const outcome = await submitAttendance(action, today, deps, (step) => setPhase({ kind: 'busy', step }));
        setPhase({ kind: 'result', action, outcome });
      } catch (err) {
        console.warn('home: submit failed', err);
        setPhase({ kind: 'result', action, outcome: { code: 'NETWORK' } });
      } finally {
        inFlight.current = false;
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
    [today, deps, queryClient],
  );

  if (todayQuery.isPending) return <Loading />;
  if (!today) {
    return (
      <Screen>
        <ErrorState onRetry={() => void todayQuery.refetch()} />
      </Screen>
    );
  }

  const { view, missedYesterday } = homeView(today);
  const firstName = user.name.split(' ')[0] ?? user.name;
  const result = phase.kind === 'result' ? outcomeView(phase.outcome.code, phase.action, phase.outcome.result) : null;

  function onResultAction() {
    if (phase.kind !== 'result' || !result) return;
    const action = phase.action;
    setPhase({ kind: 'idle' });
    if (result.action === 'retry') void run(action);
    if (result.action === 'openAppSettings') openAppSettings().catch((e: unknown) => console.warn(e));
    if (result.action === 'openLocationSettings') openLocationSettings().catch((e: unknown) => console.warn(e));
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text color={colors.muted} style={{ fontSize: 15 }}>
            {formatLongDate(now, t)}
          </Text>
          <Text variant="h1" style={{ fontSize: 26 }}>
            {t('home.greeting', { name: firstName })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.menu')}
          onPress={() => setMenuOpen(true)}
          style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="menu" size={26} />
        </Pressable>
      </View>

      {missedYesterday ? (
        <View style={{ marginHorizontal: 20, marginTop: 20 }}>
          <Banner tone="warn" icon="alert" title={t('home.missedTitle')} body={t('home.missedBody')} />
        </View>
      ) : null}

      <StatusCard view={view} now={now} />

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 16 }}>
        {view.kind === 'checkIn' ? (
          <>
            <Button label={t('home.checkIn')} variant="checkIn" size="big" icon="checkIn" onPress={() => void run('checkIn')} />
            <Text color={colors.muted} style={{ textAlign: 'center', fontSize: 17 }}>
              {t('home.checkInHint')}
            </Text>
          </>
        ) : null}
        {view.kind === 'working' ? (
          <>
            <Button label={t('home.checkOut')} variant="checkOut" size="big" icon="checkOut" onPress={() => void run('checkOut')} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <Icon name="bell" size={20} color={colors.muted} />
              <Text color={colors.muted} style={{ fontSize: 16 }}>
                {t('home.reminderAt', { time: formatHhMm(today.reminderTime, t) })}
              </Text>
            </View>
          </>
        ) : null}
        {view.kind === 'done' ? (
          <Card style={{ borderRadius: 28, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 16 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={48} color={colors.checkIn} strokeWidth={2.4} />
            </View>
            <Text variant="h1" style={{ fontSize: 32 }}>
              {t('home.doneTitle')}
            </Text>
            <Text variant="monoLarge">
              {`${formatTime(view.checkInAt, t, false)} – ${view.checkOutAt ? formatTime(view.checkOutAt, t, false) : '?'}`}
            </Text>
            {view.workedMinutes != null ? (
              <Text color={colors.muted} style={{ fontSize: 18 }}>
                {t('home.worked', { duration: formatDuration(view.workedMinutes, t) })}
              </Text>
            ) : null}
          </Card>
        ) : null}
        {view.kind === 'noSite' ? (
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
            <Icon name="person" size={40} color={colors.muted} />
            <Text variant="h2">{t('home.noSiteTitle')}</Text>
            <Text color={colors.muted}>{t('home.noSiteBody')}</Text>
          </Card>
        ) : null}
      </View>

      <Modal
        visible={phase.kind !== 'idle'}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (phase.kind === 'result') setPhase({ kind: 'idle' });
        }}
      >
        {phase.kind === 'busy' ? <BusyView step={phase.step} /> : null}
        {result ? <ResultView view={result} onAction={onResultAction} /> : null}
      </Modal>
      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </Screen>
  );
}

function StatusCard({ view, now }: { view: HomeView; now: Date }) {
  const { t } = useTranslation();
  if (view.kind === 'checkIn') {
    return (
      <Card style={{ marginHorizontal: 20, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pin" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="small" color={colors.muted}>
            {t('home.yourSite')}
          </Text>
          <Text variant="bodyStrong" style={{ fontSize: 18 }}>
            {view.siteName}
          </Text>
        </View>
      </Card>
    );
  }
  if (view.kind === 'working') {
    return (
      <View style={{ marginHorizontal: 20, marginTop: 20, padding: 20, borderRadius: 20, backgroundColor: colors.checkIn, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.workingDot }} />
          <Text variant="label" color={colors.white} style={{ fontSize: 16 }}>
            {t('home.working')}
          </Text>
        </View>
        <Text variant="h1" color={colors.white} style={{ fontSize: 30 }}>
          {t('home.since', { time: formatTime(view.since, t) })}
        </Text>
        <Text color={colors.workingSub} style={{ fontSize: 16 }}>
          {t('home.soFar', { site: view.siteName, duration: formatDuration(minutesSince(view.since, now), t) })}
        </Text>
      </View>
    );
  }
  return null;
}
```

`apps/mobile/src/screens/worker/HistoryScreen.tsx`:

```tsx
import React from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { addDays, formatDuration, formatTime, formatWorkDateShort } from '../../attendance/format';
import { buildHistoryRows, type HistoryRow } from '../../attendance/history';
import { queryKeys } from '../../attendance/queryKeys';
import { colors, radius } from '../../theme/tokens';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon, type IconName } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

export function HistoryScreen() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const todayQuery = useQuery({ queryKey: queryKeys.today, queryFn: () => api.today() });
  const workDate = todayQuery.data?.workDate ?? '';
  const historyQuery = useQuery({
    queryKey: queryKeys.history(workDate),
    queryFn: () => api.myAttendance(addDays(workDate, -29), workDate),
    enabled: workDate !== '',
  });

  if (todayQuery.isPending || (workDate && historyQuery.isPending)) return <Loading />;
  if (!workDate || !historyQuery.data) {
    return (
      <Screen>
        <ErrorState
          onRetry={() => {
            void todayQuery.refetch();
            void historyQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 2 }}>
        <Text variant="h1">{t('history.title')}</Text>
        <Text color={colors.muted} style={{ fontSize: 15 }}>
          {t('history.subtitle')}
        </Text>
      </View>
      <FlatList
        data={buildHistoryRows(workDate, historyQuery.data)}
        keyExtractor={(row) => row.workDate}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}
        refreshing={historyQuery.isRefetching}
        onRefresh={() => void historyQuery.refetch()}
        renderItem={({ item }) => <HistoryRowView row={item} isToday={item.workDate === workDate} />}
      />
    </Screen>
  );
}

const ROW_STYLE: Record<HistoryRow['kind'], { bg: string; circle: string; icon: IconName; iconColor: string; title: string }> = {
  completed: { bg: colors.surface, circle: colors.successBg, icon: 'check', iconColor: colors.checkIn, title: colors.text },
  working: { bg: colors.surface, circle: colors.infoBg, icon: 'checkIn', iconColor: colors.info, title: colors.text },
  missed: { bg: colors.warnBg, circle: colors.warnIconBg, icon: 'alert', iconColor: colors.warnMuted, title: colors.warnText },
  absent: { bg: colors.lineSoft, circle: colors.line, icon: 'minus', iconColor: colors.muted, title: colors.muted },
};

function HistoryRowView({ row, isToday }: { row: HistoryRow; isToday: boolean }) {
  const { t } = useTranslation();
  const style = ROW_STYLE[row.kind];
  const day = formatWorkDateShort(row.workDate, t);
  const inTime = row.checkInAt ? formatTime(row.checkInAt, t, false) : '';
  let detail: string;
  if (row.kind === 'completed') detail = `${inTime} – ${row.checkOutAt ? formatTime(row.checkOutAt, t, false) : '?'}`;
  else if (row.kind === 'working') detail = t('history.working', { time: inTime });
  else if (row.kind === 'missed') detail = t('history.noCheckout', { time: inTime });
  else detail = t('history.notPresent');

  return (
    <View style={{ backgroundColor: style.bg, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: style.circle, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={style.icon} size={20} color={style.iconColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={style.title}>
          {isToday ? t('history.today', { day }) : day}
        </Text>
        <Text variant={row.kind === 'completed' ? 'mono' : 'small'} color={row.kind === 'missed' ? colors.warnMuted : colors.muted}>
          {detail}
        </Text>
      </View>
      {row.kind === 'completed' && row.workedMinutes != null ? (
        <Text variant="mono" style={{ fontSize: 17 }}>
          {formatDuration(row.workedMinutes, t, true)}
        </Text>
      ) : null}
      {row.kind === 'missed' ? (
        <Text variant="mono" color={colors.warnMuted} style={{ fontSize: 17 }}>
          —
        </Text>
      ) : null}
    </View>
  );
}
```

`apps/mobile/src/navigation/WorkerNavigator.tsx`:

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HistoryScreen } from '../screens/worker/HistoryScreen';
import { HomeScreen } from '../screens/worker/HomeScreen';
import { TabBar } from '../ui/TabBar';
import type { WorkerTabParamList } from './types';

const Tab = createBottomTabNavigator<WorkerTabParamList>();

const ITEMS = {
  Home: { icon: 'home', labelKey: 'tabs.home' },
  History: { icon: 'calendar', labelKey: 'tabs.history' },
} as const;

export function WorkerNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} items={ITEMS} height={76} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @ve/mobile test`
Expected: all pass: format +1, history 1, HomeScreen 11, HistoryScreen 1, WorkerNavigator 1, plus the earlier suites and `i18n-keys`.

If `getByRole` can't see buttons inside the RN `Modal` mock, check that `visible` is true at that moment. RNTL renders a visible Modal's children in the tree. Don't change the test's intent.

- [ ] **Step 7: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

```bash
git add apps/mobile/src
git commit -m "add worker home, result and history screens"
```

---

### Task 12: Admin Today and Attendance, root navigator, first run on a phone

**Files:**
- Create: `apps/mobile/src/screens/admin/{TodayScreen,AttendanceListScreen,AttendanceDetailScreen}.tsx`
- Create: `apps/mobile/src/ui/Avatar.tsx`, `apps/mobile/src/attendance/localDate.ts`
- Create: `apps/mobile/src/navigation/{AdminNavigator,RootNavigator}.tsx`
- Modify: `apps/mobile/src/App.tsx` (real app shell)
- Modify: `apps/mobile/src/i18n/en.json` (add `admin`)
- Test: `apps/mobile/src/screens/admin/TodayScreen.test.tsx`, `apps/mobile/src/screens/admin/AttendanceListScreen.test.tsx`, `apps/mobile/src/screens/admin/AttendanceDetailScreen.test.tsx`, `apps/mobile/src/App.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 11: `queryKeys`, `confirmLogout`, `WorkerNavigator`, `useNow`
  - from Task 9: `format.*`
  - from Task 8: `AuthNavigator`, `AuthProvider`, `createServices`, param lists
- Produces:
  - `localToday(): string`: the phone's local date as `YYYY-MM-DD`
  - `Avatar({ name: string })`: initials in a circle
  - `TodayScreen`, `AttendanceListScreen`, `AttendanceDetailScreen`
  - `AdminNavigator`: tabs `TodayTab` and `AttendanceTab`; Tasks 13 and 14 add `EmployeesTab` and `SitesTab` between them
  - `AttendanceStack`
  - `RootNavigator`, `App`

- [ ] **Step 1: Add strings**

Add to `src/i18n/en.json`:

```json
  "admin": {
    "tag": "ADMIN",
    "today": {
      "title": "Today",
      "updated": "{{date}} · updated {{time}}",
      "workingNow": "Working now",
      "notYetIn": "Not yet in",
      "completed": "Completed",
      "needsReview": "Needs review",
      "summary": "Checked in {{checkedIn}} · Missed check-outs {{missed}} · Active {{active}}",
      "byCheckIn": "by check-in time",
      "nobodyWorking": "Nobody is working right now",
      "since": "{{site}} · since {{time}}"
    },
    "attendance": {
      "title": "Attendance",
      "prevDay": "Previous day",
      "nextDay": "Next day",
      "employeeFilter": "Employee: {{name}}",
      "clearFilter": "Clear filter",
      "last30": "Last 30 days",
      "empty": "No attendance for this day",
      "review": "Review",
      "checkIn": "Check-in",
      "checkOut": "Check-out",
      "notYet": "Not yet",
      "distance": "{{m}} m from site, ±{{acc}} m",
      "worked": "{{duration}} worked",
      "flags": "Flags",
      "attempts": "All attempts",
      "mock": "Fake GPS",
      "fixOnWeb": "Fix the check-out and mark reviewed on the web dashboard"
    },
    "status": {
      "CHECKED_IN": "Working",
      "COMPLETED": "Done",
      "MISSED_CHECKOUT": "No check-out"
    },
    "flags": {
      "MOCK_LOCATION": "Fake GPS suspected",
      "CLOCK_MISMATCH": "Phone clock was wrong",
      "ADMIN_CORRECTED": "Fixed by admin"
    },
    "events": {
      "IN": "Check-in",
      "OUT": "Check-out"
    }
  }
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/screens/admin/TodayScreen.test.tsx`:

```tsx
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { DashboardTodayDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, loggedIn, renderWithAuth } from '../../testing/render';
import { TodayScreen } from './TodayScreen';

const dashboard: DashboardTodayDto = {
  workDate: '2026-09-25',
  activeEmployees: 47,
  checkedInToday: 33,
  workingNow: 31,
  completedToday: 2,
  notYetIn: 14,
  missedCheckouts: 1,
  needsReview: 3,
  working: [{ employeeId: 'e1', name: 'Ramesh Kale', siteName: 'Plot 7', checkInAt: '2026-09-25T03:32:00Z' }],
};

test('shows the day counts and who is working', async () => {
  renderWithAuth(<TodayScreen />, { api: fakeApi({ dashboard: jest.fn(async () => dashboard) }), state: loggedIn(adminUser) });
  expect(await screen.findByText('31')).toBeOnTheScreen();
  expect(screen.getByText('Not yet in')).toBeOnTheScreen();
  expect(screen.getByText('14')).toBeOnTheScreen();
  expect(screen.getByText('Checked in 33 · Missed check-outs 1 · Active 47')).toBeOnTheScreen();
  expect(screen.getByText('Ramesh Kale')).toBeOnTheScreen();
  expect(screen.getByText('Plot 7 · since 9:02 AM')).toBeOnTheScreen();
  expect(screen.getByText('RK')).toBeOnTheScreen();
});

test('log out asks first', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { auth } = renderWithAuth(<TodayScreen />, {
    api: fakeApi({ dashboard: jest.fn(async () => dashboard) }),
    state: loggedIn(adminUser),
  });
  fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
  await act(async () => alert.mock.calls[0]?.[2]?.[1]?.onPress?.());
  expect(auth.logout).toHaveBeenCalled();
});
```

`apps/mobile/src/screens/admin/AttendanceListScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { AdminDayDto, Paginated } from '@ve/shared';
import { addDays } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { AttendanceListScreen } from './AttendanceListScreen';

const row: AdminDayDto = {
  id: 'day-1',
  workDate: '2026-09-25',
  siteId: 's1',
  status: 'CHECKED_IN',
  checkInAt: '2026-09-25T03:32:00Z',
  checkOutAt: null,
  workedMinutes: null,
  flags: ['MOCK_LOCATION'],
  needsReview: true,
  employeeId: 'e1',
  employeeName: 'Ramesh Kale',
  employeeCode: 'E-12',
  siteName: 'Plot 7',
  checkInLat: 18.59,
  checkInLng: 73.73,
  checkInAccuracyM: 12,
  checkInDistanceM: 20,
  checkOutLat: null,
  checkOutLng: null,
  checkOutAccuracyM: null,
  checkOutDistanceM: null,
  reviewedAt: null,
};
const page = (items: AdminDayDto[], total = items.length): Paginated<AdminDayDto> => ({ items, total, page: 1, pageSize: 50 });

function renderList(params?: { employeeId?: string; employeeName?: string }) {
  const listAttendance = jest.fn(async () => page([row]));
  const navigation = { ...fakeNavigation(), setParams: jest.fn() };
  renderWithAuth(<AttendanceListScreen navigation={navigation as never} route={{ key: 'k', name: 'AttendanceList', params } as never} />, {
    api: fakeApi({ listAttendance }),
    state: loggedIn(adminUser),
  });
  return { listAttendance, navigation };
}

test('shows one day, and the arrows move the day', async () => {
  const { listAttendance } = renderList();
  const today = localToday();
  expect(await screen.findByText('Ramesh Kale')).toBeOnTheScreen();
  expect(screen.getByText('Working')).toBeOnTheScreen();
  expect(screen.getByText('Review')).toBeOnTheScreen();
  expect(listAttendance).toHaveBeenCalledWith({ from: today, to: today, page: 1, pageSize: 50 });

  fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
  const yesterday = addDays(today, -1);
  await waitFor(() => expect(listAttendance).toHaveBeenCalledWith({ from: yesterday, to: yesterday, page: 1, pageSize: 50 }));
});

test('tapping a row opens its detail', async () => {
  const { navigation } = renderList();
  fireEvent.press(await screen.findByRole('button', { name: /Ramesh Kale/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('AttendanceDetail', { id: 'day-1' });
});

test('an employee filter shows the last 30 days and can be cleared', async () => {
  const { listAttendance, navigation } = renderList({ employeeId: 'e1', employeeName: 'Ramesh Kale' });
  const today = localToday();
  expect(await screen.findByText('Employee: Ramesh Kale')).toBeOnTheScreen();
  expect(listAttendance).toHaveBeenCalledWith({ from: addDays(today, -29), to: today, employeeId: 'e1', page: 1, pageSize: 50 });
  fireEvent.press(screen.getByRole('button', { name: 'Clear filter' }));
  expect(navigation.setParams).toHaveBeenCalledWith({ employeeId: undefined, employeeName: undefined });
});

test('more pages load on request', async () => {
  const listAttendance = jest
    .fn(async () => page([row]))
    .mockResolvedValueOnce({ items: [row], total: 2, page: 1, pageSize: 1 })
    .mockResolvedValueOnce({ items: [{ ...row, id: 'day-2', employeeName: 'Sunita Jadhav' }], total: 2, page: 2, pageSize: 1 });
  renderWithAuth(
    <AttendanceListScreen navigation={fakeNavigation() as never} route={{ key: 'k', name: 'AttendanceList' } as never} />,
    { api: fakeApi({ listAttendance }), state: loggedIn(adminUser) },
  );
  fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  expect(await screen.findByText('Sunita Jadhav')).toBeOnTheScreen();
});
```

`apps/mobile/src/screens/admin/AttendanceDetailScreen.test.tsx`:

```tsx
import React from 'react';
import { screen } from '@testing-library/react-native';
import type { AdminDayDetailDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { AttendanceDetailScreen } from './AttendanceDetailScreen';

const detail: AdminDayDetailDto = {
  day: {
    id: 'day-1',
    workDate: '2026-09-25',
    siteId: 's1',
    status: 'COMPLETED',
    checkInAt: '2026-09-25T03:32:00Z',
    checkOutAt: '2026-09-25T12:45:00Z',
    workedMinutes: 553,
    flags: ['MOCK_LOCATION'],
    needsReview: true,
    employeeId: 'e1',
    employeeName: 'Ramesh Kale',
    employeeCode: 'E-12',
    siteName: 'Plot 7',
    checkInLat: 18.59,
    checkInLng: 73.73,
    checkInAccuracyM: 12,
    checkInDistanceM: 20,
    checkOutLat: 18.59,
    checkOutLng: 73.73,
    checkOutAccuracyM: 9,
    checkOutDistanceM: 31,
    reviewedAt: null,
  },
  site: { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100 },
  events: [
    { id: 'ev1', type: 'IN', result: 'OUTSIDE_SITE', serverTime: '2026-09-25T03:30:00Z', deviceTime: null, lat: 18.6, lng: 73.7, accuracyM: 15, distanceM: 140, isMock: false, deviceId: 'd', deviceModel: 'M', appVersion: '0.1.0' },
    { id: 'ev2', type: 'IN', result: 'OK', serverTime: '2026-09-25T03:32:00Z', deviceTime: null, lat: 18.59, lng: 73.73, accuracyM: 11, distanceM: 20, isMock: true, deviceId: 'd', deviceModel: 'M', appVersion: '0.1.0' },
  ],
};

test('shows times, distances, flags and every attempt', async () => {
  renderWithAuth(
    <AttendanceDetailScreen navigation={fakeNavigation() as never} route={{ key: 'k', name: 'AttendanceDetail', params: { id: 'day-1' } } as never} />,
    { api: fakeApi({ getAttendance: jest.fn(async () => detail) }), state: loggedIn(adminUser) },
  );
  expect(await screen.findByText('Ramesh Kale')).toBeOnTheScreen();
  expect(screen.getByText('9:02 AM')).toBeOnTheScreen();
  expect(screen.getByText('6:15 PM')).toBeOnTheScreen();
  expect(screen.getByText('20 m from site, ±12 m')).toBeOnTheScreen();
  expect(screen.getByText('9 h 13 min worked')).toBeOnTheScreen();
  expect(screen.getByText('Fake GPS suspected')).toBeOnTheScreen();
  expect(screen.getByText('Fix the check-out and mark reviewed on the web dashboard')).toBeOnTheScreen();
  expect(screen.getByText('OUTSIDE_SITE')).toBeOnTheScreen();
  expect(screen.getByText('Fake GPS')).toBeOnTheScreen();
});
```

`apps/mobile/src/App.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { DashboardTodayDto, MeTodayResponse } from '@ve/shared';
import { StorageKeys } from './storageKeys';
import { fakeState } from './testing/fakeNative';
import { adminUser, employeeUser } from './testing/render';
import App from './App';

const reply = (status: number, body?: unknown) =>
  ({ status, ok: status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

function server(routes: Record<string, unknown>) {
  global.fetch = jest.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path === '/auth/refresh') return reply(200, { accessToken: 'a2', refreshToken: 'r2', user: employeeUser });
    return path in routes ? reply(200, routes[path]) : reply(404, { code: 'NOT_FOUND', message: path });
  }) as unknown as typeof fetch;
}

function storeSession(user: typeof employeeUser) {
  fakeState.secure.set('refreshToken', 'r1');
  fakeState.prefs.set(StorageKeys.user, JSON.stringify(user));
}

test('no session → worker login', async () => {
  server({});
  render(<App />);
  expect(await screen.findByText('Your phone number and PIN')).toBeOnTheScreen();
});

test('a stored employee session opens the worker home', async () => {
  storeSession(employeeUser);
  server({
    '/me/today': { workDate: '2026-09-25', day: null, site: null, missedYesterday: false, maxAccuracyM: 50, reminderTime: '19:00', timezone: 'Asia/Kolkata', serverTime: '2026-09-25T03:00:00Z' } satisfies MeTodayResponse,
  });
  render(<App />);
  expect(await screen.findByText('No site assigned')).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: 'My attendance' })).toBeOnTheScreen();
});

test('a stored admin session opens the admin Today screen, never worker screens', async () => {
  storeSession(adminUser);
  server({
    '/admin/dashboard/today': { workDate: '2026-09-25', activeEmployees: 1, checkedInToday: 0, workingNow: 0, completedToday: 0, notYetIn: 1, missedCheckouts: 0, needsReview: 0, working: [] } satisfies DashboardTodayDto,
  });
  render(<App />);
  expect(await screen.findByText('Nobody is working right now')).toBeOnTheScreen();
  expect(screen.queryByRole('tab', { name: 'My attendance' })).toBeNull();
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/screens/admin src/App.test.tsx`
Expected: FAIL with `Cannot find module` for the three screens. `App.test` fails because the Task 2 placeholder `App` only renders "VE HR".

- [ ] **Step 4: Helpers**

`apps/mobile/src/attendance/localDate.ts`:

```ts
import { toIsoWithOffset } from './format';

/** Today's date on this phone (same zone as the company, see Global Constraints). */
export function localToday(): string {
  return toIsoWithOffset(new Date()).slice(0, 10);
}
```

`apps/mobile/src/ui/Avatar.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { Text } from './Text';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function Avatar({ name }: { name: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15 }}>{initials(name)}</Text>
    </View>
  );
}
```

- [ ] **Step 5: Admin screens**

`apps/mobile/src/screens/admin/TodayScreen.tsx`:

```tsx
import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { formatTime, formatWorkDateMedium } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import { colors, fonts, radius } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { confirmLogout } from '../worker/MenuSheet';

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'plain' | 'warn' }) {
  const bg = tone === 'green' ? colors.checkIn : tone === 'warn' ? colors.warnBg : colors.surface;
  const labelColor = tone === 'green' ? colors.workingSub : tone === 'warn' ? colors.warnMuted : colors.muted;
  const valueColor = tone === 'green' ? colors.white : tone === 'warn' ? colors.warnText : colors.text;
  return (
    <View style={{ width: '48.5%', backgroundColor: bg, borderRadius: radius.lg, padding: 14, gap: 4 }}>
      <Text variant="small" color={labelColor}>
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 }} color={valueColor}>
        {String(value)}
      </Text>
    </View>
  );
}

export function TodayScreen() {
  const { t } = useTranslation();
  const { api, logout } = useAuth();
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.dashboard(), refetchInterval: 60_000 });

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const d = query.data;

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text variant="small" color={colors.muted}>
            {t('admin.today.updated', {
              date: formatWorkDateMedium(d.workDate, t),
              time: formatTime(new Date(query.dataUpdatedAt).toISOString(), t),
            })}
          </Text>
          <Text variant="h1">{t('admin.today.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ backgroundColor: colors.dark, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 }}>
            <Text color={colors.onDark} style={{ fontFamily: fonts.bodyBold, fontSize: 13 }}>
              {t('admin.tag')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.logout')}
            onPress={() => confirmLogout(t, logout)}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="logout" />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        <Stat label={t('admin.today.workingNow')} value={d.workingNow} tone="green" />
        <Stat label={t('admin.today.notYetIn')} value={d.notYetIn} tone="plain" />
        <Stat label={t('admin.today.completed')} value={d.completedToday} tone="plain" />
        <Stat label={t('admin.today.needsReview')} value={d.needsReview} tone="warn" />
      </View>
      <Text variant="small" color={colors.muted} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        {t('admin.today.summary', { checkedIn: d.checkedInToday, missed: d.missedCheckouts, active: d.activeEmployees })}
      </Text>

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="h2">{t('admin.today.workingNow')}</Text>
        <Text variant="small" color={colors.muted}>
          {t('admin.today.byCheckIn')}
        </Text>
      </View>
      <FlatList
        style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface, borderRadius: radius.lg }}
        data={d.working}
        keyExtractor={(w) => w.employeeId}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListEmptyComponent={
          <Text color={colors.muted} style={{ padding: 16 }}>
            {t('admin.today.nobodyWorking')}
          </Text>
        }
        renderItem={({ item, index }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.lineSoft,
            }}
          >
            <Avatar name={item.name} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                {item.name}
              </Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.today.since', { site: item.siteName, time: formatTime(item.checkInAt, t) })}
              </Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
```

`apps/mobile/src/screens/admin/AttendanceListScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AdminDayDto } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { addDays, formatTime, formatWorkDateMedium } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { queryKeys } from '../../attendance/queryKeys';
import type { AttendanceStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

type Props = NativeStackScreenProps<AttendanceStackParamList, 'AttendanceList'>;

const PAGE_SIZE = 50;

export function StatusBadge({ status }: { status: AdminDayDto['status'] }) {
  const { t } = useTranslation();
  const bg = status === 'CHECKED_IN' ? colors.successBg : status === 'MISSED_CHECKOUT' ? colors.warnBg : colors.lineSoft;
  const fg = status === 'CHECKED_IN' ? colors.checkIn : status === 'MISSED_CHECKOUT' ? colors.warnText : colors.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text variant="small" color={fg}>
        {t(`admin.status.${status}`)}
      </Text>
    </View>
  );
}

export function AttendanceListScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const today = localToday();
  const [date, setDate] = useState(today);
  const employeeId = route.params?.employeeId;
  const employeeName = route.params?.employeeName;
  const params = employeeId ? { from: addDays(today, -29), to: today, employeeId } : { from: date, to: date };

  const query = useInfiniteQuery({
    queryKey: queryKeys.attendance(params),
    queryFn: ({ pageParam }) => api.listAttendance({ ...params, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 12 }}>
        <Text variant="h1">{t('admin.attendance.title')}</Text>
        {employeeId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: colors.dark, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
              <Text variant="label" color={colors.onDark}>
                {t('admin.attendance.employeeFilter', { name: employeeName ?? '' })}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.attendance.clearFilter')}
              onPress={() => navigation.setParams({ employeeId: undefined, employeeName: undefined })}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" />
            </Pressable>
            <Text variant="small" color={colors.muted}>
              {t('admin.attendance.last30')}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.attendance.prevDay')}
              onPress={() => setDate((d) => addDays(d, -1))}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="chevronLeft" />
            </Pressable>
            <Text variant="bodyStrong">{formatWorkDateMedium(date, t)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.attendance.nextDay')}
              disabled={date >= today}
              accessibilityState={{ disabled: date >= today }}
              onPress={() => setDate((d) => addDays(d, 1))}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: date >= today ? 0.3 : 1 }}
            >
              <Icon name="chevronRight" />
            </Pressable>
          </View>
        )}
      </View>

      {query.isPending ? (
        <Loading />
      ) : query.isError && items.length === 0 ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={<Text color={colors.muted}>{t('admin.attendance.empty')}</Text>}
          ListFooterComponent={
            query.hasNextPage ? (
              <Button label={t('common.loadMore')} variant="secondary" size="small" onPress={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.employeeName}, ${t(`admin.status.${item.status}`)}`}
              onPress={() => navigation.navigate('AttendanceDetail', { id: item.id })}
              style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {item.employeeName}
                </Text>
                {item.needsReview ? (
                  <View style={{ backgroundColor: colors.warnBg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Text variant="small" color={colors.warnText}>
                      {t('admin.attendance.review')}
                    </Text>
                  </View>
                ) : null}
                <StatusBadge status={item.status} />
              </View>
              <Text variant="small" color={colors.muted}>
                {employeeId ? `${formatWorkDateMedium(item.workDate, t)} · ${item.siteName}` : item.siteName}
              </Text>
              <Text variant="mono" color={colors.muted}>
                {`${formatTime(item.checkInAt, t)} – ${item.checkOutAt ? formatTime(item.checkOutAt, t) : '?'}`}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
```

`apps/mobile/src/screens/admin/AttendanceDetailScreen.tsx`:

```tsx
import React from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { formatDuration, formatTime, formatWorkDateMedium } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import type { AttendanceStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { Banner } from '../../ui/Banner';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { StatusBadge } from './AttendanceListScreen';

type Props = NativeStackScreenProps<AttendanceStackParamList, 'AttendanceDetail'>;

export function AttendanceDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { id } = route.params;
  const query = useQuery({ queryKey: queryKeys.attendanceDay(id), queryFn: () => api.getAttendance(id) });

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen edges={[]}>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const { day, events } = query.data;

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text variant="h1">{day.employeeName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text color={colors.muted}>{`${formatWorkDateMedium(day.workDate, t)} · ${day.siteName}`}</Text>
            <StatusBadge status={day.status} />
          </View>
        </View>

        {day.needsReview ? <Banner tone="warn" icon="alert" title={t('admin.attendance.fixOnWeb')} /> : null}

        <Card style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" color={colors.muted}>
              {t('admin.attendance.checkIn')}
            </Text>
            <Text variant="monoLarge">{formatTime(day.checkInAt, t)}</Text>
            <Text variant="small" color={colors.muted}>
              {t('admin.attendance.distance', { m: Math.round(day.checkInDistanceM), acc: Math.round(day.checkInAccuracyM) })}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="label" color={colors.muted}>
              {t('admin.attendance.checkOut')}
            </Text>
            <Text variant="monoLarge">{day.checkOutAt ? formatTime(day.checkOutAt, t) : t('admin.attendance.notYet')}</Text>
            {day.checkOutDistanceM != null && day.checkOutAccuracyM != null ? (
              <Text variant="small" color={colors.muted}>
                {t('admin.attendance.distance', { m: Math.round(day.checkOutDistanceM), acc: Math.round(day.checkOutAccuracyM) })}
              </Text>
            ) : null}
          </View>
          {day.workedMinutes != null ? (
            <Text variant="bodyStrong">{t('admin.attendance.worked', { duration: formatDuration(day.workedMinutes, t) })}</Text>
          ) : null}
        </Card>

        {day.flags.length > 0 ? (
          <Card style={{ gap: 6 }}>
            <Text variant="label">{t('admin.attendance.flags')}</Text>
            {day.flags.map((flag) => (
              <Text key={flag} color={colors.warnText}>
                {t(`admin.flags.${flag}`, { defaultValue: flag })}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: 10 }}>
          <Text variant="label">{t('admin.attendance.attempts')}</Text>
          {events.map((ev) => (
            <View key={ev.id} style={{ borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">{`${t(`admin.events.${ev.type}`)} · ${formatTime(ev.serverTime, t)}`}</Text>
                <Text variant="mono" color={ev.result === 'OK' ? colors.checkIn : colors.checkOut}>
                  {ev.result}
                </Text>
              </View>
              <Text variant="small" color={colors.muted}>
                {t('admin.attendance.distance', { m: Math.round(ev.distanceM ?? 0), acc: Math.round(ev.accuracyM) })}
              </Text>
              {ev.isMock ? (
                <Text variant="small" color={colors.warnText}>
                  {t('admin.attendance.mock')}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 6: Navigators and app shell**

`apps/mobile/src/navigation/AdminNavigator.tsx`:

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AttendanceDetailScreen } from '../screens/admin/AttendanceDetailScreen';
import { AttendanceListScreen } from '../screens/admin/AttendanceListScreen';
import { TodayScreen } from '../screens/admin/TodayScreen';
import { colors, fonts } from '../theme/tokens';
import { TabBar } from '../ui/TabBar';
import type { AdminTabParamList, AttendanceStackParamList } from './types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const AttendanceStack = createNativeStackNavigator<AttendanceStackParamList>();

/** Header style for pushed admin screens (detail, create, edit). */
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTitleStyle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.bg },
};

const ITEMS = {
  TodayTab: { icon: 'home', labelKey: 'tabs.today' },
  EmployeesTab: { icon: 'users', labelKey: 'tabs.employees' },
  SitesTab: { icon: 'map', labelKey: 'tabs.sites' },
  AttendanceTab: { icon: 'list', labelKey: 'tabs.attendance' },
} as const;

function AttendanceNavigator() {
  const { t } = useTranslation();
  return (
    <AttendanceStack.Navigator screenOptions={stackScreenOptions}>
      <AttendanceStack.Screen name="AttendanceList" component={AttendanceListScreen} options={{ headerShown: false }} />
      <AttendanceStack.Screen name="AttendanceDetail" component={AttendanceDetailScreen} options={{ title: t('admin.attendance.title') }} />
    </AttendanceStack.Navigator>
  );
}

export function AdminNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} items={ITEMS} height={68} />}>
      <Tab.Screen name="TodayTab" component={TodayScreen} />
      <Tab.Screen name="AttendanceTab" component={AttendanceNavigator} />
    </Tab.Navigator>
  );
}
```

`apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/tokens';
import { Loading } from '../ui/Centered';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { WorkerNavigator } from './WorkerNavigator';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text } };

/** The role from the login response decides the navigator; admin screens never mount for employees. */
export function RootNavigator() {
  const { state } = useAuth();
  if (state.status === 'loading') return <Loading />;
  return (
    <NavigationContainer theme={theme}>
      {state.status !== 'loggedIn' ? (
        <AuthNavigator />
      ) : state.user.role === 'admin' ? (
        <AdminNavigator />
      ) : (
        <WorkerNavigator />
      )}
    </NavigationContainer>
  );
}
```

Replace `apps/mobile/src/App.tsx`:

```tsx
import './i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StatusBar } from 'react-native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './auth/AuthContext';
import { getDeviceInfo } from './native/device';
import { RootNavigator } from './navigation/RootNavigator';
import { createServices, type Services } from './services';
import { colors } from './theme/tokens';
import { ErrorState, Loading } from './ui/Centered';

export default function App() {
  const [services, setServices] = useState<Services | null>(null);
  const [failed, setFailed] = useState(false);

  const boot = useCallback(() => {
    setFailed(false);
    getDeviceInfo()
      .then((info) => setServices(createServices(info.apiUrl)))
      .catch((err: unknown) => {
        console.warn('app: boot failed', err);
        setFailed(true);
      });
  }, []);

  useEffect(boot, [boot]);

  // Refetch screens when the app comes back to the foreground (TanStack Query's focus on RN).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      {services ? (
        <QueryClientProvider client={services.queryClient}>
          <AuthProvider client={services.client} api={services.api}>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      ) : failed ? (
        <ErrorState onRetry={boot} />
      ) : (
        <Loading />
      )}
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @ve/mobile test`
Expected: all pass: Today 2, AttendanceList 4, AttendanceDetail 1, App 3, plus everything earlier.

- [ ] **Step 8: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

```bash
git add apps/mobile/src
git commit -m "add admin today and attendance screens"
```

- [ ] **Step 9: First run on a real phone or emulator**

Tests can't cover this part: fonts, the TurboModule, GPS and the keystore.

- If a physical Android 10+ phone is connected with USB debugging (`adb devices` lists it), use it.
- Otherwise:
  - install an emulator image: `sdkmanager "emulator" "system-images;android-34;google_apis;x86_64"`
  - create a device: `avdmanager create avd -n vehr34 -k "system-images;android-34;google_apis;x86_64"`
  - start it: `emulator -avd vehr34 &`
  - the emulator needs `/dev/kvm`; if it's missing, ask the user to connect a phone

```bash
# terminal 1: API (Postgres from docker compose) with an admin account
docker compose up -d db
pnpm --filter @ve/api db:migrate
ADMIN_PASSWORD='long-password-123' pnpm --filter @ve/api seed:admin --email admin@ve.test --name "Test Admin"
pnpm --filter @ve/api dev
# terminal 2: Metro
pnpm --filter @ve/mobile start
# terminal 3: install and route the phone's localhost:3000 to this machine
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8081 tcp:8081
pnpm --filter @ve/mobile android
```

Create a site and an employee through the API. Get `$TOKEN` from `POST /auth/admin/login` with `{"email":"admin@ve.test","password":"long-password-123","client":"mobile"}`:

```bash
curl -s -X POST localhost:3000/admin/sites -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Test site","lat":<phone lat>,"lng":<phone lng>,"radiusM":200}'
curl -s -X POST localhost:3000/admin/employees -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Test Worker","phone":"9876543210","siteId":"<site id>"}'   # prints the PIN once
```

Check each item and write the result in the ledger:
- The fonts look like the design (Archivo headings, Plex Mono times).
- Worker login works, and killing and reopening the app stays logged in. This proves the keystore round-trip.
- CHECK IN asks for location, shows "Finding your location…", then "Attendance saved" with the time.
- A check-out reminder is scheduled. To test it, set the company `reminderTime` to 2 minutes from now with `PATCH /admin/settings`, check in, lock the phone and wait.
- Admin login shows Today and Attendance with the check-in row.

Anything that fails here is a bug to fix now, with a test where one is possible, before Task 13.

---

### Task 13: Admin Employees: list, create (PIN shown once), detail with PIN reset

**Files:**
- Create: `apps/mobile/src/ui/useDebounced.ts`
- Create: `apps/mobile/src/screens/admin/{adminErrors.ts,PinReveal.tsx,EmployeesScreen.tsx,EmployeeCreateScreen.tsx,EmployeeDetailScreen.tsx}`
- Modify: `apps/mobile/src/navigation/AdminNavigator.tsx` (Employees tab and stack)
- Modify: `apps/mobile/src/i18n/en.json` (`admin.employees`, `admin.errors`)
- Test: `apps/mobile/src/screens/admin/adminErrors.test.ts`, `EmployeesScreen.test.tsx`, `EmployeeCreateScreen.test.tsx`, `EmployeeDetailScreen.test.tsx` (all in `src/screens/admin/`)

**Interfaces:**
- Consumes:
  - from Task 7: `Api.listEmployees`, `getEmployee`, `createEmployee`, `resetPin`, `listSites`
  - from Task 11: `queryKeys.employees/employee/sites`
  - from Task 12: `Avatar`, `stackScreenOptions`
- Produces:
  - `useDebounced<T>(value: T, ms: number): T`
  - `adminErrorKey(err: unknown): string` (Task 14 uses it too)
  - `PinReveal({ title: string; pin: string; onDone: () => void })`
  - the screens `EmployeesScreen`, `EmployeeCreateScreen` and `EmployeeDetailScreen`
  - `EmployeesTab` in `AdminNavigator`

- [ ] **Step 1: Add strings**

Add these keys inside the existing `admin` object in `src/i18n/en.json`:

```json
    "employees": {
      "title": "Employees",
      "search": "Name, phone or code",
      "active": "Active",
      "inactive": "Inactive",
      "add": "Add employee",
      "empty": "No employees found",
      "locked": "Locked",
      "noSite": "No site",
      "createTitle": "New employee",
      "name": "Full name",
      "phone": "Phone number",
      "code": "Employee code (optional)",
      "site": "Site",
      "noSiteOption": "No site yet",
      "create": "Create employee",
      "saving": "Saving…",
      "pinTitle": "PIN for {{name}}",
      "newPin": "New PIN",
      "pinHelp": "Tell this PIN to the worker. It is shown only once.",
      "detailTitle": "Employee",
      "statusActive": "Active",
      "statusInactive": "Inactive",
      "lockedUntil": "Locked after wrong PINs until {{time}}",
      "devices": "Phones used",
      "noDevices": "Has not logged in yet",
      "lastUsed": "Last used {{date}} {{time}}",
      "unknownPhone": "Unknown phone",
      "viewAttendance": "View attendance",
      "resetPin": "Reset PIN",
      "resetTitle": "Reset PIN?",
      "resetBody": "The old PIN stops working and the worker is logged out on all phones."
    },
    "errors": {
      "phoneTaken": "This phone number is already used",
      "codeTaken": "This employee code is already used",
      "nameRequired": "Enter the name",
      "invalid": "Check what you typed",
      "notFound": "Not found. It may have been removed",
      "generic": "Something went wrong. Try again"
    }
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/screens/admin/adminErrors.test.ts`:

```ts
import i18n from '../../i18n';
import { ApiError, NetworkError } from '../../api/errors';
import { adminErrorKey } from './adminErrors';

test.each([
  [new ApiError(409, 'PHONE_TAKEN', 'x', null), 'admin.errors.phoneTaken'],
  [new ApiError(409, 'EMPLOYEE_CODE_TAKEN', 'x', null), 'admin.errors.codeTaken'],
  [new ApiError(400, 'VALIDATION_ERROR', 'x', null), 'admin.errors.invalid'],
  [new ApiError(404, 'SITE_NOT_FOUND', 'x', null), 'admin.errors.notFound'],
  [new NetworkError('offline'), 'common.noInternet'],
  [new Error('boom'), 'admin.errors.generic'],
])('%s → %s', (err, key) => {
  expect(adminErrorKey(err)).toBe(key);
  expect(i18n.exists(key)).toBe(true);
});
```

`apps/mobile/src/screens/admin/EmployeesScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { EmployeeDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { EmployeesScreen } from './EmployeesScreen';

const emp: EmployeeDto = {
  id: 'e1',
  name: 'Anil Pawar',
  phone: '+919876543210',
  employeeCode: 'E-7',
  siteId: 's1',
  siteName: 'Plot 7',
  isActive: true,
  lockedUntil: null,
  createdAt: '2026-09-01T00:00:00Z',
};

function renderEmployees() {
  const listEmployees = jest.fn(async () => [emp]);
  const navigation = fakeNavigation();
  renderWithAuth(<EmployeesScreen navigation={navigation as never} route={{} as never} />, {
    api: fakeApi({ listEmployees }),
    state: loggedIn(adminUser),
  });
  return { listEmployees, navigation };
}

test('lists active employees with phone, code and site', async () => {
  const { listEmployees } = renderEmployees();
  expect(await screen.findByText('Anil Pawar')).toBeOnTheScreen();
  expect(screen.getByText('+919876543210 · E-7 · Plot 7')).toBeOnTheScreen();
  expect(listEmployees).toHaveBeenCalledWith({ q: '', isActive: true });
});

test('search waits for typing to stop, then asks the server', async () => {
  const { listEmployees } = renderEmployees();
  await screen.findByText('Anil Pawar');
  fireEvent.changeText(screen.getByLabelText('Name, phone or code'), 'anil');
  await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: 'anil', isActive: true }));
});

test('Inactive shows deactivated employees', async () => {
  const { listEmployees } = renderEmployees();
  fireEvent.press(await screen.findByRole('button', { name: 'Inactive' }));
  await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: '', isActive: false }));
});

test('add and open', async () => {
  const { navigation } = renderEmployees();
  fireEvent.press(await screen.findByRole('button', { name: /Anil Pawar/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('EmployeeDetail', { id: 'e1' });
  fireEvent.press(screen.getByRole('button', { name: 'Add employee' }));
  expect(navigation.navigate).toHaveBeenCalledWith('EmployeeCreate');
});
```

`apps/mobile/src/screens/admin/EmployeeCreateScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { CreatedEmployeeDto, SiteDto } from '@ve/shared';
import { ApiError } from '../../api/errors';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { EmployeeCreateScreen } from './EmployeeCreateScreen';

const site: SiteDto = {
  id: 's1',
  name: 'Plot 7',
  lat: 18.59,
  lng: 73.73,
  radiusM: 100,
  address: null,
  isActive: true,
  createdAt: 'x',
  updatedAt: 'x',
};
const created: CreatedEmployeeDto = {
  employee: { id: 'e9', name: 'Sunita Jadhav', phone: '+919812345678', employeeCode: null, siteId: 's1', siteName: 'Plot 7', isActive: true, lockedUntil: null, createdAt: 'x' },
  pin: '482913',
};

function renderCreate(createEmployee = jest.fn(async () => created)) {
  const navigation = fakeNavigation();
  renderWithAuth(<EmployeeCreateScreen navigation={navigation as never} route={{} as never} />, {
    api: fakeApi({ createEmployee, listSites: jest.fn(async () => [site, { ...site, id: 's2', name: 'Old site', isActive: false }]) }),
    state: loggedIn(adminUser),
  });
  return { createEmployee, navigation };
}

async function fill() {
  fireEvent.changeText(screen.getByLabelText('Full name'), ' Sunita Jadhav ');
  fireEvent.changeText(screen.getByLabelText('Phone number'), '98123 45678');
  fireEvent.press(await screen.findByRole('radio', { name: 'Plot 7' }));
}

test('creates the employee and shows the PIN once', async () => {
  const { createEmployee, navigation } = renderCreate();
  await fill();
  expect(screen.queryByRole('radio', { name: 'Old site' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Create employee' }));
  expect(await screen.findByText('482913')).toBeOnTheScreen();
  expect(screen.getByText('PIN for Sunita Jadhav')).toBeOnTheScreen();
  expect(createEmployee).toHaveBeenCalledWith({ name: 'Sunita Jadhav', phone: '98123 45678', employeeCode: undefined, siteId: 's1' });
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(navigation.goBack).toHaveBeenCalled();
});

test('a phone number already in use is explained', async () => {
  renderCreate(
    jest.fn(async () => {
      throw new ApiError(409, 'PHONE_TAKEN', 'x', null);
    }),
  );
  await fill();
  fireEvent.press(screen.getByRole('button', { name: 'Create employee' }));
  expect(await screen.findByText('This phone number is already used')).toBeOnTheScreen();
});

test('a bad phone number is caught on the phone', async () => {
  const { createEmployee } = renderCreate();
  fireEvent.changeText(screen.getByLabelText('Full name'), 'Sunita');
  fireEvent.changeText(screen.getByLabelText('Phone number'), '123');
  fireEvent.press(screen.getByRole('button', { name: 'Create employee' }));
  expect(await screen.findByText('Enter a valid phone number')).toBeOnTheScreen();
  await waitFor(() => expect(createEmployee).not.toHaveBeenCalled());
});
```

`apps/mobile/src/screens/admin/EmployeeDetailScreen.test.tsx`:

```tsx
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { EmployeeDetailDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { EmployeeDetailScreen } from './EmployeeDetailScreen';

const detail: EmployeeDetailDto = {
  id: 'e1',
  name: 'Anil Pawar',
  phone: '+919876543210',
  employeeCode: 'E-7',
  siteId: 's1',
  siteName: 'Plot 7',
  isActive: true,
  lockedUntil: null,
  createdAt: '2026-09-01T00:00:00Z',
  sessions: [{ id: 'x1', deviceId: 'dev', deviceModel: 'Redmi 9A', createdAt: '2026-09-01T00:00:00Z', lastUsedAt: '2026-09-25T03:32:00Z' }],
};

function renderDetail(resetPin = jest.fn(async () => ({ pin: '555123' }))) {
  const parent = { navigate: jest.fn() };
  const navigation = { ...fakeNavigation(), getParent: () => parent };
  renderWithAuth(
    <EmployeeDetailScreen navigation={navigation as never} route={{ key: 'k', name: 'EmployeeDetail', params: { id: 'e1' } } as never} />,
    { api: fakeApi({ getEmployee: jest.fn(async () => detail), resetPin }), state: loggedIn(adminUser) },
  );
  return { parent, resetPin };
}

test('shows the profile and phones used', async () => {
  renderDetail();
  expect(await screen.findByText('Anil Pawar')).toBeOnTheScreen();
  expect(screen.getByText('Redmi 9A')).toBeOnTheScreen();
  expect(screen.getByText('Active')).toBeOnTheScreen();
});

test('reset PIN asks first, then shows the new PIN once', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { resetPin } = renderDetail();
  fireEvent.press(await screen.findByRole('button', { name: 'Reset PIN' }));
  expect(resetPin).not.toHaveBeenCalled();
  await act(async () => alert.mock.calls[0]?.[2]?.[1]?.onPress?.());
  expect(await screen.findByText('555123')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByText('555123')).toBeNull();
});

test('View attendance opens the Attendance tab filtered to this employee', async () => {
  const { parent } = renderDetail();
  fireEvent.press(await screen.findByRole('button', { name: 'View attendance' }));
  expect(parent.navigate).toHaveBeenCalledWith('AttendanceTab', {
    screen: 'AttendanceList',
    params: { employeeId: 'e1', employeeName: 'Anil Pawar' },
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/screens/admin`
Expected: the new suites FAIL with `Cannot find module` (`./adminErrors`, `./EmployeesScreen`, …). The Task 12 suites still pass.

- [ ] **Step 4: Implement helpers**

`apps/mobile/src/ui/useDebounced.ts`:

```ts
import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
```

`apps/mobile/src/screens/admin/adminErrors.ts`:

```ts
import { ApiError, NetworkError } from '../../api/errors';

export function adminErrorKey(err: unknown): string {
  if (err instanceof NetworkError) return 'common.noInternet';
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'PHONE_TAKEN':
        return 'admin.errors.phoneTaken';
      case 'EMPLOYEE_CODE_TAKEN':
        return 'admin.errors.codeTaken';
      case 'VALIDATION_ERROR':
        return 'admin.errors.invalid';
      case 'NOT_FOUND':
      case 'SITE_NOT_FOUND':
        return 'admin.errors.notFound';
    }
  }
  console.warn('admin action failed', err);
  return 'admin.errors.generic';
}
```

`apps/mobile/src/screens/admin/PinReveal.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

/** The API returns a PIN exactly once (on create or reset); this screen is the only place it appears. */
export function PinReveal({ title, pin, onDone }: { title: string; pin: string; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen edges={[]}>
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 20 }}>
        <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
          <Icon name="key" size={40} />
          <Text variant="h2" style={{ textAlign: 'center' }}>
            {title}
          </Text>
          <Text variant="monoHuge" selectable style={{ letterSpacing: 6 }}>
            {pin}
          </Text>
          <Text color={colors.muted} style={{ textAlign: 'center' }}>
            {t('admin.employees.pinHelp')}
          </Text>
        </Card>
        <Button label={t('common.done')} onPress={onDone} />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 5: Implement the screens**

`apps/mobile/src/screens/admin/EmployeesScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import type { EmployeesStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { useDebounced } from '../../ui/useDebounced';

type Props = NativeStackScreenProps<EmployeesStackParamList, 'Employees'>;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 40,
        borderRadius: 20,
        paddingHorizontal: 14,
        justifyContent: 'center',
        backgroundColor: selected ? colors.dark : colors.surface,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.inputBorder,
      }}
    >
      <Text variant="label" color={selected ? colors.onDark : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmployeesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(true);
  const q = useDebounced(search.trim(), 300);
  const filter = { q, isActive: active };
  const query = useQuery({ queryKey: queryKeys.employees(filter), queryFn: () => api.listEmployees(filter) });

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 12 }}>
        <Text variant="h1">{t('admin.employees.title')}</Text>
        <View style={{ height: 52, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            accessibilityLabel={t('admin.employees.search')}
            placeholder={t('admin.employees.search')}
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            style={{ flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('admin.employees.active')} selected={active} onPress={() => setActive(true)} />
          <Chip label={t('admin.employees.inactive')} selected={!active} onPress={() => setActive(false)} />
        </View>
      </View>

      {query.isPending ? (
        <Loading />
      ) : !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.lg }}
          contentContainerStyle={{ paddingBottom: 96 }}
          data={query.data}
          keyExtractor={(e) => e.id}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={
            <Text color={colors.muted} style={{ padding: 16 }}>
              {t('admin.employees.empty')}
            </Text>
          }
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => navigation.navigate('EmployeeDetail', { id: item.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 68, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.lineSoft }}
            >
              <Avatar name={item.name} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                  {item.name}
                </Text>
                <Text variant="small" color={colors.muted}>
                  {[item.phone, item.employeeCode, item.siteName ?? t('admin.employees.noSite')].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {item.lockedUntil && Date.parse(item.lockedUntil) > Date.now() ? (
                <Text variant="small" color={colors.checkOut}>
                  {t('admin.employees.locked')}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('admin.employees.add')}
        onPress={() => navigation.navigate('EmployeeCreate')}
        style={{ position: 'absolute', right: 20, bottom: 20, height: 60, borderRadius: 30, paddingLeft: 18, paddingRight: 22, backgroundColor: colors.dark, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6 }}
      >
        <Icon name="plus" color={colors.white} />
        <Text color={colors.white} style={{ fontFamily: fonts.bodyBold, fontSize: 16 }}>
          {t('admin.employees.add')}
        </Text>
      </Pressable>
    </Screen>
  );
}
```

`apps/mobile/src/screens/admin/EmployeeCreateScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { normalizePhone, type CreatedEmployeeDto } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import type { EmployeesStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { adminErrorKey } from './adminErrors';
import { PinReveal } from './PinReveal';

type Props = NativeStackScreenProps<EmployeesStackParamList, 'EmployeeCreate'>;

function SiteOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.dark : colors.inputBorder }}
    >
      <Text>{label}</Text>
      {selected ? <Icon name="check" /> : null}
    </Pressable>
  );
}

export function EmployeeCreateScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedEmployeeDto | null>(null);

  async function submit() {
    if (!name.trim()) return setErrorKey('admin.errors.nameRequired');
    if (!normalizePhone(phone)) return setErrorKey('login.errors.invalidPhone');
    setBusy(true);
    setErrorKey(null);
    try {
      const result = await api.createEmployee({ name: name.trim(), phone, employeeCode: code.trim() || undefined, siteId });
      setCreated(result);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
    } catch (err) {
      setErrorKey(adminErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <PinReveal
        title={t('admin.employees.pinTitle', { name: created.employee.name })}
        pin={created.pin}
        onDone={() => navigation.goBack()}
      />
    );
  }

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <TextField label={t('admin.employees.name')} value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField label={t('admin.employees.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label={t('admin.employees.code')} value={code} onChangeText={setCode} autoCapitalize="characters" />
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('admin.employees.site')}</Text>
          <SiteOption label={t('admin.employees.noSiteOption')} selected={siteId === null} onPress={() => setSiteId(null)} />
          {(sites.data ?? [])
            .filter((s) => s.isActive)
            .map((s) => (
              <SiteOption key={s.id} label={s.name} selected={siteId === s.id} onPress={() => setSiteId(s.id)} />
            ))}
        </View>
        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button label={busy ? t('admin.employees.saving') : t('admin.employees.create')} onPress={() => void submit()} disabled={busy} />
      </ScrollView>
    </Screen>
  );
}
```

`apps/mobile/src/screens/admin/EmployeeDetailScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { formatTime, formatWorkDateMedium, toIsoWithOffset } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import type { EmployeesStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { adminErrorKey } from './adminErrors';
import { PinReveal } from './PinReveal';

type Props = NativeStackScreenProps<EmployeesStackParamList, 'EmployeeDetail'>;

export function EmployeeDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { id } = route.params;
  const query = useQuery({ queryKey: queryKeys.employee(id), queryFn: () => api.getEmployee(id) });
  const [newPin, setNewPin] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function doReset() {
    setErrorKey(null);
    try {
      const { pin } = await api.resetPin(id);
      setNewPin(pin);
      void query.refetch();
    } catch (err) {
      setErrorKey(adminErrorKey(err));
    }
  }

  function confirmReset() {
    Alert.alert(t('admin.employees.resetTitle'), t('admin.employees.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('admin.employees.resetPin'), style: 'destructive', onPress: () => void doReset() },
    ]);
  }

  if (newPin) return <PinReveal title={t('admin.employees.newPin')} pin={newPin} onDone={() => setNewPin(null)} />;
  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen edges={[]}>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const e = query.data;
  const locked = e.lockedUntil && Date.parse(e.lockedUntil) > Date.now() ? e.lockedUntil : null;

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text variant="h1">{e.name}</Text>
          <Text variant="label" color={e.isActive ? colors.checkIn : colors.muted}>
            {e.isActive ? t('admin.employees.statusActive') : t('admin.employees.statusInactive')}
          </Text>
        </View>
        {locked ? <Banner tone="warn" icon="alert" title={t('admin.employees.lockedUntil', { time: formatTime(locked, t) })} /> : null}

        <Card style={{ gap: 4 }}>
          <Text variant="mono">{e.phone}</Text>
          {e.employeeCode ? <Text color={colors.muted}>{e.employeeCode}</Text> : null}
          <Text color={colors.muted}>{e.siteName ?? t('admin.employees.noSite')}</Text>
        </Card>

        <Card style={{ gap: 8 }}>
          <Text variant="label">{t('admin.employees.devices')}</Text>
          {e.sessions.length === 0 ? <Text color={colors.muted}>{t('admin.employees.noDevices')}</Text> : null}
          {e.sessions.map((s) => (
            <View key={s.id} style={{ gap: 2 }}>
              <Text variant="bodyStrong">{s.deviceModel ?? s.deviceId ?? t('admin.employees.unknownPhone')}</Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.employees.lastUsed', {
                  date: formatWorkDateMedium(toIsoWithOffset(new Date(s.lastUsedAt)).slice(0, 10), t),
                  time: formatTime(s.lastUsedAt, t),
                })}
              </Text>
            </View>
          ))}
        </Card>

        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button
          label={t('admin.employees.viewAttendance')}
          variant="secondary"
          icon="list"
          onPress={() =>
            navigation.getParent()?.navigate('AttendanceTab', {
              screen: 'AttendanceList',
              params: { employeeId: e.id, employeeName: e.name },
            })
          }
        />
        <Button label={t('admin.employees.resetPin')} icon="key" onPress={confirmReset} />
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 6: Add the Employees tab**

In `apps/mobile/src/navigation/AdminNavigator.tsx`, add these imports:

```tsx
import { EmployeeCreateScreen } from '../screens/admin/EmployeeCreateScreen';
import { EmployeeDetailScreen } from '../screens/admin/EmployeeDetailScreen';
import { EmployeesScreen } from '../screens/admin/EmployeesScreen';
```

Add `EmployeesStackParamList` to the `./types` import. Add below `AttendanceNavigator`:

```tsx
const EmployeesStack = createNativeStackNavigator<EmployeesStackParamList>();

function EmployeesNavigator() {
  const { t } = useTranslation();
  return (
    <EmployeesStack.Navigator screenOptions={stackScreenOptions}>
      <EmployeesStack.Screen name="Employees" component={EmployeesScreen} options={{ headerShown: false }} />
      <EmployeesStack.Screen name="EmployeeCreate" component={EmployeeCreateScreen} options={{ title: t('admin.employees.createTitle') }} />
      <EmployeesStack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} options={{ title: t('admin.employees.detailTitle') }} />
    </EmployeesStack.Navigator>
  );
}
```

In `AdminNavigator`, insert this between the `TodayTab` and `AttendanceTab` screens:

```tsx
      <Tab.Screen name="EmployeesTab" component={EmployeesNavigator} />
```

- [ ] **Step 7: Run tests, lint, typecheck**

Run: `pnpm --filter @ve/mobile test && pnpm lint && pnpm typecheck`
Expected: all pass (adminErrors 6, Employees 4, Create 3, Detail 3, plus earlier) and clean.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src
git commit -m "add employee list, create and pin reset for admins"
```

---

### Task 14: Admin Sites with a Leaflet map, and the mini-map on attendance detail

The admin map is Leaflet running in a WebView, loaded from bundled assets (`file:///android_asset/map/index.html`), with OSM tiles. The tile URL comes from `BuildConfig.TILE_URL` (Task 2), so it can be switched without code changes (spec §13). The page and the app talk over a small JSON bridge:

- app → page: `window.veMap.update(state)`, where `state = { center, radiusM, draggable, pins, recenterKey, tileUrl }`
- page → app: `{ type: 'ready' }` or `{ type: 'moved', lat, lng }`

The radius control is a −/+ stepper (10 m steps, clamped to 10–1000 m) plus preset chips, instead of the design's slider. React Native core has no slider, and this avoids a dependency. This is a deliberate deviation from `docs/design/screens/AdminSite`.

**Files:**
- Create: `apps/mobile/scripts/copy-leaflet.mjs`
- Create: `apps/mobile/android/app/src/main/assets/map/{index.html,bridge.js}`, plus the copied `leaflet.js`, `leaflet.css` and `LEAFLET-LICENSE.txt`
- Create: `apps/mobile/src/maps/LeafletMap.tsx`, `apps/mobile/src/testing/webView.ts`
- Create: `apps/mobile/src/screens/admin/{SitesScreen,SiteEditScreen}.tsx`
- Modify: `apps/mobile/src/screens/admin/AttendanceDetailScreen.tsx` (mini-map)
- Modify: `apps/mobile/src/navigation/AdminNavigator.tsx` (Sites tab)
- Modify: `apps/mobile/jest.setup.js` (WebView mock), `apps/mobile/src/i18n/en.json` (`admin.sites`)
- Test: `apps/mobile/src/maps/LeafletMap.test.tsx`, `apps/mobile/src/screens/admin/SitesScreen.test.tsx`, `apps/mobile/src/screens/admin/SiteEditScreen.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 7: `Api.listSites`, `getSite`, `createSite`, `updateSite`
  - from Task 4: `ensureLocationReady`, `getBestFix`
  - from Tasks 11–13: `queryKeys.sites/site`, `adminErrorKey`, `stackScreenOptions`
- Produces:
  - `interface LatLng { lat: number; lng: number }`, `interface MapPin extends LatLng { color: string }`
  - `LeafletMap({ center, radiusM, height, draggable?, interactive?, pins?, recenterKey?, onMove?, testID? })`
  - `parseMapMessage(data: string)`
  - `injectedScripts: string[]` (test helper)
  - `SitesScreen`, `SiteEditScreen` and `SitesTab`

- [ ] **Step 1: Add strings**

Inside the `admin` object of `src/i18n/en.json`:

```json
    "sites": {
      "title": "Sites",
      "add": "Add site",
      "empty": "No sites yet",
      "radius": "{{m}} m",
      "inactive": "Inactive",
      "newTitle": "New site",
      "editTitle": "Edit site",
      "name": "Site name",
      "address": "Address (optional)",
      "allowedDistance": "Allowed distance",
      "smaller": "Smaller",
      "larger": "Larger",
      "dragHint": "Drag the pin to the site gate or centre.",
      "useMyLocation": "Use my location",
      "locating": "Finding your location…",
      "active": "Site is active",
      "save": "Save site",
      "saving": "Saving…"
    }
```

- [ ] **Step 2: Mock the WebView for Jest**

`apps/mobile/src/testing/webView.ts`:

```ts
/** Scripts the app injected into the (mocked) map WebView, newest last. Reset before each test. */
export const injectedScripts: string[] = [];
```

Append to `apps/mobile/jest.setup.js`:

```js
jest.mock('react-native-webview', () => {
  const React = require('react');
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (js) => require('./src/testing/webView').injectedScripts.push(js),
    }));
    return React.createElement('WebView', props);
  });
  return { __esModule: true, default: WebView, WebView };
});

beforeEach(() => {
  require('./src/testing/webView').injectedScripts.length = 0;
});
```

- [ ] **Step 3: Write the failing tests**

`apps/mobile/src/maps/LeafletMap.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { injectedScripts } from '../testing/webView';
import { LeafletMap, parseMapMessage } from './LeafletMap';

const message = (data: unknown) => ({ nativeEvent: { data: typeof data === 'string' ? data : JSON.stringify(data) } });

test('sends the map state once the page says it is ready', async () => {
  render(<LeafletMap testID="map" center={{ lat: 18.5, lng: 73.8 }} radiusM={120} height={200} draggable />);
  expect(injectedScripts).toEqual([]);
  fireEvent(screen.getByTestId('map'), 'message', message({ type: 'ready' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(1));
  expect(injectedScripts[0]).toContain('"radiusM":120');
  expect(injectedScripts[0]).toContain('"draggable":true');
  expect(injectedScripts[0]).toContain('https://tiles.test/{z}/{x}/{y}.png');
});

test('a dragged pin reports its new position', () => {
  const onMove = jest.fn();
  render(<LeafletMap testID="map" center={{ lat: 18.5, lng: 73.8 }} radiusM={120} height={200} onMove={onMove} />);
  fireEvent(screen.getByTestId('map'), 'message', message({ type: 'moved', lat: 18.51, lng: 73.81 }));
  expect(onMove).toHaveBeenCalledWith({ lat: 18.51, lng: 73.81 });
});

test('junk from the page is ignored', () => {
  expect(parseMapMessage('not json')).toBeNull();
  expect(parseMapMessage('{"type":"moved","lat":"x","lng":1}')).toBeNull();
  expect(parseMapMessage('{"type":"moved","lat":95,"lng":1}')).toBeNull();
  expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
});
```

`apps/mobile/src/screens/admin/SitesScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import type { SiteDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { SitesScreen } from './SitesScreen';

const site: SiteDto = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100, address: 'Hinjewadi', isActive: true, createdAt: 'x', updatedAt: 'x' };

test('lists sites and opens create and edit', async () => {
  const navigation = fakeNavigation();
  renderWithAuth(<SitesScreen navigation={navigation as never} route={{} as never} />, {
    api: fakeApi({ listSites: jest.fn(async () => [site, { ...site, id: 's2', name: 'Old yard', isActive: false }]) }),
    state: loggedIn(adminUser),
  });
  expect(await screen.findByText('Plot 7')).toBeOnTheScreen();
  expect(screen.getByText('Hinjewadi · 100 m')).toBeOnTheScreen();
  expect(screen.getByText('Inactive')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: /Plot 7/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('SiteEdit', { id: 's1' });
  fireEvent.press(screen.getByRole('button', { name: 'Add site' }));
  expect(navigation.navigate).toHaveBeenCalledWith('SiteEdit', {});
});
```

`apps/mobile/src/screens/admin/SiteEditScreen.test.tsx`:

```tsx
import React from 'react';
import { PermissionsAndroid } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { SiteDto } from '@ve/shared';
import { fakeApi } from '../../testing/fakeApi';
import { fakeState } from '../../testing/fakeNative';
import { adminUser, fakeNavigation, loggedIn, renderWithAuth } from '../../testing/render';
import { injectedScripts } from '../../testing/webView';
import { SiteEditScreen } from './SiteEditScreen';

const site: SiteDto = { id: 's1', name: 'Plot 7', lat: 18.59, lng: 73.73, radiusM: 100, address: null, isActive: true, createdAt: 'x', updatedAt: 'x' };
const moved = (lat: number, lng: number) => ({ nativeEvent: { data: JSON.stringify({ type: 'moved', lat, lng }) } });

function renderEdit(params: { id?: string }, api = {}) {
  const navigation = fakeNavigation();
  const createSite = jest.fn(async () => site);
  const updateSite = jest.fn(async () => site);
  renderWithAuth(<SiteEditScreen navigation={navigation as never} route={{ key: 'k', name: 'SiteEdit', params } as never} />, {
    api: fakeApi({ createSite, updateSite, getSite: jest.fn(async () => site), ...api }),
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

test('new site: name, dragged pin and larger radius are saved', async () => {
  const { createSite, navigation } = renderEdit({});
  fireEvent.changeText(screen.getByLabelText('Site name'), ' Plot 9 ');
  fireEvent(screen.getByTestId('site-map'), 'message', moved(18.6, 73.7));
  fireEvent.press(screen.getByRole('button', { name: 'Larger' }));
  expect(screen.getByText('110 m')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(createSite).toHaveBeenCalledWith({ name: 'Plot 9', address: undefined, lat: 18.6, lng: 73.7, radiusM: 110 }),
  );
  expect(navigation.goBack).toHaveBeenCalled();
});

test('radius never goes below 10 m', () => {
  renderEdit({});
  fireEvent.press(screen.getByRole('button', { name: '50 m' }));
  for (let i = 0; i < 10; i++) fireEvent.press(screen.getByRole('button', { name: 'Smaller' }));
  expect(screen.getByText('10 m')).toBeOnTheScreen();
});

test('edit: loads the site and saves changes', async () => {
  const { updateSite } = renderEdit({ id: 's1' });
  expect(await screen.findByDisplayValue('Plot 7')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '200 m' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  await waitFor(() =>
    expect(updateSite).toHaveBeenCalledWith('s1', { name: 'Plot 7', address: null, lat: 18.59, lng: 73.73, radiusM: 200, isActive: true }),
  );
});

test('use my location moves the pin to the phone position', async () => {
  fakeState.fix = { lat: 18.7, lng: 73.9, accuracyM: 8, isMock: false };
  renderEdit({});
  fireEvent(screen.getByTestId('site-map'), 'message', { nativeEvent: { data: '{"type":"ready"}' } });
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('18.70000, 73.90000')).toBeOnTheScreen();
  await waitFor(() => expect(injectedScripts.at(-1)).toContain('"lat":18.7'));
});

test('use my location with location off explains why', async () => {
  fakeState.locationEnabled = false;
  renderEdit({});
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(await screen.findByText('Turn on location')).toBeOnTheScreen();
});

test('a site needs a name', async () => {
  const { createSite } = renderEdit({});
  fireEvent.press(screen.getByRole('button', { name: 'Save site' }));
  expect(await screen.findByText('Enter the name')).toBeOnTheScreen();
  expect(createSite).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter @ve/mobile test -- src/maps src/screens/admin/Site`
Expected: FAIL with `Cannot find module` for `./LeafletMap`, `./SitesScreen` and `./SiteEditScreen`.

- [ ] **Step 5: Map assets**

`apps/mobile/scripts/copy-leaflet.mjs`:

```js
// Copies Leaflet's built files into the Android assets next to our map page.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('leaflet/dist/leaflet.js'));
const out = join(dirname(fileURLToPath(import.meta.url)), '../android/app/src/main/assets/map');

mkdirSync(out, { recursive: true });
for (const file of ['leaflet.js', 'leaflet.css']) copyFileSync(join(dist, file), join(out, file));
copyFileSync(join(dist, '..', 'LICENSE'), join(out, 'LEAFLET-LICENSE.txt'));
console.log(`copied Leaflet into ${out}`);
```

Run: `pnpm --filter @ve/mobile leaflet`
Expected: `copied Leaflet into …/assets/map`.

`apps/mobile/android/app/src/main/assets/map/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="leaflet.css" />
    <style>
      html, body, #map { margin: 0; height: 100%; background: #e9e4d8; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="leaflet.js"></script>
    <script src="bridge.js"></script>
  </body>
</html>
```

`apps/mobile/android/app/src/main/assets/map/bridge.js` (ES5 only, because older system WebViews must run it):

```js
(function () {
  var map = L.map('map', { zoomControl: true }).setView([18.5204, 73.8567], 16);
  var tiles = null;
  var tileUrl = null;
  var centre = null;
  var circle = null;
  var pins = [];
  var lastRecenter = null;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function update(s) {
    if (s.tileUrl !== tileUrl) {
      if (tiles) map.removeLayer(tiles);
      tileUrl = s.tileUrl;
      tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    }
    var ll = [s.center.lat, s.center.lng];
    if (!centre) {
      centre = L.marker(ll, {
        draggable: true,
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

    for (var i = 0; i < pins.length; i++) map.removeLayer(pins[i]);
    pins = [];
    for (var j = 0; j < s.pins.length; j++) {
      var p = s.pins[j];
      pins.push(L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 }).addTo(map));
    }

    if (s.recenterKey !== lastRecenter) {
      lastRecenter = s.recenterKey;
      var bounds = circle.getBounds();
      for (var k = 0; k < pins.length; k++) bounds.extend(pins[k].getLatLng());
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    }
  }

  window.veMap = { update: update };
  post({ type: 'ready' });
})();
```

- [ ] **Step 6: `LeafletMap` component**

`apps/mobile/src/maps/LeafletMap.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { getDeviceInfo } from '../native/device';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPin extends LatLng {
  color: string;
}

interface Props {
  center: LatLng;
  radiusM: number;
  height: number;
  draggable?: boolean;
  /** false = a static picture: touches pass through (e.g. inside a ScrollView). */
  interactive?: boolean;
  pins?: MapPin[];
  /** Change this number to make the map fit the circle and pins again. */
  recenterKey?: number;
  onMove?: (position: LatLng) => void;
  testID?: string;
}

const MAP_URL = 'file:///android_asset/map/index.html';

type MapMessage = { type: 'ready' } | { type: 'moved'; lat: number; lng: number };

export function parseMapMessage(data: string): MapMessage | null {
  try {
    const msg = JSON.parse(data) as { type?: unknown; lat?: unknown; lng?: unknown };
    if (msg.type === 'ready') return { type: 'ready' };
    if (
      msg.type === 'moved' &&
      typeof msg.lat === 'number' &&
      typeof msg.lng === 'number' &&
      Math.abs(msg.lat) <= 90 &&
      Math.abs(msg.lng) <= 180
    ) {
      return { type: 'moved', lat: msg.lat, lng: msg.lng };
    }
  } catch {
    // not ours
  }
  return null;
}

export function LeafletMap({ center, radiusM, height, draggable = false, interactive = true, pins = [], recenterKey = 0, onMove, testID }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [tileUrl, setTileUrl] = useState<string | null>(null);

  useEffect(() => {
    getDeviceInfo()
      .then((info) => setTileUrl(info.tileUrl))
      .catch((err: unknown) => console.warn('map: no tile url', err));
  }, []);

  const state = JSON.stringify({ center, radiusM, draggable, pins, recenterKey, tileUrl });
  useEffect(() => {
    if (ready && tileUrl) ref.current?.injectJavaScript(`window.veMap && window.veMap.update(${state}); true;`);
  }, [ready, tileUrl, state]);

  function onMessage(event: WebViewMessageEvent) {
    const msg = parseMapMessage(event.nativeEvent.data);
    if (msg?.type === 'ready') setReady(true);
    if (msg?.type === 'moved') onMove?.({ lat: msg.lat, lng: msg.lng });
  }

  return (
    <View style={{ height, backgroundColor: '#E9E4D8', pointerEvents: interactive ? 'auto' : 'none' }}>
      <WebView
        ref={ref}
        testID={testID}
        source={{ uri: MAP_URL }}
        originWhitelist={['file://*']}
        javaScriptEnabled
        applicationNameForUserAgent="VeHR-admin-map"
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
```

- [ ] **Step 7: Sites screens**

`apps/mobile/src/screens/admin/SitesScreen.tsx`:

```tsx
import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import type { SitesStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

type Props = NativeStackScreenProps<SitesStackParamList, 'Sites'>;

export function SitesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const query = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 }}>
        <Text variant="h1">{t('admin.sites.title')}</Text>
      </View>
      {query.isPending ? (
        <Loading />
      ) : !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96, gap: 8 }}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={<Text color={colors.muted}>{t('admin.sites.empty')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => navigation.navigate('SiteEdit', { id: item.id })}
              style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="pin" size={20} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{item.name}</Text>
                <Text variant="small" color={colors.muted}>
                  {[item.address, t('admin.sites.radius', { m: item.radiusM })].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {item.isActive ? null : (
                <Text variant="small" color={colors.muted}>
                  {t('admin.sites.inactive')}
                </Text>
              )}
            </Pressable>
          )}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('admin.sites.add')}
        onPress={() => navigation.navigate('SiteEdit', {})}
        style={{ position: 'absolute', right: 20, bottom: 20, height: 60, borderRadius: 30, paddingLeft: 18, paddingRight: 22, backgroundColor: colors.dark, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6 }}
      >
        <Icon name="plus" color={colors.white} />
        <Text color={colors.white} style={{ fontFamily: fonts.bodyBold, fontSize: 16 }}>
          {t('admin.sites.add')}
        </Text>
      </Pressable>
    </Screen>
  );
}
```

`apps/mobile/src/screens/admin/SiteEditScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

/** Pune city centre: only a starting view until the admin drags the pin or uses their location. */
const DEFAULT_CENTER: LatLng = { lat: 18.5204, lng: 73.8567 };
const MIN_RADIUS = 10;
const MAX_RADIUS = 1000;
const PRESETS = [50, 100, 200, 500];

const LOCATION_PROBLEM_KEY: Record<LocationProblem, string> = {
  LOCATION_OFF: 'result.locationOff',
  PERMISSION_DENIED: 'result.permissionDenied',
  PRECISE_LOCATION_REQUIRED: 'result.preciseRequired',
};

const clampRadius = (m: number) => Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, m));

export function SiteEditScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const id = route.params.id;
  const siteQuery = useQuery({ queryKey: queryKeys.site(id ?? 'new'), queryFn: () => api.getSite(id ?? ''), enabled: !!id });

  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [radiusM, setRadiusM] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

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

  async function useMyLocation() {
    setErrorKey(null);
    setLocating(true);
    try {
      const problem = await ensureLocationReady();
      if (problem) return setErrorKey(LOCATION_PROBLEM_KEY[problem]);
      const fix = await getBestFix(20, 15_000);
      if (!fix) return setErrorKey('result.lowAccuracy');
      setCenter({ lat: fix.lat, lng: fix.lng });
      setRecenterKey((k) => k + 1);
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!name.trim()) return setErrorKey('admin.errors.nameRequired');
    setBusy(true);
    setErrorKey(null);
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
      setErrorKey(adminErrorKey(err));
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

  return (
    <Screen edges={[]}>
      <View>
        <LeafletMap testID="site-map" center={center} radiusM={radiusM} height={300} draggable recenterKey={recenterKey} onMove={setCenter} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('admin.sites.useMyLocation')}
          onPress={() => void useMyLocation()}
          disabled={locating}
          style={{ position: 'absolute', left: 12, bottom: 12, height: 48, borderRadius: 24, paddingHorizontal: 16, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 3 }}
        >
          <Icon name="locate" size={20} />
          <Text variant="label">{locating ? t('admin.sites.locating') : t('admin.sites.useMyLocation')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text variant="mono" color={colors.muted}>{`${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`}</Text>
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

        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button label={busy ? t('admin.sites.saving') : t('admin.sites.save')} onPress={() => void save()} disabled={busy} />
      </ScrollView>
    </Screen>
  );
}
```

The first test presses the "Larger" button after changing the name; its label shows "110 m", while the preset chip labels stay "50 m"/"100 m"/…. `getByText('110 m')` is therefore unique. In the "radius never goes below" test, `getByText('10 m')` matches only the stepper value, because no preset is 10.

- [ ] **Step 8: Mini-map on attendance detail**

In `AttendanceDetailScreen.tsx`, add `import { LeafletMap, type MapPin } from '../../maps/LeafletMap';`. Change the destructuring to `const { day, events, site } = query.data;`. Insert this as the first child of the `ScrollView`, before the name block:

```tsx
        <View style={{ borderRadius: 16, overflow: 'hidden' }}>
          <LeafletMap
            center={{ lat: site.lat, lng: site.lng }}
            radiusM={site.radiusM}
            height={220}
            interactive={false}
            recenterKey={1}
            pins={[
              { lat: day.checkInLat, lng: day.checkInLng, color: colors.checkIn },
              ...(day.checkOutLat != null && day.checkOutLng != null
                ? [{ lat: day.checkOutLat, lng: day.checkOutLng, color: colors.checkOut } satisfies MapPin]
                : []),
            ]}
          />
        </View>
```

- [ ] **Step 9: Sites tab**

In `AdminNavigator.tsx`, import `SiteEditScreen`, `SitesScreen` and `SitesStackParamList`, then add:

```tsx
const SitesStack = createNativeStackNavigator<SitesStackParamList>();

function SitesNavigator() {
  return (
    <SitesStack.Navigator screenOptions={stackScreenOptions}>
      <SitesStack.Screen name="Sites" component={SitesScreen} options={{ headerShown: false }} />
      <SitesStack.Screen name="SiteEdit" component={SiteEditScreen} />
    </SitesStack.Navigator>
  );
}
```

Insert `<Tab.Screen name="SitesTab" component={SitesNavigator} />` between `EmployeesTab` and `AttendanceTab`.

- [ ] **Step 10: Run tests, lint, typecheck, build**

Run: `pnpm --filter @ve/mobile test && pnpm lint && pnpm typecheck`
Expected: all pass (LeafletMap 3, Sites 1, SiteEdit 6, plus everything earlier, including the AttendanceDetail test with the map added) and clean.

Run: `cd apps/mobile/android && ./gradlew assembleDebug --no-daemon -q > /tmp/vehr-build.log 2>&1; tail -5 /tmp/vehr-build.log`
Expected: `BUILD SUCCESSFUL`.

On the phone or emulator from Task 12, log in as admin:

- **Sites → Add site:** the map shows OSM tiles with the "© OpenStreetMap contributors" credit. Dragging the pin moves the circle and updates the coordinates line. "Use my location" jumps to the phone. Save, and the site appears in the list.
- **Attendance → a row:** the mini-map shows the site circle and the check-in pin.

Record the results in the ledger.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile
git commit -m "add site map editor for admins"
```

---

### Task 15: Release build, CI and the release checklist

Spec §10 asks for R8 on, per-ABI APKs of at most 20 MB, HTTPS-only release builds, a release APK built in CI on every push, and a device test matrix. This task wires all of that and documents how to run the app.

**Files:**
- Modify: `apps/mobile/android/app/build.gradle` (release block, splits, signing, https check)
- Modify: `apps/mobile/android/app/proguard-rules.pro`
- Create: `apps/mobile/scripts/check-apk-size.sh`
- Modify: `.github/workflows/ci.yml` (new `android` job)
- Modify: `README.md` (mobile section)
- Create: `docs/testing/mobile-manual-checklist.md`

**Interfaces:**
- Consumes:
  - from Task 2: `API_URL`/`TILE_URL` BuildConfig fields from `VE_API_URL`/`VE_TILE_URL`
  - from Task 3: native package `com.vehr.app.device`
- Produces:
  - env vars `VE_KEYSTORE_FILE`, `VE_KEYSTORE_PASSWORD`, `VE_KEY_ALIAS`, `VE_KEY_PASSWORD` (optional; without them release is signed with the debug key, which is fine for CI and not for real rollout)
  - `apps/mobile/scripts/check-apk-size.sh <dir> <maxMB>`

- [ ] **Step 1: Prove the release build currently accepts plain HTTP (the failing check)**

Run: `cd apps/mobile/android && VE_API_URL=http://insecure.test ./gradlew assembleRelease --no-daemon -q > /tmp/vehr-release.log 2>&1; echo "exit $?"; tail -3 /tmp/vehr-release.log`
Expected: `exit 0`. The release build accepts an `http://` API. That is the bug this task closes.

- [ ] **Step 2: Release config in `android/app/build.gradle`**

Near the top, change `def enableProguardInReleaseBuilds = false` to:

```groovy
def enableProguardInReleaseBuilds = true
```

Inside `android { … }`, replace the template's `signingConfigs { … }` and `buildTypes { … }` blocks with:

```groovy
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def ks = System.getenv('VE_KEYSTORE_FILE')
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv('VE_KEYSTORE_PASSWORD')
                keyAlias System.getenv('VE_KEY_ALIAS')
                keyPassword System.getenv('VE_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Without VE_KEYSTORE_FILE (CI, local checks) the APK is debug-signed: installable, not for rollout.
            signingConfig System.getenv('VE_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug
            minifyEnabled enableProguardInReleaseBuilds
            shrinkResources enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
            universalApk false
        }
    }
```

At the end of the file (outside `android { }`):

```groovy
// Spec §10: release builds talk to the API over HTTPS only.
gradle.taskGraph.whenReady { graph ->
    def releasing = graph.allTasks.any { it.project == project && it.name ==~ /(assemble|bundle|install)Release/ }
    def apiUrl = System.getenv('VE_API_URL') ?: ''
    if (releasing && !apiUrl.startsWith('https://')) {
        throw new GradleException("Release builds need VE_API_URL to start with https:// (got '${apiUrl}')")
    }
}
```

- [ ] **Step 3: Keep rules**

Append to `apps/mobile/android/app/proguard-rules.pro`:

```
# Our TurboModule is looked up by name from JS; keep it and its codegen spec.
-keep class com.vehr.app.device.** { *; }
-keep class com.vehr.app.specs.** { *; }
```

- [ ] **Step 4: Size check script**

`apps/mobile/scripts/check-apk-size.sh`:

```bash
#!/usr/bin/env bash
# Fails if any APK in <dir> is larger than <maxMB> (spec §10: ≤ 20 MB per ABI).
set -euo pipefail
dir="$1"
max_mb="$2"
max=$((max_mb * 1024 * 1024))
shopt -s nullglob
apks=("$dir"/*.apk)
if [ ${#apks[@]} -eq 0 ]; then
  echo "no APKs in $dir" >&2
  exit 1
fi
status=0
for apk in "${apks[@]}"; do
  size=$(stat -c %s "$apk")
  printf '%-40s %6.1f MB\n' "$(basename "$apk")" "$(echo "$size / 1048576" | bc -l)"
  if [ "$size" -gt "$max" ]; then
    echo "  over ${max_mb} MB" >&2
    status=1
  fi
done
exit $status
```

Run: `chmod +x apps/mobile/scripts/check-apk-size.sh`

- [ ] **Step 5: Verify the https check and the release APKs**

Run: `cd apps/mobile/android && VE_API_URL=http://insecure.test ./gradlew assembleRelease --no-daemon -q > /tmp/vehr-release.log 2>&1; echo "exit $?"; grep -m1 "need VE_API_URL" /tmp/vehr-release.log`
Expected: `exit 1` and `Release builds need VE_API_URL to start with https:// (got 'http://insecure.test')`.

Run: `cd apps/mobile/android && VE_API_URL=http://insecure.test ./gradlew assembleDebug --no-daemon -q > /tmp/vehr-build.log 2>&1; echo "exit $?"`
Expected: `exit 0`. Debug builds still allow the local HTTP API.

Run: `cd apps/mobile/android && VE_API_URL=https://api.example.invalid ./gradlew assembleRelease --no-daemon -q > /tmp/vehr-release.log 2>&1; echo "exit $?"; ../scripts/check-apk-size.sh app/build/outputs/apk/release 20`
Expected: `exit 0`, then four lines (`app-arm64-v8a-release.apk`, `app-armeabi-v7a-release.apk`, `app-x86-release.apk`, `app-x86_64-release.apk`), each under 20 MB, and exit 0.

Install the arm64 or x86_64 release APK on the emulator (`adb install -r app/build/outputs/apk/release/app-x86_64-release.apk`) and open it. The login screen appears, and Logcat shows no `ClassNotFoundException`/`NoSuchMethodError` (R8 did not strip the native module). With the `https://api.example.invalid` URL, a login attempt shows "Not saved, no internet" instead of crashing.

- [ ] **Step 6: CI job**

Append to `.github/workflows/ci.yml` under `jobs:` (same indentation as `api:`):

```yaml
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
          cache: gradle
      - uses: android-actions/setup-android@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @ve/mobile test
      - name: Release APK
        working-directory: apps/mobile/android
        env:
          VE_API_URL: https://api.example.invalid
        run: ./gradlew assembleRelease --no-daemon
      - name: APK size (≤ 20 MB per ABI)
        run: apps/mobile/scripts/check-apk-size.sh apps/mobile/android/app/build/outputs/apk/release 20
```

The `api` job's `pnpm lint`, `pnpm typecheck` and `pnpm test` already cover mobile, because they run across the workspace.

- [ ] **Step 7: README mobile section**

In `README.md`, add a bullet below the `apps/api` bullet:

```markdown
- `apps/mobile`: React Native Android app (Android 10+) for workers and admins
```

Add a new section before `## Checks`:

````markdown
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
````

- [ ] **Step 8: Manual release checklist**

`docs/testing/mobile-manual-checklist.md`:

```markdown
# Mobile release checklist

Run on a **release** APK (`assembleRelease` with the real `VE_API_URL`) before handing the app to workers.
Record the date, build and result for each device.

## Devices (spec §10)

| Device | Android | Result |
| --- | --- | --- |
| Emulator | API 29 (10) | |
| Emulator | API 30 (11) | |
| Emulator | API 31 (12) | |
| Emulator | API 34+ | |
| Physical phone, 2–3 GB RAM | any | |

## Everyday flow (every device)

- [ ] Worker logs in with phone + PIN; closing and reopening the app keeps them logged in.
- [ ] Check in inside the site circle: green "Attendance saved" screen with the time.
- [ ] Check out: saved; Home shows the day's hours; History shows the day.
- [ ] Admin logs in; Today numbers match; the worker's day appears in Attendance with the map.
- [ ] Cold start (app killed → login or home visible) ≤ 3 s on the 2–3 GB phone.

## Failure cases (at least API 29, API 31+ and the physical phone)

- [ ] GPS/location off → "Turn on location", button opens location settings.
- [ ] Location permission denied (and "Don't ask again") → "Allow location", button opens app settings.
- [ ] Android 12+: approximate location only → "Allow precise location".
- [ ] Airplane mode → "Not saved, no internet", nothing saved; turn network on, try again → saved once.
- [ ] Force-close the app right after tapping CHECK IN; reopen → exactly one check-in on the server, never two.
- [ ] Fake GPS app active (developer options mock location) → the attempt is flagged for the admin.
- [ ] Phone clock set 2 hours wrong → server time is used; the saved time is correct.
- [ ] Outside the site circle → "You are N m away from the site", nothing saved.
- [ ] Double-tap CHECK IN quickly → one request, one result.
- [ ] Phone without Google Play Services (or emulator image without it) → location still works (LocationManager fallback).
- [ ] Low memory: open several heavy apps, return to VE HR → no crash; state restored or login shown.
- [ ] Evening reminder: after check-in, the reminder arrives at the company reminder time if not checked out; checking out cancels it.

## Known gaps (Phase 1)

- The check-out reminder is not re-scheduled after a phone reboot; it comes back the next time the app opens.
- Release APKs are signed with the debug key unless the `VE_KEYSTORE_*` variables are set.
```

- [ ] **Step 9: Final checks**

Run: `pnpm lint && pnpm typecheck && pnpm test > /tmp/vehr-all.log 2>&1; echo "exit $?"; tail -15 /tmp/vehr-all.log`
Expected: `exit 0`; API and mobile suites all pass.

Run: `git diff --stat origin/main -- .github apps/mobile/android/app/build.gradle`
Expected: only the intended files changed.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile .github/workflows/ci.yml README.md docs/testing/mobile-manual-checklist.md
git commit -m "add release build checks, ci and test checklist"
```

