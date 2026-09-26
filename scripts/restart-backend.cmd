@echo off
rem Elevated restart bridge for the EraevaBackend production service.
rem Runs as SYSTEM via the "pos-backend-restart" scheduled task so ops can
rem restart production over SSH without UAC. Never run directly unless elevated.
echo [%date% %time%] stop >> "%~dp0..\backend\logs\restart.log"
sc stop EraevaBackend >nul 2>&1
timeout /t 3 /nobreak >nul 2>&1
echo [%date% %time%] start >> "%~dp0..\backend\logs\restart.log"
sc start EraevaBackend >nul 2>&1
echo [%date% %time%] done >> "%~dp0..\backend\logs\restart.log"
sc query EraevaBackend | findstr /C:STATE >> "%~dp0..\backend\logs\restart.log"