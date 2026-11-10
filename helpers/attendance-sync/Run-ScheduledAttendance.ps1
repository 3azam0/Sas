param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
$logPath=Join-Path $PSScriptRoot 'attendance-sync.log'
if((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 5MB){Move-Item -LiteralPath $logPath -Destination ($logPath+'.previous') -Force}
& (Join-Path $PSScriptRoot 'Sync-K14Attendance.ps1') -ConfigPath $ConfigPath -Once *>> $logPath
