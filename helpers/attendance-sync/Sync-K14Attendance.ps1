param([Parameter(Mandatory=$true)][string]$ConfigPath,[switch]$Once)
$ErrorActionPreference='Stop'
if([IntPtr]::Size -ne 4) { throw 'Run with 32-bit Windows PowerShell and the registered ZKTeco SDK.' }
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$config=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json
$server=[Uri]$config.server
if($server.Scheme -ne 'https' -or $server.UserInfo -or $server.Query -or $server.Fragment -or $server.AbsolutePath -ne '/') { throw 'Invalid HTTPS server origin.' }
$deviceId=[Guid]::Parse($config.deviceId).ToString()
$interval=[int]$config.intervalSeconds
if($interval -lt 30 -or $interval -gt 3600) { throw 'Interval must be 30-3600 seconds.' }
$root=Join-Path (Split-Path -Parent ([IO.Path]::GetFullPath($ConfigPath))) $deviceId
New-Item -ItemType Directory -Force -Path $root|Out-Null
$lock=$null
try { $lock=[IO.File]::Open((Join-Path $root 'agent.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) } catch { throw 'This device sync is already running.' }
$queuePath=Join-Path $root 'pending.dpapi'
$statePath=Join-Path $root 'progress.dpapi'
function Unprotect-Text([string]$value) {
 $secure=ConvertTo-SecureString $value
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Read-Private([string]$path) { if(Test-Path -LiteralPath $path) { (Unprotect-Text (Get-Content -LiteralPath $path -Raw))|ConvertFrom-Json } }
function Write-Private([string]$path,$value) {
 $json=ConvertTo-Json -InputObject $value -Depth 10 -Compress
 $cipher=ConvertFrom-SecureString (ConvertTo-SecureString $json -AsPlainText -Force)
 $temp=$path+'.new'
 [IO.File]::WriteAllText($temp,$cipher,[Text.UTF8Encoding]::new($false))
 if(Test-Path -LiteralPath $path) { [IO.File]::Replace($temp,$path,[NullString]::Value) } else { [IO.File]::Move($temp,$path) }
}
function Hash-Key($value) {
 $sha=[Security.Cryptography.SHA256]::Create()
 try { ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $value -Compress))))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Assert-Badge([string]$badge) { if($badge -notmatch '^[A-Za-z0-9_-]{1,24}$') { throw 'Unsupported badge in device data. No records were cleared.' } }
$state=@{}
$saved=Read-Private $statePath
if($null -ne $saved) { foreach($p in $saved.PSObject.Properties) { $state[$p.Name]=$p.Value } }
$token=Unprotect-Text $config.token
if($token -notmatch '^fodo_hr_[a-f0-9]{64}$') { throw 'Invalid pairing token.' }
$commKey=[int](Unprotect-Text $config.commKey)
function Send-Pending {
 $pending=Read-Private $queuePath
 if($null -eq $pending) { return }
 $body=ConvertTo-Json -InputObject $pending.batch -Depth 10 -Compress
 $result=Invoke-RestMethod -Uri ($config.server.TrimEnd('/')+'/api/v1/attendance-sync') -Method Post -Headers @{Authorization=('Bearer '+$token)} -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 40 -MaximumRedirection 0
 if($result.outcome -ne 'accepted' -or $result.batchId -ne $pending.batch.batchId -or $result.deviceId -ne $deviceId -or [int]$result.received -ne @($pending.batch.punches).Count) { throw 'Upload was not confirmed. Saved batch will be retried unchanged.' }
 foreach($p in $pending.progress.PSObject.Properties) { $state[$p.Name]=$p.Value }
 Write-Private $statePath $state
 # Only a locally acknowledged encrypted batch is removed. Device logs are never cleared.
 Remove-Item -LiteralPath $queuePath
 Write-Host ('Accepted '+$result.received+' punches ('+$result.inserted+' new).')
}
function Read-Device {
 $sdk=$null
 try {
  $sdk=New-Object -ComObject 'zkemkeeper.ZKEM'
  if($commKey -ne 0 -and -not $sdk.SetCommPassword($commKey)) { throw 'Communication key rejected.' }
  if(-not $sdk.Connect_Net([string]$config.address,[int]$config.port)) { throw 'Cannot connect to K14. Check LAN, SDK, communication key and other attendance software.' }
  $users=[Collections.Generic.List[object]]::new();$punches=[Collections.Generic.List[object]]::new()
  $count=0
  if(-not $sdk.GetDeviceStatus(1,2,[ref]$count)) { throw 'Cannot read user count.' }
  if($count -gt 0) {
   if(-not $sdk.ReadAllUserID(1)) { throw 'Cannot read employee roster.' }
   $badge='';$name='';$password='';$privilege=0;$enabled=$false
   while($sdk.SSR_GetAllUserInfo(1,[ref]$badge,[ref]$name,[ref]$password,[ref]$privilege,[ref]$enabled)) {
    Assert-Badge $badge
    if($name.Length -gt 160) { throw 'Device name is too long.' }
    $users.Add([ordered]@{badge=$badge;name=$name.Trim()})
   }
   if($users.Count -lt $count) { throw 'Roster read is incomplete; retrying later.' }
  }
  $count=0
  if(-not $sdk.GetDeviceStatus(1,6,[ref]$count)) { throw 'Cannot read attendance count.' }
  if($count -gt 0) {
   if(-not $sdk.ReadGeneralLogData(1)) { throw 'Cannot read attendance log.' }
   $badge='';$verify=0;$mode=0;$year=0;$month=0;$day=0;$hour=0;$minute=0;$second=0;$work=0
   while($sdk.SSR_GetGeneralLogData(1,[ref]$badge,[ref]$verify,[ref]$mode,[ref]$year,[ref]$month,[ref]$day,[ref]$hour,[ref]$minute,[ref]$second,[ref]$work)) {
    Assert-Badge $badge
    $time=([DateTime]::new($year,$month,$day,$hour,$minute,$second)).ToString('yyyy-MM-ddTHH:mm:ss',[Globalization.CultureInfo]::InvariantCulture)
    $punches.Add([ordered]@{badge=$badge;localTime=$time;verifyMode=$verify;inOutMode=$mode;workCode=$work})
    if($punches.Count -gt 250000) { throw 'Attendance size exceeds this agent limit.' }
   }
   if($punches.Count -lt $count) { throw 'Attendance read is incomplete; retrying later.' }
  }
  return @{users=$users;punches=$punches}
 } finally { if($null -ne $sdk) { try{$sdk.Disconnect()}catch{};[Runtime.InteropServices.Marshal]::FinalReleaseComObject($sdk)|Out-Null } }
}
try {
 do {
  try {
   Send-Pending
   $data=Read-Device
   $items=[Collections.Generic.List[object]]::new();$seen=@{}
   foreach($u in $data.users) { $key='user:'+ $u.badge;$value=Hash-Key $u;if($state[$key] -ne $value) { $items.Add(@{kind='user';key=$key;value=$value;data=$u}) } }
   foreach($p in $data.punches) { $key='punch:'+(Hash-Key $p);if(-not $state.ContainsKey($key) -and -not $seen.ContainsKey($key)) { $seen[$key]=$true;$items.Add(@{kind='punch';key=$key;value='accepted';data=$p}) } }
   if($items.Count -eq 0) {
    Write-Private $queuePath @{batch=[ordered]@{schemaVersion=1;batchId=[Guid]::NewGuid().ToString();deviceId=$deviceId;users=@();punches=@()};progress=@{}}
    Send-Pending
   }
   for($i=0;$i -lt $items.Count;$i+=100) {
    $users=@();$punches=@();$progress=@{}
    for($j=$i;$j -lt [Math]::Min($i+100,$items.Count);$j++) { $item=$items[$j];$progress[$item.key]=$item.value;if($item.kind -eq 'user'){$users+=,$item.data}else{$punches+=,$item.data} }
    $batch=[ordered]@{schemaVersion=1;batchId=[Guid]::NewGuid().ToString();deviceId=$deviceId;users=@($users);punches=@($punches)}
    Write-Private $queuePath @{batch=$batch;progress=$progress}
    Send-Pending
   }
   Write-Host ([DateTime]::Now.ToString('s')+' Sync complete. Waiting for new records.')
  } catch {
   # Never print server response bodies, user data, token or communication key.
   Write-Warning 'Sync did not complete. Check network, device and pairing status. Any pending upload is preserved.'
   if($Once) { throw 'Attendance sync failed. Saved pending data was preserved.' }
  }
  if(-not $Once) { Start-Sleep -Seconds $interval }
 } while(-not $Once)
} finally { if($null -ne $lock) { $lock.Dispose() } }
