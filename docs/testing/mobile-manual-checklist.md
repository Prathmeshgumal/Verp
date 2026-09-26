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
