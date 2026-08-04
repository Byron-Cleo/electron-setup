@echo off
rem === Eraeva POS backend auto-start ===
rem Runs at Windows logon to keep the API server up for network terminals.
rem Edit BACKEND_DIR if the repo moves.

set "BACKEND_DIR=C:\Users\User\Desktop\pos\electron-setup\backend"

cd /d "%BACKEND_DIR%"
if not exist "logs" mkdir "logs"

start "Eraeva Backend Server" /min cmd /c "node_modules\.bin\tsx.cmd index.ts > logs\backend.log 2>&1"
exit /b 0
