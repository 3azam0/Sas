$ErrorActionPreference='Stop'
$helper=Join-Path (Split-Path $PSScriptRoot -Parent) 'github-setup.ps1'
$parseErrors=$null;$tokens=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($helper,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'GitHub setup script has syntax errors.'}
$definition=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-GitHubApi'},$true)
if(-not $definition){throw 'GitHub API helper was not found.'}
. ([scriptblock]::Create($definition.Extent.Text))
$script:apiHeaders=@{}
$script:fixture=$null
$script:failRequest=$false

# Reproduce Invoke-RestMethod's non-enumerated array output in Windows PowerShell.
function Invoke-RestMethod {
  param($Method,$Uri,$Headers,$ContentType,$Body)
  if($script:failRequest){throw 'Simulated GitHub access failure'}
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
Write-Host 'GitHub setup regression checks: 6 passed.'
