# Read-only production status summary for remote ops.
# Safe to run at any time: reads service state, /health, disk/RAM, DB size,
# active sessions, and recent backend errors. Makes no changes.
#
# Usage:
#   npm run ops:status
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops-status.ps1

[CmdletBinding()]
param(
  [string]$RepoRoot
)

$ErrorActionPreference = 'Continue'
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
$repo = if ($RepoRoot) { (Resolve-Path $RepoRoot).Path } else { (Resolve-Path (Join-Path $scriptDir '..')).Path }
$healthUrl = 'http://127.0.0.1:3001/health'
$psql = if ($env:PSQL) { $env:PSQL } else { 'C:\Program Files\PostgreSQL\17\bin\psql.exe' }
$serviceNames = @('EraevaBackend', 'postgresql-x64-17', 'sshd', 'Tailscale')

function Write-Section([string]$title) {
  Write-Host ""
  Write-Host "== $title ==" -ForegroundColor Cyan
}

Write-Host "Eraeva POS - production status ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Green
Write-Host "Host: $env:COMPUTERNAME"

Write-Section 'Services'
foreach ($name in $serviceNames) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($null -eq $svc) {
    Write-Host ("  {0,-22} {1}" -f $name, 'NOT INSTALLED') -ForegroundColor Yellow
  } else {
    $color = if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' }
    Write-Host ("  {0,-22} {1}" -f $name, $svc.Status) -ForegroundColor $color
  }
}

Write-Section 'Health'
try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
  Write-Host "  $healthUrl -> $($health.status) ($($health.timestamp))" -ForegroundColor Green
  $healthy = $true
} catch {
  Write-Host "  $healthUrl -> UNREACHABLE ($($_.Exception.Message))" -ForegroundColor Red
  $healthy = $false
}

Write-Section 'System'
try {
  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction Stop
  $freeGb = [math]::Round($disk.FreeSpace / 1GB, 1)
  $totalGb = [math]::Round($disk.Size / 1GB, 1)
  Write-Host ("  Disk C: {0} GB free / {1} GB total" -f $freeGb, $totalGb)
} catch {
  Write-Host "  Disk: unavailable" -ForegroundColor Yellow
}

try {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $freeMb = [math]::Round($os.FreePhysicalMemory / 1KB, 0)
  $totalMb = [math]::Round($os.TotalVisibleMemorySize / 1KB, 0)
  Write-Host ("  RAM: {0} MB free / {1} MB total" -f $freeMb, $totalMb)
  $uptime = (Get-Date) - $os.LastBootUpTime
  Write-Host ("  Uptime: {0}d {1}h {2}m" -f $uptime.Days, $uptime.Hours, $uptime.Minutes)
} catch {
  Write-Host "  RAM/uptime: unavailable" -ForegroundColor Yellow
}

Write-Section 'Database'
$pgpass = Join-Path $env:APPDATA 'postgresql\pgpass.conf'
if (-not (Test-Path $psql)) {
  Write-Host "  psql not found at $psql" -ForegroundColor Yellow
} elseif (-not (Test-Path $pgpass)) {
  Write-Host "  Skipped: no pgpass for era_analyst ($pgpass)" -ForegroundColor Yellow
} else {
  $dbSize = & $psql -h 127.0.0.1 -U era_analyst -d eraevadb -tAc "select pg_size_pretty(pg_database_size('eraevadb'));" 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  Size: $("$dbSize".Trim())"
    $sessions = & $psql -h 127.0.0.1 -U era_analyst -d eraevadb -tAc "select state || ': ' || count(*) from pg_stat_activity where datname = 'eraevadb' group by state order by state;" 2>$null
    if ($LASTEXITCODE -eq 0) {
      $sessions | Where-Object { $_ } | ForEach-Object { Write-Host "  Sessions: $($_.ToString().Trim())" }
    }
  } else {
    Write-Host "  DB query failed (check era_analyst / pgpass)" -ForegroundColor Yellow
  }
}

Write-Section 'Recent backend errors'
$log = Join-Path $repo 'backend\logs\backend-service.log'
if (Test-Path $log) {
  $errorLines = Get-Content $log -Tail 80 | Select-String -Pattern 'ERROR|error:|FATAL|failed|Unhandled|unhandled' | Select-Object -Last 5
  if ($errorLines) {
    $errorLines | ForEach-Object { Write-Host "  $($_.Line.Trim())" }
    if (($errorLines | Out-String) -match '57P03') {
      Write-Host "  note: 57P03 = PostgreSQL was still starting; health above is authoritative." -ForegroundColor DarkYellow
    }
  } else {
    Write-Host "  none in last 80 lines" -ForegroundColor Green
  }
} else {
  Write-Host "  $log not found" -ForegroundColor Yellow
}

Write-Section 'Last restarts'
$restartLog = Join-Path $repo 'backend\logs\restart.log'
if (Test-Path $restartLog) {
  $lines = Get-Content $restartLog -Tail 20 -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\[|^\s*STATE:' } | Select-Object -Last 6
  if ($lines) { $lines | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  no entries" -ForegroundColor Yellow }
} else {
  Write-Host "  no restart.log yet" -ForegroundColor Yellow
}

if (-not $healthy) { exit 1 }
exit 0
