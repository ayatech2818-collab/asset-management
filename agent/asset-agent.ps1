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

# --- Tier 1 device facts (inventory + security posture) ---
$serial = $null; $manufacturer = $null; $model = $null
$osName = $null; $osVersion = $null; $totalRam = $null; $totalDisk = $null
$mac = $null; $ssid = $null; $localIp = $null; $diskEnc = $null; $antivirus = $null
try {
  $bios = Get-CimInstance Win32_BIOS -ErrorAction Stop
  if ($bios) { $serial = $bios.SerialNumber }
} catch {}
try {
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
  if ($cs) {
    $manufacturer = $cs.Manufacturer
    $model = $cs.Model
    $totalRam = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
  }
} catch {}
try {
  if ($os) {
    $osName = $os.Caption                       # e.g. "Microsoft Windows 11 Home"
    $osVersion = "$($os.Version) (build $($os.BuildNumber))"
  }
} catch {}
try {
  $sysDisk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'"
  if ($sysDisk) { $totalDisk = [math]::Round($sysDisk.Size / 1GB, 1) }
} catch {}
try {
  # Active adapter: first with a default gateway.
  $cfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" |
    Where-Object { $_.DefaultIPGateway } | Select-Object -First 1
  if ($cfg) {
    $mac = $cfg.MACAddress
    $localIp = ($cfg.IPAddress | Where-Object { $_ -notmatch ':' } | Select-Object -First 1)
  }
} catch {}
try {
  $wifi = (netsh wlan show interfaces) 2>$null | Select-String '^\s*SSID\s*:\s*(.+)$'
  if ($wifi) { $ssid = $wifi.Matches[0].Groups[1].Value.Trim() }
} catch {}
try {
  # BitLocker on the system drive (needs admin; SYSTEM scheduled task has it).
  $bl = Get-CimInstance -Namespace "Root\cimv2\Security\MicrosoftVolumeEncryption" `
    -ClassName Win32_EncryptableVolume -ErrorAction Stop |
    Where-Object { $_.DriveLetter -eq $env:SystemDrive }
  if ($bl) { $diskEnc = ($bl.GetConversionStatus().ConversionStatus -eq 1) }
} catch {}
try {
  $av = Get-CimInstance -Namespace "Root\SecurityCenter2" -ClassName AntiVirusProduct -ErrorAction Stop |
    Select-Object -First 1
  if ($av) { $antivirus = $av.displayName }
} catch {}

# --- Public IP (lets the server geolocate to city level) ---
$publicIp = $null
try { $publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5) } catch {}

# --- Precise location via the Windows Location service (Wi-Fi positioning,
#     typically 30-150 m). Needs Settings > Privacy > Location ON, including
#     "Let desktop apps access your location". Falls back silently to
#     server-side IP geolocation when unavailable. ---
$lat = $null; $lng = $null; $locAcc = $null
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
  $null = [Windows.Devices.Geolocation.Geolocator, Windows.Devices.Geolocation, ContentType = WindowsRuntime]
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
                   $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
    Select-Object -First 1
  $geo = New-Object Windows.Devices.Geolocation.Geolocator
  $geo.DesiredAccuracy = [Windows.Devices.Geolocation.PositionAccuracy]::High
  $task = $asTask.MakeGenericMethod([Windows.Devices.Geolocation.Geoposition]).Invoke($null, @($geo.GetGeopositionAsync()))
  if ($task.Wait(20000) -and $task.Result) {
    $pos = $task.Result.Coordinate
    $lat = [math]::Round($pos.Point.Position.Latitude, 6)
    $lng = [math]::Round($pos.Point.Position.Longitude, 6)
    $locAcc = [int]$pos.Accuracy
  }
} catch {}

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
  serial_number  = $serial
  manufacturer   = $manufacturer
  model          = $model
  os_name        = $osName
  os_version     = $osVersion
  total_ram_gb   = $totalRam
  total_disk_gb  = $totalDisk
  mac_address    = $mac
  wifi_ssid      = $ssid
  local_ip       = $localIp
  disk_encrypted = $diskEnc
  antivirus      = $antivirus
  agent_version  = "ps-1.2.0"
}
if ($lat -ne $null) {
  $payload.lat = $lat
  $payload.lng = $lng
  $payload.loc_accuracy_m = $locAcc
  $payload.loc_source = "wifi"
}
$payload = $payload | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Method Post -Uri "$Server/api/ingest" `
    -ContentType "application/json" -Body $payload -TimeoutSec 15
  Write-Output "Heartbeat sent: $($resp | ConvertTo-Json -Compress)"
} catch {
  Write-Output "Heartbeat failed: $($_.Exception.Message)"
  exit 1
}
