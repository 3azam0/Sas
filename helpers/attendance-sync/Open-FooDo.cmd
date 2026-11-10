@echo off
if exist "%~dp0FooDoAttendance.exe" (
  start "" "%~dp0FooDoAttendance.exe"
  exit /b 0
)
start "" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0FooDo-Attendance.ps1"
