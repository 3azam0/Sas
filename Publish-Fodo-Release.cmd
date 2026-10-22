@echo off
cd /d "%~dp0"
echo Publishing the committed Fodo release branch and its draft pull request.
echo Complete normal GitHub sign-in if prompted. No merge or deployment is performed.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-cloud-release.ps1"
pause
