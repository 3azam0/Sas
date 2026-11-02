@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-AttendanceSync.ps1" -InstallAtLogon
pause
