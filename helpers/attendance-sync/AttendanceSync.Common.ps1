$ErrorActionPreference='Stop'
function Get-FodoSyncRoot { Join-Path $env:LOCALAPPDATA 'FooDo\AttendanceSync' }
function Get-FodoConfigPath([Guid]$DeviceId) { Join-Path (Get-FodoSyncRoot) ($DeviceId.ToString()+'.json') }
function ConvertFrom-FodoSecure([Security.SecureString]$Value) {
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
 try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
function Copy-FodoSyncFiles([string]$Source) {
 $root=Get-FodoSyncRoot
 New-Item -ItemType Directory -Path $root -Force|Out-Null
 foreach($name in @('AttendanceSync.Common.ps1','Sync-K14Attendance.ps1','Run-ScheduledAttendance.ps1','Start-AttendanceSync.cmd','FooDo-Attendance.ps1','Open-FooDo.cmd')) {
  $from=[IO.Path]::GetFullPath((Join-Path $Source $name));$to=[IO.Path]::GetFullPath((Join-Path $root $name))
  if($from -ne $to){Copy-Item -LiteralPath $from -Destination $to -Force}
 }
 $logo=Join-Path $Source 'foodo-logo.png'
 if(Test-Path -LiteralPath $logo){if([IO.Path]::GetFullPath($logo) -ne [IO.Path]::GetFullPath((Join-Path $root 'foodo-logo.png'))){Copy-Item -LiteralPath $logo -Destination $root -Force}}
 $desktopExe=Join-Path $Source 'FooDoAttendance.exe'
 if(-not(Test-Path -LiteralPath $desktopExe)){$desktopExe=Join-Path $Source '../../.cache/attendance-desktop/FooDoAttendance.exe'}
 if((Test-Path -LiteralPath $desktopExe) -and [IO.Path]::GetFullPath($desktopExe) -ne [IO.Path]::GetFullPath((Join-Path $root 'FooDoAttendance.exe'))){Copy-Item -LiteralPath $desktopExe -Destination $root -Force}
}
function Save-FodoSyncConfig {
 param([string]$Server,[Guid]$DeviceId,[string]$Address,[Security.SecureString]$Token,[Security.SecureString]$CommKey,[ValidateRange(1,24)][int]$SyncEveryHours=6,[switch]$UpdatePairing)
 $uri=$null
 if(-not [Uri]::TryCreate($Server,[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/'){throw 'Use the FooDo HTTPS origin only.'}
 $ip=$null
 if(-not [Net.IPAddress]::TryParse($Address,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Enter the K14 IPv4 address.'}
 $root=Get-FodoSyncRoot;$path=Get-FodoConfigPath $DeviceId
 New-Item -ItemType Directory -Path $root -Force|Out-Null
 $existing=$null
 if(Test-Path -LiteralPath $path){
  if(-not $UpdatePairing){throw 'A saved connection exists. Enable editing to update it.'}
  $existing=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
  if($existing.server.TrimEnd('/') -ne $uri.GetLeftPart([UriPartial]::Authority)){throw 'The server of a saved device cannot be changed.'}
 }
 $tokenCipher=if($existing){[string]$existing.token}else{''}
 if($Token -and $Token.Length){$plain=ConvertFrom-FodoSecure $Token;try{if($plain -notmatch '^fodo_hr_[a-f0-9]{64}$'){throw 'Use a valid pairing token from FooDo.'};$tokenCipher=ConvertFrom-SecureString $Token}finally{$plain=$null}}
 if(-not $tokenCipher){throw 'Enter the pairing token from FooDo.'}
 $keyCipher=if($existing){[string]$existing.commKey}else{''}
 if($CommKey -and $CommKey.Length){$plain=ConvertFrom-FodoSecure $CommKey;try{if($plain -notmatch '^\d{1,9}$'){throw 'Communication key must be a number (0 if none).'};$keyCipher=ConvertFrom-SecureString $CommKey}finally{$plain=$null}}
 if(-not $keyCipher){throw 'Enter the device communication key (0 if none).'}
 $deviceRoot=Join-Path $root $DeviceId.ToString();New-Item -ItemType Directory -Path $deviceRoot -Force|Out-Null
 $lock=$null
 try {
  try{$lock=[IO.File]::Open((Join-Path $deviceRoot 'agent.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'A sync is running. Wait for it to finish before saving.'}
  $config=[ordered]@{server=$uri.GetLeftPart([UriPartial]::Authority);deviceId=$DeviceId.ToString();address=$ip.ToString();port=4370;intervalSeconds=60;syncEveryHours=$SyncEveryHours;token=$tokenCipher;commKey=$keyCipher}
  $temp=$path+'.new';[IO.File]::WriteAllText($temp,($config|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
  if($existing){$backupRoot=Join-Path $root 'saved-config';New-Item -ItemType Directory -Path $backupRoot -Force|Out-Null;$backup=Join-Path $backupRoot ($DeviceId.ToString()+'-'+[DateTime]::Now.ToString('yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N')+'.json');[IO.File]::Replace($temp,$path,$backup)}else{[IO.File]::Move($temp,$path)}
 }finally{if($lock){$lock.Dispose()}}
 return $path
}
function Install-FodoSyncSchedule {
 param([Parameter(Mandatory=$true)][string]$ConfigPath,[ValidateRange(1,24)][int]$SyncEveryHours=6)
 $config=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json
 $id=[Guid]::Parse($config.deviceId).ToString();$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 $powershell=Join-Path $env:WINDIR 'SysWOW64\WindowsPowerShell\v1.0\powershell.exe'
 if(-not(Test-Path -LiteralPath $powershell)){$powershell=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'}
 $runner=Join-Path (Get-FodoSyncRoot) 'Run-ScheduledAttendance.ps1'
 $action=New-ScheduledTaskAction -Execute $powershell -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$runner+'" -ConfigPath "'+[IO.Path]::GetFullPath($ConfigPath)+'"')
 $login=New-ScheduledTaskTrigger -AtLogOn -User $user
 $repeat=New-ScheduledTaskTrigger -Once -At ([DateTime]::Now.AddHours($SyncEveryHours)) -RepetitionInterval ([TimeSpan]::FromHours($SyncEveryHours))
 $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::FromMinutes(10)) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
 Register-ScheduledTask -TaskName ('FooDo-Attendance-'+$id) -Action $action -Trigger @($login,$repeat) -Settings $settings -Principal $principal -Force|Out-Null
}
