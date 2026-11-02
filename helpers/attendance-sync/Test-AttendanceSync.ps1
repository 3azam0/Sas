param([string]$TestRoot=(Join-Path $PSScriptRoot '../../.cache/attendance-agent-test'))
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Path $TestRoot -Force|Out-Null
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Sync-K14Attendance.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count) { throw 'Agent PowerShell syntax failed.' }
$wanted=@('Unprotect-Text','Read-Private','Write-Private','Hash-Key','Send-Pending')
foreach($fn in $ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)) {
 if($wanted -contains $fn.Name) { . ([ScriptBlock]::Create($fn.Extent.Text)) }
}
$config=@{server='https://attendance-test.invalid'};$deviceId=[Guid]::NewGuid().ToString();$token='fodo_hr_'+('a'*64);$state=@{}
$queuePath=Join-Path $TestRoot ($deviceId+'.pending');$statePath=Join-Path $TestRoot ($deviceId+'.progress')
$batch=@{schemaVersion=1;batchId=[Guid]::NewGuid().ToString();deviceId=$deviceId;users=@(@{badge='101';name='Synthetic employee'});punches=@(@{badge='101';localTime='2026-11-02T08:00:00';verifyMode=1;inOutMode=0;workCode=0})}
$pending=@{batch=$batch;progress=@{'punch:test'='accepted'}}
Write-Private $queuePath $pending
$cipher=Get-Content -LiteralPath $queuePath -Raw
if($cipher.Contains('Synthetic employee') -or $cipher.Contains($batch.batchId)) { throw 'Private queue contains plaintext.' }
if((Read-Private $queuePath).batch.batchId -ne $batch.batchId) { throw 'DPAPI queue round trip failed.' }
# Exercise the atomic replacement path as well as first creation.
Write-Private $queuePath $pending
$script:rejectAck=$true;$script:sent=@()
function Invoke-RestMethod {
 param($Uri,$Method,$Headers,$ContentType,$Body,$TimeoutSec,$MaximumRedirection)
 if($Uri -ne 'https://attendance-test.invalid/api/v1/attendance-sync' -or $Headers.Authorization -ne ('Bearer '+$token)) { throw 'Unexpected request scope.' }
 $b=[Text.Encoding]::UTF8.GetString($Body)|ConvertFrom-Json
 $script:sent+=,$b.batchId
 return @{outcome='accepted';deviceId=$deviceId;batchId=$(if($script:rejectAck){[Guid]::NewGuid().ToString()}else{$b.batchId});received=1;inserted=1}
}
$failed=$false;try{Send-Pending}catch{$failed=$true}
if(-not $failed -or -not(Test-Path -LiteralPath $queuePath) -or $state.Count -ne 0) { throw 'Unconfirmed upload changed progress or lost the queue.' }
$script:rejectAck=$false;Send-Pending
if(Test-Path -LiteralPath $queuePath) { throw 'Acknowledged queue was not removed.' }
if($state['punch:test'] -ne 'accepted' -or (Read-Private $statePath).'punch:test' -ne 'accepted') { throw 'Accepted progress was not saved.' }
if($script:sent.Count -ne 2 -or $script:sent[0] -ne $script:sent[1]) { throw 'Retry changed the batch identity.' }
if((Hash-Key @('101','2026-11-02T08:00:00')) -ne (Hash-Key @('101','2026-11-02T08:00:00'))) { throw 'Local deduplication key is unstable.' }
Remove-Item -LiteralPath $statePath
Write-Host 'PASS attendance agent: syntax, DPAPI encryption, atomic queue replace, uncertain acknowledgement, same-batch retry and durable progress. No device or network was used.'
