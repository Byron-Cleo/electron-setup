@echo off
rem Restart bridge for the PRODUCTION backend (port 3001).
rem Runs as SYSTEM via the "pos-backend-restart" scheduled task so ops can
rem restart production over SSH without UAC. Never run directly unless elevated.
rem
rem Production runs as the pm2 process "eraeva-backend" (backend\dist\index.js,
rem NODE_ENV=production, .env -> eraevadb). The pm2 daemon lives in the
rem "User" account's PM2_HOME and is launched at boot by the "EraevaPOS-Backend"
rem scheduled task, so this bridge must target that same PM2_HOME.
rem
rem The old NSSM service "EraevaBackend" no longer exists on the box — calling
rem "sc stop/start EraevaBackend" silently did nothing while the old build kept
rem serving traffic, so the restart looked successful but never took effect.

setlocal
set "REPO=%~dp0.."
set "LOG=%REPO%\backend\logs\restart.log"
set "PM2_HOME=C:\Users\User\.pm2"
set "USERPROFILE=C:\Users\User"
set "PATH=C:\Windows\System32;C:\Windows;C:\Program Files\nodejs;C:\Users\User\AppData\Roaming\npm;%PATH%"
set "PM2=C:\Users\User\AppData\Roaming\npm\pm2.cmd"
set "NO_COLOR=1"

if not exist "%LOG%" mkdir "%REPO%\backend\logs" >nul 2>&1

echo [%date% %time%] restarting pm2 process eraeva-backend >> "%LOG%"
call "%PM2%" restart eraeva-backend >> "%LOG%" 2>&1

rem Give the new build a moment to bind the port before reporting. "ping" is
rem used instead of "timeout" because "timeout" refuses to run without a
rem console and aborts under some schtasks/SSH hosts.
ping -n 6 127.0.0.1 >nul 2>&1

echo [%date% %time%] health check >> "%LOG%"
curl -s http://127.0.0.1:3001/health >> "%LOG%" 2>&1
echo. >> "%LOG%"
rem "pm2 pid" prints a bare PID. "pm2 list" draws a box-drawing table that the
rem log file's OEM codepage renders as mojibake, so the PID is recorded plainly.
call "%PM2%" pid eraeva-backend >> "%LOG%" 2>&1
echo [%date% %time%] done >> "%LOG%"
endlocal
