#!/usr/bin/env pwsh
# Starts the dev-scope stack (backend + Vite UI) detached from the SSH console.
# Logs land in backend\logs\. Read them with tail -f or Get-Content -Wait.
# Usage over SSH: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-start.ps1
$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $PSScriptRoot
$log   = Join-Path $root 'backend\logs'
$backend = Join-Path $root 'backend'
New-Item -ItemType Directory -Force -Path $log | Out-Null

function Start-Detached {
  param([string]$Name, [string]$WorkingDir, [string]$Command)
  $out = Join-Path $log "$Name.log"
  $err = Join-Path $log "$Name.err.log"
  $pidFile = Join-Path $log "$Name.pid"
  $arg = "/c $Command > `"$out`" 2> `"$err`""
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList $arg -WorkingDirectory $WorkingDir -WindowStyle Hidden -PassThru
  $p.Id | Out-File -FilePath $pidFile -Encoding ascii
  Write-Output "$Name started (pid $($p.Id)) -> $out"
}

Start-Detached -Name 'dev-backend' -WorkingDir $backend -Command 'npm run dev'
Start-Detached -Name 'dev-ui'     -WorkingDir $root    -Command 'npm run dev:react'
Write-Output 'Dev scope started. Ports: backend 3111 (127.0.0.1), UI 5123 (127.0.0.1).'