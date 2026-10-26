# Create or rotate the read-only DB role used by DBeaver and snapshots.
#
# Run interactively on the server (over SSH with `ssh -t`, or in an RDP session):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops-create-analyst.ps1
#
# It reads the superuser connection from backend\.env (DATABASE_URL) and never
# prints it. You are prompted for the new analyst password.
#
# If run as `ops`, it also adds a pgpass entry so psql/pg_dump work without prompts.

[CmdletBinding()]
param(
  [string]$RepoRoot,
  [string]$RoleName = 'era_analyst',
  [string]$Database = 'eraevadb'
)

$ErrorActionPreference = 'Stop'
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
$repo = if ($RepoRoot) { (Resolve-Path $RepoRoot).Path } else { (Resolve-Path (Join-Path $scriptDir '..')).Path }
$envFile = Join-Path $repo 'backend\.env'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

if (-not (Test-Path $psql)) { throw "psql not found at $psql" }
if (-not (Test-Path $envFile)) { throw "backend\.env not found at $envFile" }

$dbUrlLine = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $dbUrlLine) { throw "DATABASE_URL not found in backend\.env" }

$dbUrl = ($dbUrlLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
$uri = [Uri]$dbUrl
$userInfo = $uri.UserInfo -split ':', 2
$superUser = [Uri]::UnescapeDataString($userInfo[0])
$superPass = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
if (-not $superUser -or -not $superPass) {
  throw "DATABASE_URL must contain a username and password."
}

$secure = Read-Host "New password for $RoleName" -AsSecureString
$secure2 = Read-Host "Confirm password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$bstr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure2)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $plain2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr2)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)
}

if ($plain -ne $plain2) { throw "Passwords do not match." }
if ($plain.Length -lt 16) { throw "Use at least 16 characters." }

$escaped = $plain.Replace("'", "''")
$env:PGPASSWORD = $superPass

try {
  $exists = & $psql -h 127.0.0.1 -U $superUser -d $Database -tAc "select 1 from pg_roles where rolname = '$RoleName';" 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Could not connect as $superUser (exit $LASTEXITCODE)." }

  if ($exists.ToString().Trim() -eq '1') {
    $sql = "ALTER ROLE $RoleName WITH LOGIN PASSWORD '$escaped';"
    Write-Host "Role '$RoleName' exists - rotating its password."
  } else {
    $sql = "CREATE ROLE $RoleName WITH LOGIN PASSWORD '$escaped';"
    Write-Host "Creating role '$RoleName'."
  }

  $grants = @(
    "GRANT CONNECT ON DATABASE $Database TO $RoleName;",
    "GRANT pg_read_all_data TO $RoleName;",
    "GRANT pg_monitor TO $RoleName;",
    "ALTER ROLE $RoleName SET default_transaction_read_only = on;",
    "ALTER ROLE $RoleName SET statement_timeout = '60s';",
    "ALTER ROLE $RoleName SET idle_in_transaction_session_timeout = '5min';"
  ) -join "`n"

  $sql + "`n" + $grants | & $psql -h 127.0.0.1 -U $superUser -d $Database -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Role setup failed (exit $LASTEXITCODE)." }

  Write-Host "Role '$RoleName' is ready." -ForegroundColor Green
  Write-Host "DBeaver: host 127.0.0.1, port 5433, db $Database, user $RoleName (use the password you just entered)."

  if ($env:USERNAME -eq 'ops') {
    $pgpassDir = Join-Path $env:APPDATA 'postgresql'
    $pgpassFile = Join-Path $pgpassDir 'pgpass.conf'
    New-Item -ItemType Directory -Force -Path $pgpassDir | Out-Null
    $entry = "127.0.0.1:5432:${Database}:${RoleName}:$plain"
    $kept = @()
    if (Test-Path $pgpassFile) {
      $kept = Get-Content $pgpassFile | Where-Object { $_ -notmatch ":${Database}:${RoleName}:" }
    }
    Set-Content -Path $pgpassFile -Value (@($kept) + $entry) -Encoding ASCII
    Write-Host "Updated $pgpassFile."
  } else {
    Write-Host ""
    Write-Host "Server-side pgpass for ops (run as ops):" -ForegroundColor Cyan
    Write-Host "  %APPDATA%\postgresql\pgpass.conf  ->  127.0.0.1:5432:${Database}:${RoleName}:<password>"
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $plain = $null
  $plain2 = $null
}
