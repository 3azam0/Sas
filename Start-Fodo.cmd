@echo off
setlocal
title Fodo Launcher v2 - Stable Local Address
echo FODO LAUNCHER V2 - STABLE LOCAL ADDRESS
echo.
set "FODO_PROJECT=%~dp0"
if not exist "%FODO_PROJECT%\scripts\start-local.mjs" (
  echo Project files not found at %FODO_PROJECT%
  pause
  exit /b 1
)
cd /d "%FODO_PROJECT%"
set "FODO_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%FODO_NODE%" set "FODO_NODE=node"
echo Keep this window open. The launcher reuses the saved local address and existing Fodo process.
"%FODO_NODE%" scripts\start-local.mjs
if errorlevel 1 pause
endlocal
