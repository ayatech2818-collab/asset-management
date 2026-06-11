# Asset Monitoring Agent (Windows, PowerShell)
# Collects one telemetry snapshot and POSTs it to the asset management server.
# Run repeatedly by a Scheduled Task (see install-agent.ps1).
#
# Usage: asset-agent.ps1 -Token <device_token> -Server https://your-app
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Server
)

$ErrorActionPreference = "SilentlyContinue"

# --- Idle time (seconds since last keyboard/mouse input) via Win32 API ---
$idleMinutes = $null
try {
  if (-not ([System.Management.Automation.PSTypeName]'Win32Idle').Type) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Idle {
  [StructLayout(LayoutKind.Sequential)]
  struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [DllImport("kernel32.dll")] static extern uint GetTickCount();
  public static uint IdleSeconds() {
    LASTINPUTINFO lii = new LASTINPUTINFO();
    lii.cbSize = (uint)Marshal.SizeOf(lii);
    GetLastInputInfo(ref lii);
    return (GetTickCount() - lii.dwTime) / 1000;
  }
}
'@
  }
  $idleMinutes = [int]([Win32Idle]::IdleSeconds() / 60)
} catch {}

# --- Battery ---
$battery = $null; $charging = $null
try {
  $b = Get-CimInstance Win32_Battery -ErrorAction Stop | Select-Object -First 1
  if ($b) {
    $battery = [int]$b.EstimatedChargeRemaining
    $charging = ($b.BatteryStatus -eq 2)  # 2 = AC connected
  }
} catch {}

# --- Disk free (system drive), CPU, RAM, uptime ---
$diskFree = $null; $cpu = $null; $ram = $null; $uptime = $null
try {
  $d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'"
  if ($d) { $diskFree = [math]::Round($d.FreeSpace / 1GB, 1) }
} catch {}
try {
  $cpu = [int]((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average)
} catch {}
try {
  $os = Get-CimInstance Win32_OperatingSystem
  if ($os) {
    $ram = [int]((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100)
    $uptime = [int](((Get-Date) - $os.LastBootUpTime).TotalMinutes)
  }
} catch {}

# --- Public IP (lets the server geolocate to city level) ---
$publicIp = $null
try { $publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5) } catch {}

# --- Build + send heartbeat ---
$payload = @{
  device_token   = $Token
  hostname       = $env:COMPUTERNAME
  logged_in_user = $env:USERNAME
  public_ip      = $publicIp
  idle_minutes   = $idleMinutes
  uptime_minutes = $uptime
  battery_pct    = $battery
  is_charging    = $charging
  disk_free_gb   = $diskFree
  cpu_pct        = $cpu
  ram_pct        = $ram
  agent_version  = "ps-1.0.0"
} | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Method Post -Uri "$Server/api/ingest" `
    -ContentType "application/json" -Body $payload -TimeoutSec 15
  Write-Output "Heartbeat sent: $($resp | ConvertTo-Json -Compress)"
} catch {
  Write-Output "Heartbeat failed: $($_.Exception.Message)"
  exit 1
}
