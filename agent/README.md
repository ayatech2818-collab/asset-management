# Asset Monitoring Agent (Windows)

A lightweight PowerShell agent that reports device telemetry (online status,
activity/idle, battery, disk, CPU/RAM, uptime, IP-based location) to the asset
management server every 5 minutes.

Chosen over a compiled `.exe` because it needs no build step, triggers no
SmartScreen/antivirus warnings, and IT can read exactly what it does.

## Install (per device, ~2 minutes, needs Administrator)

1. In the dashboard, open the asset → **Device monitoring** → **Enroll device**.
   Copy the generated **device token** and the install command shown.
2. Copy this `agent/` folder onto the target laptop (USB or network share).
3. Open **PowerShell as Administrator** in that folder and run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-agent.ps1 `
     -Token <DEVICE_TOKEN> -Server https://your-app.example.com
   ```

4. The laptop appears in **Monitoring** within a few minutes.

## What it collects

Hostname, logged-in user, idle minutes (Win32 `GetLastInputInfo`), uptime,
battery % and charging state, free disk, CPU %, RAM %, public IP (for
city-level location). No keystrokes, no browsing history, no file contents.

## Manage

- **Run once manually (test):**
  ```powershell
  .\asset-agent.ps1 -Token <DEVICE_TOKEN> -Server https://your-app.example.com
  ```
- **Uninstall:**
  ```powershell
  Unregister-ScheduledTask -TaskName "AssetMonitoringAgent" -Confirm:$false
  ```
- **Rotate token:** re-enroll in the dashboard (issues a new token), then
  re-run `install-agent.ps1` with the new token.

## Notes

- A local administrator can stop or remove the task — this agent is for
  monitoring company devices held by cooperating employees, not theft recovery.
- Reinstall after an OS wipe.
- Mac/Android agents are separate (macOS uses the same approach; the Android
  agent lives in `../android-agent/` — see its README).
