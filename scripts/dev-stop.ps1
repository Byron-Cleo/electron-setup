#!/usr/bin/env pwsh
# Stops the dev-scope stack started by dev-start.ps1 (kills process trees).
$ErrorActionPreference = 'SilentlyContinue'
$root  = Split-Path -Parent $PSScriptRoot
$log   = Join-Path $root 'backend\logs'
foreach ($name in @('dev-backend', 'dev-ui')) {
  $pidFile = Join-Path $log "$name.pid"
  if (Test-Path $pidFile) {
    $procId = Get-Content $pidFile
    if ($procId) {
      taskkill /PID $procId /T /F | Out-Null
      Write-Output "$name stopped (pid $procId tree)"
    }
    Remove-Item $pidFile -Force
  } else {
    Write-Output "$name: no pid file (not running or never started)"
  }
}
Write-Output 'Dev scope stopped. Production service EraevaBackend was NOT touched.'