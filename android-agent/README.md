# Asset Monitoring Agent (Android)

The phone counterpart of the Windows PowerShell agent. Installed on
**company-owned phones** handed out to employees, it reports a heartbeat
every 15 minutes to the asset management server: battery and charging
state, free storage, RAM, uptime, screen-on/idle, and location.

No messages, photos, contacts, or browsing data are collected — the app's
only screen says exactly what it reports.

## Build the APK (one-time, on your PC)

1. Install [Android Studio](https://developer.android.com/studio) (free).
2. **Open** this `android-agent/` folder in Android Studio and let Gradle sync
   (first sync downloads dependencies; a few minutes).
3. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. The APK lands at `app/build/outputs/apk/debug/app-debug.apk`.

> The debug APK is fine for internal company phones. If Play Protect nags,
> build a signed release instead: **Build → Generate Signed App Bundle / APK**
> and create a keystore once (keep it safe — reuse it for every update).

## Install on each phone (~3 minutes)

1. In the dashboard: open the asset → **Device monitoring** → platform
   **Android** → **Enroll device**. Copy the device token.
2. Copy `app-debug.apk` to the phone (USB, or any file share) and open it.
   Allow "install unknown apps" when prompted.
3. Open **Asset Agent**, paste the **server URL** and the **token**, tap
   **Save & start monitoring**.
4. Grant location — choose **"Allow all the time"** so heartbeats include
   location while the phone is in someone's pocket.
5. Tap **"Allow background running (battery)"** and accept, so Android
   doesn't kill the 15-minute schedule. On aggressive OEMs (Xiaomi, Oppo,
   Vivo, Realme) also set the app to "No restrictions" in battery settings.

The phone appears in **Monitoring** within a minute (the save fires an
immediate test heartbeat) and reports every ~15 minutes after that.

## Notes

- **Interval**: 15 minutes is Android's minimum for background periodic work.
  The server treats phones as offline only after 40 minutes of silence
  (migration `0005`), so normal Doze delays don't cause false alarms.
- **Location**: with permission it sends a real fix (`loc_source: gps`);
  without it the server still gets city-level location from the request IP
  once the app talks to the deployed (Vercel) server.
- **Local testing**: run the dev server on your PC, put the phone on the
  same Wi-Fi, and use `http://<your-pc-ip>:3000` as the server URL
  (cleartext HTTP is allowed by the manifest for exactly this).
- **Token rotation**: re-enroll the asset in the dashboard, then paste the
  new token in the app and Save again.
- **Uninstall** = stop monitoring; also "Stop monitoring" in the dashboard
  invalidates the token server-side.
