@echo off
setlocal
title FooDo K14 Pro Direct Cable Diagnostic
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-K14-DirectCable.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo Direct cable diagnostic completed successfully.
) else (
  echo Diagnostic stopped with code %RESULT%. Read K14-diagnostic-result.json.
)
pause
exit /b %RESULT%
