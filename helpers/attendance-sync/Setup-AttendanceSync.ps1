param([switch]$InstallAtLogon,[switch]$UpdatePairing,[ValidateRange(1,24)][int]$SyncEveryHours=6)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'AttendanceSync.Common.ps1')
$server=Read-Host 'FooDo URL (https://fodo.am-agent2026.workers.dev)'
$deviceId=[Guid]::Parse((Read-Host 'Existing device ID from FooDo'))
$address=Read-Host 'K14 LAN IP (192.168.123.201)'
$token=Read-Host 'Pairing token (blank keeps saved token when updating)' -AsSecureString
$key=Read-Host 'Communication key (0 if none; blank keeps saved key when updating)' -AsSecureString
Copy-FodoSyncFiles $PSScriptRoot
$path=Save-FodoSyncConfig -Server $server -DeviceId $deviceId -Address $address -Token $token -CommKey $key -SyncEveryHours $SyncEveryHours -UpdatePairing:$UpdatePairing
if($InstallAtLogon){Install-FodoSyncSchedule -ConfigPath $path -SyncEveryHours $SyncEveryHours;Write-Host ('Enabled at Windows sign-in and every '+$SyncEveryHours+' hours while signed in.')}
Write-Host ('Configuration saved: '+$path)
Write-Host 'Open Open-FooDo.cmd for the Sync now button. The computer must be on, signed in, and connected to the K14 LAN and internet.'
