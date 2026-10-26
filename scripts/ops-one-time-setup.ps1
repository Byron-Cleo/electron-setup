# One-time elevated setup for remote ops.
#
# Run from an ELEVATED PowerShell (Run as administrator) on the server:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops-one-time-setup.ps1
#
# What it does:
#   1. Grants the `ops` account Modify on this repo (so SSH deploys can write).
#   2. Scopes the built-in OpenSSH firewall rule to Tailscale + LAN + localhost.
#   3. Prints the restart-bridge status and the remaining manual steps.
#
# It does NOT restart the backend or PostgreSQL.

[CmdletBinding()]
param(
  [string]$RepoRoot,
  [string]$OpsUser = 'ops',
  [switch]$SkipFirewall
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "This script must run from an elevated PowerShell (Run as administrator)." -ForegroundColor Red
  exit 1
}

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
$repo = if ($RepoRoot) { (Resolve-Path $RepoRoot).Path } else { (Resolve-Path (Join-Path $scriptDir '..')).Path }
Write-Host "Repo: $repo"
Write-Host "Granting '$OpsUser' Modify on the repo..."
& icacls $repo /grant "${OpsUser}:(OI)(CI)M" /T
if ($LASTEXITCODE -ne 0) {
  throw "icacls failed (exit $LASTEXITCODE)."
}

if (-not $SkipFirewall) {
  Write-Host "Scoping SSH (port 22) to Tailscale + LAN + localhost..."
  & netsh advfirewall firewall set rule name="OpenSSH SSH Server (sshd)" new remoteip=100.64.0.0/10,192.168.100.0/24,127.0.0.1/32
  if ($LASTEXITCODE -ne 0) {
    throw "netsh failed (exit $LASTEXITCODE)."
  }
}

Write-Host ""
Write-Host "Current SSH rule scope:" -ForegroundColor Cyan
Get-NetFirewallRule -DisplayName 'OpenSSH SSH Server (sshd)' |
  Get-NetFirewallAddressFilter | Select-Object RemoteAddress | Format-List

Write-Host "Restart bridge status:" -ForegroundColor Cyan
& schtasks /query /tn pos-backend-restart /fo LIST

Write-Host ""
Write-Host "Done. Next, as 'ops' over SSH:" -ForegroundColor Green
Write-Host "  git config --global --add safe.directory $($repo -replace '\\', '/')"
Write-Host "  cd /d $repo"
Write-Host "  git pull --ff-only origin restaurant-build"
Write-Host "  schtasks /run /tn pos-backend-restart"
Write-Host ""
Write-Host "Create the read-only DB role when ready:" -ForegroundColor Green
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops-create-analyst.ps1"
