param([string]$TestRoot=(Join-Path $PSScriptRoot '../../.cache/attendance-setup-test'))
$ErrorActionPreference='Stop'
foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1'){
 $tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors)
 if($errors.Count){throw ('Windows PowerShell syntax failed: '+$file.Name+' '+$errors[0].Message)}
}
. (Join-Path $PSScriptRoot 'AttendanceSync.Common.ps1')
$script:isolatedRoot=[IO.Path]::GetFullPath($TestRoot)
function Get-FodoSyncRoot { $script:isolatedRoot }
$id=[Guid]::NewGuid()
$token=ConvertTo-SecureString ('fodo_hr_'+('a'*64)) -AsPlainText -Force
$key=ConvertTo-SecureString '0' -AsPlainText -Force
$empty=New-Object Security.SecureString
$path=Save-FodoSyncConfig -Server 'https://attendance-test.invalid' -DeviceId $id -Address '192.168.123.201' -Token $token -CommKey $key
$before=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
if($before.token -like '*fodo_hr_*' -or (ConvertFrom-FodoSecure (ConvertTo-SecureString $before.token)) -ne ('fodo_hr_'+('a'*64))){throw 'Encrypted credentials did not round-trip.'}
$deviceRoot=Join-Path (Get-FodoSyncRoot) $id.ToString()
[IO.File]::WriteAllText((Join-Path $deviceRoot 'progress.dpapi'),'preserve-existing-progress')
$null=Save-FodoSyncConfig -Server 'https://attendance-test.invalid' -DeviceId $id -Address '192.168.123.202' -Token $empty -CommKey $empty -SyncEveryHours 6 -UpdatePairing
$after=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
if($before.token -ne $after.token -or $before.commKey -ne $after.commKey -or $after.syncEveryHours -ne 6){throw 'Updating connection settings replaced a saved credential.'}
if([IO.File]::ReadAllText((Join-Path $deviceRoot 'progress.dpapi')) -ne 'preserve-existing-progress'){throw 'Existing progress was altered.'}
if(@(Get-ChildItem -LiteralPath (Join-Path (Get-FodoSyncRoot) 'saved-config') -Filter ($id.ToString()+'-*.json')).Count -ne 1){throw 'Saved configuration backup is missing.'}
$lock=[IO.File]::Open((Join-Path $deviceRoot 'agent.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try{
 $blocked=$false;try{$null=Save-FodoSyncConfig -Server 'https://attendance-test.invalid' -DeviceId $id -Address '192.168.123.203' -Token $empty -CommKey $empty -UpdatePairing}catch{$blocked=$true}
 if(-not $blocked){throw 'An in-progress sync did not protect its configuration.'}
}finally{$lock.Dispose()}
foreach($bad in @('http://attendance-test.invalid','https://attendance-test.invalid/path','https://user:pass@attendance-test.invalid')){
 $blocked=$false;try{$null=Save-FodoSyncConfig -Server $bad -DeviceId $id -Address '192.168.123.201' -Token $token -CommKey $key -UpdatePairing}catch{$blocked=$true}
 if(-not $blocked){throw 'An invalid server origin was accepted.'}
}
Write-Host 'PASS: PowerShell 5 syntax, DPAPI credentials, saved-credential preservation, backup, existing progress, concurrent sync lock and HTTPS origin validation. No device, cloud or scheduled-task changes.'
