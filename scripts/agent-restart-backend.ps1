# Agent helper to restart EraevaBackend via scheduled task (runs as SYSTEM)
# Triggers the pre-configured task directly - no UAC elevation needed if user has rights

param(
  [switch]$Wait = $true
)

$taskName = "pos-backend-restart"
$schTasks = "$env:WINDIR\System32\schtasks.exe"

Write-Host "[agent-restart] Triggering scheduled task: $taskName (as SYSTEM)"
& $schTasks /run /tn $taskName | Out-Null

if ($Wait) {
  Start-Sleep -Seconds 12
  Write-Host "[agent-restart] Service status:"
  & "$env:WINDIR\System32\sc.exe" query EraevaBackend | Select-String "STATE"
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 15
    Write-Host "[agent-restart] Health: $($health.status)"
  } catch {
    Write-Host "[agent-restart] Health check: starting up..."
  }
  Write-Host "[agent-restart] Logs: backend/logs/restart.log"
}
