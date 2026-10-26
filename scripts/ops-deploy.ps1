# Deploy production from the restaurant-build branch over SSH.
#
# IMPORTANT: this script restarts EraevaBackend, so the API is briefly
# unavailable (~5-15 seconds). Run it when it is safe to do so.
#
# Prerequisites (one-time): run scripts\ops-one-time-setup.ps1 elevated so the
# `ops` account can write the repo and run the pos-backend-restart task.
#
# Usage:
#   npm run ops:deploy
#   npm run ops:deploy -- -SkipWeb
#   npm run ops:deploy -- -SyncDb
#   npm run ops:deploy -- -SkipPull -SkipWeb
#   npm run ops:deploy -- -AllowDirty

[CmdletBinding()]
param(
  [switch]$SkipPull,
  [switch]$SkipWeb,
  [switch]$SyncDb,
  [switch]$AllowDirty,
  [string]$Branch = 'restaurant-build',
  [int]$HealthTimeoutSec = 60
)

$ErrorActionPreference = 'Stop'
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
$repo = (Resolve-Path (Join-Path $scriptDir '..')).Path
$logDir = Join-Path $repo 'backend\logs'
$logFile = Join-Path $logDir 'deploy.log'
$healthUrl = 'http://127.0.0.1:3001/health'
$taskName = 'pos-backend-restart'

function Write-Log([string]$message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

function Invoke-Step([string]$label, [scriptblock]$action) {
  Write-Log "==> $label"
  $global:LASTEXITCODE = 0
  & $action
  if ($LASTEXITCODE -ne 0) {
    throw "$label failed (exit $LASTEXITCODE)"
  }
}

Set-Location $repo
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$branchNow = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branchNow -ne $Branch) {
  throw "Refusing to deploy: on branch '$branchNow', expected '$Branch'."
}

$dirty = @(git status --porcelain)
if ($dirty.Count -gt 0 -and -not $AllowDirty) {
  throw "Refusing to deploy: working tree is dirty. Commit/stash first, or pass -AllowDirty."
}

$before = (git rev-parse --short HEAD).Trim()
Write-Log "Deploy start: branch=$branchNow commit=$before"

if (-not $SkipPull) {
  Invoke-Step 'git pull --ff-only' { git pull --ff-only origin $Branch }
  $afterPull = (git rev-parse --short HEAD).Trim()
  Write-Log "Pulled to commit $afterPull"
} else {
  Write-Log 'Skipping git pull (-SkipPull)'
}

if ($SyncDb) {
  Invoke-Step 'db:sync (generate + push)' { npm run db:sync }
} else {
  Write-Log 'Skipping db:sync (pass -SyncDb when schema.prisma changed)'
}

Invoke-Step 'backend build' { npm run build --prefix backend }

if (-not $SkipWeb) {
  Invoke-Step 'web build (same-origin)' { npm run build:web -- --server same-origin }
} else {
  Write-Log 'Skipping web build (-SkipWeb)'
}

Write-Log "Triggering restart bridge: $taskName"
& schtasks /run /tn $taskName | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Could not trigger $taskName (exit $LASTEXITCODE). Check task permissions."
}

Write-Log "Waiting up to $HealthTimeoutSec s for $healthUrl ..."
$deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
$healthy = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    if ($health.status -eq 'ok') {
      $healthy = $true
      break
    }
  } catch {
    # service is still starting
  }
}

if (-not $healthy) {
  Write-Log "Health check FAILED after $HealthTimeoutSec s."
  $serviceLog = Join-Path $logDir 'backend-service.log'
  if (Test-Path $serviceLog) {
    Get-Content $serviceLog -Tail 30 | ForEach-Object { Write-Log "  $_" }
  }
  throw "Deploy failed: $healthUrl did not become healthy."
}

$after = (git rev-parse --short HEAD).Trim()
Write-Log "Deploy OK: $before -> $after; health=ok"
Write-Log "Rollback if needed: git reset --hard $before; npm run build --prefix backend; npm run ops:deploy -- -SkipPull -SkipWeb"
