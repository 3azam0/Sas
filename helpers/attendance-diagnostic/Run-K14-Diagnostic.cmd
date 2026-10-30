@echo off
setlocal
title FooDo K14 Pro Diagnostic
set "PS32=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if exist "%PS32%" (
  "%PS32%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-K14Connection.ps1"
) else (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-K14Connection.ps1"
)
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo Diagnostic completed successfully.
) else (
  echo Diagnostic stopped with code %RESULT%. Read K14-diagnostic-result.json.
)
pause
exit /b %RESULT%
