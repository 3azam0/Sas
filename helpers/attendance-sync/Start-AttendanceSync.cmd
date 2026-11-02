@echo off
set "PS=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if "%~1"=="" (
  echo Drag the device configuration JSON file onto this launcher.
  pause
  exit /b 2
)
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sync-K14Attendance.ps1" -ConfigPath "%~1"
pause
