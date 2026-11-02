param([switch]$InstallAtLogon,[switch]$UpdatePairing)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'FooDo\AttendanceSync'
New-Item -ItemType Directory -Force -Path $root | Out-Null
$server=[Uri](Read-Host 'FooDo URL (https://fodo.am-agent2026.workers.dev)')
if($server.Scheme -ne 'https' -or $server.UserInfo -or $server.Query -or $server.Fragment -or $server.AbsolutePath -ne '/') { throw 'Use the HTTPS origin only, with no path or credentials.' }
$deviceId=Read-Host 'Device ID from FooDo'
$parsed=[Guid]::Empty
if(-not [Guid]::TryParse($deviceId,[ref]$parsed)) { throw 'Invalid device ID.' }
$address=Read-Host 'K14 LAN IP (192.168.123.201)'
$ip=$null
if(-not [Net.IPAddress]::TryParse($address,[ref]$ip)) { throw 'Invalid device IP.' }
$token=Read-Host 'Pairing token from FooDo' -AsSecureString
$key=Read-Host 'Communication key (0 if none)' -AsSecureString
$config=[ordered]@{server=$server.GetLeftPart([UriPartial]::Authority);deviceId=$parsed.ToString();address=$address;port=4370;intervalSeconds=60;token=($token|ConvertFrom-SecureString);commKey=($key|ConvertFrom-SecureString)}
$path=Join-Path $root ($parsed.ToString()+'.json')
if((Test-Path -LiteralPath $path) -and -not $UpdatePairing) { throw 'Configuration already exists. Stop the agent and use -UpdatePairing to replace credentials without removing pending data.' }
if(Test-Path -LiteralPath $path) {
 $existing=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
 if($existing.server -ne $config.server) { throw 'Cannot change the server for an existing device configuration.' }
}
$config|ConvertTo-Json|Set-Content -LiteralPath $path -Encoding UTF8
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Sync-K14Attendance.ps1') -Destination $root -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-AttendanceSync.cmd') -Destination $root -Force
$powershell=Join-Path $env:WINDIR 'SysWOW64\WindowsPowerShell\v1.0\powershell.exe'
if(-not(Test-Path -LiteralPath $powershell)) { $powershell=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe' }
$arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $root 'Sync-K14Attendance.ps1')+'" -ConfigPath "'+$path+'"'
if($InstallAtLogon) {
 $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 $action=New-ScheduledTaskAction -Execute $powershell -Argument ('-WindowStyle Hidden '+$arguments)
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
 $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
 $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
 Register-ScheduledTask -TaskName ('FooDo-Attendance-'+$parsed.ToString()) -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
 Write-Host 'Installed for this Windows user at logon. The PC must remain on and connected to the device LAN.'
}
Write-Host ('Configuration: '+$path)
Write-Host ('Run once: & "'+$powershell+'" '+$arguments+' -Once')
Write-Host 'The token, communication key, queue and local progress use Windows DPAPI for this user. Do not copy the folder to another user or computer.'
