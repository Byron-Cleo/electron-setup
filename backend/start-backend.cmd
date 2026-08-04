@echo off
cd /d "C:\Users\User\Desktop\pos\electron-setup\backend"
if not exist "C:\Users\User\Desktop\pos\electron-setup\backend\logs" mkdir "C:\Users\User\Desktop\pos\electron-setup\backend\logs"
node dist\index.js >> "C:\Users\User\Desktop\pos\electron-setup\backend\logs\backend.log" 2>&1
