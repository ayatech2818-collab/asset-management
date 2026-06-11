# Installs the Asset Monitoring Agent as a Windows Scheduled Task.
# Runs at startup and every 5 minutes, as SYSTEM, hidden.
# MUST be run from an elevated (Administrator) PowerShell.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\install-agent.ps1 `
#       -Token <device_token> -Server https://your-app
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Server
)

$ErrorActionPreference = "Stop"
$taskName = "AssetMonitoringAgent"
$dir = Join-Path $env:ProgramData "AssetAgent"

# Copy the agent script to a stable location.
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot "asset-agent.ps1") `
  -Destination (Join-Path $dir "asset-agent.ps1") -Force

$agentPath = Join-Path $dir "asset-agent.ps1"
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$agentPath`" -Token $Token -Server $Server"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments

# Trigger: at startup, plus every 5 minutes for 10 years.
# ([TimeSpan]::MaxValue is rejected by the Task Scheduler XML schema.)
$atStartup = New-ScheduledTaskTrigger -AtStartup
$repeating = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action `
  -Trigger @($atStartup, $repeating) -Principal $principal -Settings $settings -Force | Out-Null

# Fire one heartbeat immediately so the device shows up right away.
Start-ScheduledTask -TaskName $taskName

Write-Output "Installed '$taskName'. The device will report every 5 minutes."
Write-Output "To remove: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
