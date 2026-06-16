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

> Do the install **before** handing the phone to the employee, while the agent
> is still unlocked (see "Locking the agent" below).

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
6. Tap **"Enable uninstall protection"** (basic deterrent). For protection the
   employee truly can't bypass, see **"Preventing uninstall"** below.

The phone appears in **Monitoring** within a minute (the save fires an
immediate test heartbeat) and reports every ~15 minutes after that.

## Locking the agent (admin control)

The agent has a simple **Lock / Unlock switch** controlled from the dashboard —
no passwords to manage. **Locked** → the employee can't open the app, change the
server/token, or stop monitoring. **Unlocked** → the app opens freely so staff
can make changes. Monitoring keeps running in the background either way.

1. Do the full install + permission setup above **while the agent is unlocked**
   (devices enroll unlocked so setup is smooth).
2. When you're done, in the dashboard open **Monitoring → (the device) → Agent
   control (mobile)** and tap **Lock agent**. Hand the phone to the employee.
   From then on, opening **Asset Agent** just shows a "locked by your
   administrator" screen.
3. To manage the device later, tap **Unlock agent** in that same dashboard
   panel, then open the app — it checks the server on launch, so the unlock
   takes effect within seconds. Make your changes, then **Lock agent** again.

The lock state also rides down on the regular heartbeat, so it stays in sync
even between app opens (within ~15 min).

## Preventing uninstall

There are two levels, because of how Android works:

- **Basic (Device Admin)** — the **"Enable uninstall protection"** button
  registers the app as a device administrator. ⚠️ This does **not** truly stop
  uninstall: a determined employee can open **Settings → Security → Device admin
  apps**, deactivate "Asset Agent", and then uninstall. It's only a speed bump.
- **Full (Device Owner)** — the only way to *actually* block uninstall. The app
  becomes the owner of a fully-managed phone, so uninstall is greyed out and
  there is no deactivate toggle. It's provisioned once over USB on a **freshly
  reset phone that has no accounts added yet**:

  1. Factory-reset the phone. In the setup wizard, **skip adding any Google (or
     other) account** — device owner can't be set once an account exists.
  2. Enable **Developer options → USB debugging**, connect to a PC with `adb`,
     and install the APK: `adb install app-debug.apk`
  3. Make the agent the device owner:

     ```
     adb shell dpm set-device-owner com.ayatech.assetagent/.AgentDeviceAdminReceiver
     ```

  4. Open **Asset Agent** and tap **"Enable uninstall protection"** — the status
     line reads **"Fully protected"** and the app can no longer be removed.

  To decommission later: open the app, tap **"Disable uninstall protection"**,
  then run
  `adb shell dpm remove-active-admin com.ayatech.assetagent/.AgentDeviceAdminReceiver`
  (or just factory-reset the phone).

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
