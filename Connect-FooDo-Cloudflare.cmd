@echo off
setlocal
title FooDo - Connect Cloudflare
cd /d "%~dp0"
if not exist "node_modules\wrangler\bin\wrangler.js" (
  echo Wrangler is missing. Ask the developer to restore project dependencies.
  pause
  exit /b 1
)
if not exist ".cache" mkdir ".cache"
set "WRANGLER_LOG_PATH=%~dp0.cache\wrangler-login.log"
set "XDG_CONFIG_HOME=%~dp0.cache\cloudflare-auth"
set "WRANGLER_SEND_METRICS=false"
set "FODO_CONNECT_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%FODO_CONNECT_NODE%" set "FODO_CONNECT_NODE=node"
echo Complete normal Cloudflare sign-in in the browser.
echo Use the existing account that owns the fodo worker.
echo This renews the local publishing login; it does not deploy or change your site.
echo Do not send a token or password in chat.
echo.
"%FODO_CONNECT_NODE%" node_modules\wrangler\bin\wrangler.js login
if errorlevel 1 (
  echo Cloudflare sign-in did not finish. Copy the error message, without credentials.
) else (
  echo Cloudflare sign-in finished. Return to the chat and say: connected
)
pause
endlocal
