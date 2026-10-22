$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskBranch='feat/cloud-client-release'
$taskRepo='3azam0/Sas'
$taskRemote='https://github.com/3azam0/Sas.git'
$taskGitCommand=Get-Command git -ErrorAction SilentlyContinue
$taskBundledGit=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe'
$taskGit=if($taskGitCommand){$taskGitCommand.Source}elseif(Test-Path -LiteralPath $taskBundledGit){$taskBundledGit}else{throw 'Git is not installed.'}
function Invoke-ReleaseGit {
 param([string[]]$Arguments)
 $taskOutput=& $taskGit -C $taskRoot -c "safe.directory=$taskRoot" @Arguments
 if($LASTEXITCODE -ne 0){throw "Git $($Arguments[0]) failed. Resolve the error and run this launcher again."}
 return (($taskOutput | Out-String).Trim())
}
if((Invoke-ReleaseGit @('remote','get-url','origin')) -ne $taskRemote){throw 'The repository remote does not match 3azam0/Sas.'}
if((Invoke-ReleaseGit @('branch','--show-current')) -ne $taskBranch){throw "Switch to $taskBranch before publishing."}
if(Invoke-ReleaseGit @('status','--porcelain')){throw 'Commit or review the working changes before publishing. This launcher never creates commits.'}
$taskSha=Invoke-ReleaseGit @('rev-parse','HEAD')
Invoke-ReleaseGit @('push','--set-upstream','origin',$taskBranch) | Write-Output
$taskPublished=Invoke-ReleaseGit @('ls-remote','--heads','origin',"refs/heads/$taskBranch")
if(($taskPublished -split '\s+')[0] -ne $taskSha){throw 'The remote commit does not match the local release.'}
$taskCompare="https://github.com/$taskRepo/compare/main...$taskBranch?expand=1"
$taskPrUrl=$null
try {
 # Read the existing Git credential only in memory; never write it or log it.
 $taskCredential="protocol=https`nhost=github.com`n`n" | & $taskGit -C $taskRoot -c "safe.directory=$taskRoot" credential fill
 if($LASTEXITCODE -ne 0){throw 'GitHub API credentials unavailable.'}
 $taskPassword=($taskCredential | Where-Object {$_ -like 'password=*'} | Select-Object -First 1)
 if(!$taskPassword){throw 'GitHub API credentials unavailable.'}
 $taskHeaders=@{Authorization="Bearer $($taskPassword.Substring(9))";Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28';'User-Agent'='Fodo-release'}
 $taskApi="https://api.github.com/repos/$taskRepo"
 $taskExisting=Invoke-RestMethod -Uri "$taskApi/pulls?state=open&head=3azam0%3Afeat%2Fcloud-client-release&base=main" -Headers $taskHeaders
 if(@($taskExisting).Count -gt 0){$taskPrUrl=@($taskExisting)[0].html_url}
 else {
  $taskBody=@{title='Deliver Fodo inventory, cost control and hosted client trial';head=$taskBranch;base='main';draft=$true;body=@'
Deliver the restaurant inventory and cost-control milestones with the first hosted client workspace. Supabase verifies real owner access and isolates tenant data; Cloudflare serves the shared offline-capable UI. Sales imports calculate theoretical quantities and estimated cost without deducting stock. Hosted screens exclude development controls.

Includes catalog/setup, purchasing/receipts/returns, transfers/counts, moving-average/FIFO valuation, versioned recipes/production, sales mapping/imports, recovery and form improvements. The approved hosted catalog has 328 zero-balance items.

Validation: 224 unit/integration tests, TypeScript, production/offline and cloud builds, local browser regressions and live cloud sign-in/mobile/offline/logout checks passed. See docs/releases/hosted-client-2026-10-11.md for deployment identifiers and limits. Billing, membership UI, full POS and fiscal adapters remain deferred. This PR does not merge or deploy automatically.
'@} | ConvertTo-Json -Depth 5
  $taskPr=Invoke-RestMethod -Uri "$taskApi/pulls" -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskBody
  $taskPrUrl=$taskPr.html_url
 }
} catch {
 Write-Warning 'The branch is published, but the draft PR could not be created automatically. Open the comparison page to create it.'
} finally {
 $taskCredential=$null;$taskPassword=$null;$taskHeaders=$null
}
$taskCache=Join-Path $taskRoot '.cache'
New-Item -ItemType Directory -Path $taskCache -Force | Out-Null
@{branch=$taskBranch;commit=$taskSha;pullRequest=$taskPrUrl;comparison=$taskCompare;publishedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskCache 'hosted-release-publication.json') -Encoding UTF8
Write-Output "Published commit: $taskSha"
if($taskPrUrl){Write-Output "Draft pull request: $taskPrUrl";Start-Process $taskPrUrl}
else{Write-Output "Create pull request: $taskCompare";Start-Process $taskCompare}
