# Create a compressed PostgreSQL snapshot using the read-only era_analyst role.
# Safe to run at any time (pg_dump only reads).
#
# Usage:
#   npm run ops:snapshot
#   npm run ops:snapshot -- -Keep 30
#
# Pull the dump to your laptop:
#   scp pos:"C:/Users/User/Desktop/pos/electron-setup/backend/backups/<file>" .

[CmdletBinding()]
param(
  [int]$Keep = 14,
  [string]$OutDir = 'backend\backups'
)

$ErrorActionPreference = 'Stop'
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
$repo = (Resolve-Path (Join-Path $scriptDir '..')).Path
$psqlDir = 'C:\Program Files\PostgreSQL\17\bin'
$pgDump = Join-Path $psqlDir 'pg_dump.exe'
$db = 'eraevadb'
$dbUser = 'era_analyst'
$dbHost = '127.0.0.1'

if (-not (Test-Path $pgDump)) {
  throw "pg_dump not found at $pgDump"
}

$outPath = Join-Path $repo $OutDir
New-Item -ItemType Directory -Force -Path $outPath | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $outPath "eraevadb-$stamp.dump"

$pgpass = Join-Path $env:APPDATA 'postgresql\pgpass.conf'
if (-not $env:PGPASSWORD -and -not (Test-Path $pgpass)) {
  throw "No password available. Create $pgpass for $dbUser or set PGPASSWORD."
}

Write-Host "Dumping $db as $dbUser -> $file"
& $pgDump -h $dbHost -U $dbUser -d $db -Fc -f $file
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed (exit $LASTEXITCODE)."
}

$sizeMb = [math]::Round((Get-Item $file).Length / 1MB, 2)
Write-Host "Snapshot OK: $file ($sizeMb MB)"

# Retention: keep the newest $Keep dumps.
Get-ChildItem -Path $outPath -Filter 'eraevadb-*.dump' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Keep |
  ForEach-Object {
    Write-Host "Removing old snapshot: $($_.Name)"
    Remove-Item $_.FullName -Force
  }
