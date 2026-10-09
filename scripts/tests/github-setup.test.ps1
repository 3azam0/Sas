$ErrorActionPreference='Stop'
$helper=Join-Path (Split-Path $PSScriptRoot -Parent) 'github-setup.ps1'
$parseErrors=$null;$tokens=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($helper,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'GitHub setup script has syntax errors.'}
foreach($functionName in @('Invoke-GitHubApi','Test-FodoReviewConflict','New-FodoStatusChecks')) {
  $definition=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $functionName},$true)
  if(-not $definition){throw "Helper function was not found: $functionName"}
  . ([scriptblock]::Create($definition.Extent.Text))
}
$script:apiHeaders=@{}
$script:fixture=$null
$script:failRequest=$false
$script:errorDetails=$null

# Reproduce Invoke-RestMethod's non-enumerated array output in Windows PowerShell.
function Invoke-RestMethod {
  param($Method,$Uri,$Headers,$ContentType,$Body)
  if($script:failRequest){
    $failure=[System.Management.Automation.ErrorRecord]::new([System.Exception]::new('Simulated GitHub access failure'),'GitHubFailure',[System.Management.Automation.ErrorCategory]::PermissionDenied,$null)
    if($script:errorDetails){$failure.ErrorDetails=[System.Management.Automation.ErrorDetails]::new($script:errorDetails)}
    throw $failure
  }
  Write-Output -NoEnumerate $script:fixture
}
function Assert-Result {param($Condition,[string]$Message) if(-not $Condition){throw $Message}}

$script:fixture=[object[]]@()
$empty=@(Invoke-GitHubApi GET 'repos/example/project/pulls')
Assert-Result ($empty.Count -eq 0) 'An empty PR list must trigger creation, not reuse.'

$script:fixture=[object[]]@([pscustomobject]@{number=1;html_url='https://github.com/example/project/pull/1'})
$single=@(Invoke-GitHubApi GET 'repos/example/project/pulls')
Assert-Result ($single.Count -eq 1 -and $single[0].number -eq 1) 'One PR must be returned as one object.'

$script:fixture=[object[]]@([pscustomobject]@{id=10},[pscustomobject]@{id=20})
$multiple=@(Invoke-GitHubApi GET 'repos/example/project/rulesets')
Assert-Result ($multiple.Count -eq 2 -and $multiple[1].id -eq 20) 'Ruleset arrays must preserve every entry.'

$script:fixture=[pscustomobject]@{check_runs=@([pscustomobject]@{name='CI gate';status='completed'})}
$checks=Invoke-GitHubApi GET 'repos/example/project/commits/example/check-runs'
Assert-Result ($checks.check_runs[0].name -eq 'CI gate') 'Object envelopes must preserve nested arrays.'

$script:fixture=$null
$noContent=@(Invoke-GitHubApi GET 'repos/example/project/empty')
Assert-Result ($noContent.Count -eq 0) 'A null response must not become a phantom record.'

$script:failRequest=$true
$failed=$false
try {Invoke-GitHubApi GET 'repos/example/project'} catch {$failed=$_.Exception.Message -eq 'Simulated GitHub access failure'}
Assert-Result $failed 'API errors must propagate rather than appear as empty lists.'
$script:errorDetails='{"message":"Repository protection is unavailable","documentation_url":"https://docs.github.com/rest"}'
try {Invoke-GitHubApi GET 'repos/example/project'} catch {$apiFailure=$_}
Assert-Result ($apiFailure.Exception.Data['GitHubMessage'] -eq 'Repository protection is unavailable' -and $apiFailure.Exception.Data['GitHubDocumentation'] -eq 'https://docs.github.com/rest') 'GitHub error explanations and documentation must be retained.'
$script:errorDetails='Non-JSON gateway failure'
try {Invoke-GitHubApi GET 'repos/example/project'} catch {$apiFailure=$_}
Assert-Result ($apiFailure.Exception.Message -eq 'Simulated GitHub access failure') 'Invalid error JSON must not replace the original API failure.'
$ownerReviewer=[pscustomobject]@{type='User';reviewer=[pscustomobject]@{id=1}}
$otherReviewer=[pscustomobject]@{type='User';reviewer=[pscustomobject]@{id=2}}
$teamReviewer=[pscustomobject]@{type='Team';reviewer=[pscustomobject]@{id=1}}
$reviewCases=@(
  @{label='missing environment';environment=$null;conflict=$false},
  @{label='empty rules';environment=[pscustomobject]@{protection_rules=@()};conflict=$false},
  @{label='wait timer only';environment=[pscustomobject]@{protection_rules=@([pscustomobject]@{type='wait_timer';wait_timer=10})};conflict=$false},
  @{label='missing reviewer array';environment=[pscustomobject]@{protection_rules=@([pscustomobject]@{type='required_reviewers'})};conflict=$false},
  @{label='same owner';environment=[pscustomobject]@{protection_rules=@([pscustomobject]@{type='required_reviewers';reviewers=@($ownerReviewer)})};conflict=$false},
  @{label='different reviewer';environment=[pscustomobject]@{protection_rules=@([pscustomobject]@{type='required_reviewers';reviewers=@($otherReviewer)})};conflict=$true},
  @{label='team reviewer';environment=[pscustomobject]@{protection_rules=@([pscustomobject]@{type='required_reviewers';reviewers=@($teamReviewer)})};conflict=$true},
  @{label='independent review required';environment=[pscustomobject]@{protection_rules=@([pscustomobject]@{type='required_reviewers';reviewers=@($ownerReviewer);prevent_self_review=$true})};conflict=$true},
  @{label='multiple reviewers';environment=[pscustomobject]@{protection_rules=@([pscustomobject]@{type='required_reviewers';reviewers=@($ownerReviewer,$otherReviewer)})};conflict=$true},
  @{label='null entries';environment=[pscustomobject]@{protection_rules=@($null,[pscustomobject]@{type='required_reviewers';reviewers=@($null,$ownerReviewer)})};conflict=$false}
)
foreach($case in $reviewCases){Assert-Result ((Test-FodoReviewConflict $case.environment 1) -eq $case.conflict) "Incorrect reviewer conflict for $($case.label)."}
$newChecks=(New-FodoStatusChecks $null 15368 | ConvertTo-Json -Depth 10 | ConvertFrom-Json)
Assert-Result ($newChecks.strict -and $newChecks.checks.Count -eq 1 -and $newChecks.checks[0].context -eq 'CI gate' -and $newChecks.checks[0].app_id -eq 15368 -and 'contexts' -notin $newChecks.PSObject.Properties.Name) 'The serialized request must use only checks and bind CI gate to GitHub Actions.'
$existingChecks=[pscustomobject]@{checks=@([pscustomobject]@{context='Security';app_id=42});contexts=@('Security','Legacy')}
$preserved=(New-FodoStatusChecks $existingChecks 15368 | ConvertTo-Json -Depth 10 | ConvertFrom-Json)
Assert-Result ($preserved.checks.Count -eq 3 -and $preserved.checks[0].app_id -eq 42) 'Existing app-bound checks must be preserved without duplicates.'
Assert-Result ($preserved.checks[1].context -eq 'Legacy' -and 'app_id' -notin $preserved.checks[1].PSObject.Properties.Name) 'Legacy required contexts must be preserved using automatic app selection.'
$oldGate=[pscustomobject]@{checks=@([pscustomobject]@{context='CI gate';app_id=-1});contexts=@('CI gate')}
$rebound=New-FodoStatusChecks $oldGate 15368
Assert-Result ($rebound.checks.Count -eq 1 -and $rebound.checks[0].app_id -eq 15368) 'CI gate must appear once and require the GitHub Actions app.'
Write-Host 'GitHub setup regression checks: 22 passed.'
