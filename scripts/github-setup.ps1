param(
  [ValidateSet('Publish','Configure','All')][string]$Task='All',
  [ValidateRange(0,6)][int]$RequiredApprovals=0,
  [ValidateRange(1,30)][int]$WaitMinutes=20
)
$ErrorActionPreference='Stop'
$repoName='3azam0/Sas'
$expectedRemote='https://github.com/3azam0/Sas.git'
$taskBranch='chore/github-workflow'
$projectRoot=Split-Path $PSScriptRoot -Parent
$gitCommand=Get-Command git -ErrorAction SilentlyContinue
$bundledGit=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe'
$gitExe=if($gitCommand){$gitCommand.Source}elseif(Test-Path -LiteralPath $bundledGit){$bundledGit}else{throw 'Install Git for Windows first.'}

function Invoke-FodoGit {
  param([string[]]$Arguments)
  $result=& $gitExe -c "safe.directory=$projectRoot" @Arguments
  if($LASTEXITCODE -ne 0){throw "Git failed: $($Arguments[0]). Resolve the error above and rerun."}
  return (($result | Out-String).Trim())
}

function Invoke-GitHubApi {
  param([string]$Method,[string]$Path,$Body=$null)
  $request=@{Method=$Method;Uri="https://api.github.com/$Path";Headers=$script:apiHeaders}
  if($null -ne $Body){$request.ContentType='application/json';$request.Body=ConvertTo-Json -InputObject $Body -Depth 20 -Compress}
  try {$response=Invoke-RestMethod @request} catch {
    # Keep the original HTTP exception/Response so callers can still handle
    # 404, but retain GitHub's explanation instead of only "403 Forbidden".
    if($_.Exception.Response){$_.Exception.Data['GitHubStatusCode']=[int]$_.Exception.Response.StatusCode}
    if($_.ErrorDetails.Message){
      try {
        $details=$_.ErrorDetails.Message | ConvertFrom-Json
        if($details.message){$_.Exception.Data['GitHubMessage']=[string]$details.message}
        if($details.documentation_url){$_.Exception.Data['GitHubDocumentation']=[string]$details.documentation_url}
      } catch { }
    }
    throw
  }
  # Windows PowerShell emits REST arrays as a single pipeline object. Flatten
  # them explicitly so an empty PR list has Count=0 instead of Count=1.
  if($response -is [System.Collections.IEnumerable] -and $response -isnot [string] -and $response -isnot [System.Collections.IDictionary]){foreach($item in $response){if($null -ne $item){Write-Output $item}}}
  elseif($null -ne $response){Write-Output $response}
}

function New-FodoStatusChecks {
  param($Existing,[long]$AppId)
  $checks=@($Existing.checks | Where-Object {$null -ne $_ -and $_.context -ne 'CI gate'} | ForEach-Object {
    $check=@{context=$_.context}
    if($null -ne $_.app_id){$check.app_id=$_.app_id}
    $check
  })
  foreach($context in @($Existing.contexts)) {
    if($context -and $context -ne 'CI gate' -and -not @($checks | Where-Object {$_.context -eq $context}).Count){$checks+=@{context=$context}}
  }
  $checks+=@{context='CI gate';app_id=$AppId}
  # GitHub accepts either contexts or checks, not both. Use checks to bind
  # CI gate to GitHub Actions while preserving other required checks.
  return @{strict=$true;checks=$checks}
}

function Test-FodoReviewConflict {
  param($Environment,[long]$OwnerId)
  foreach($rule in @($Environment.protection_rules)) {
    if($null -eq $rule -or $rule.type -ne 'required_reviewers'){continue}
    if($rule.prevent_self_review){return $true}
    foreach($reviewer in @($rule.reviewers)) {
      if($null -ne $reviewer -and ($reviewer.type -ne 'User' -or $reviewer.reviewer.id -ne $OwnerId)){return $true}
    }
  }
  return $false
}

function Set-RepositoryControl {
  param([string]$Name,[scriptblock]$Operation)
  try { & $Operation; $script:setupResult.controls+=@{name=$Name;status='verified'}; Write-Host "Configured and verified: $Name" }
  catch {
    $script:setupFailures+=1
    $failure=@{name=$Name;status='failed';message=$_.Exception.Message}
    if($_.Exception.Data['GitHubStatusCode']){$failure.httpStatus=$_.Exception.Data['GitHubStatusCode']}
    if($_.Exception.Data['GitHubMessage']){$failure.message=$_.Exception.Data['GitHubMessage']}
    if($_.Exception.Data['GitHubDocumentation']){$failure.documentationUrl=$_.Exception.Data['GitHubDocumentation']}
    $script:setupResult.controls+=$failure
    Write-Warning "$Name was not configured: $($failure.message)"
  }
}

Push-Location $projectRoot
$previousPrompt=$env:GIT_TERMINAL_PROMPT
$credentialLines=$null
$accessToken=$null
$script:apiHeaders=$null
$script:setupFailures=0
$script:setupResult=@{repository=$repoName;task=$Task;status='in_progress';commit=$null;publishedCommit=$null;pullRequestUrl=$null;ciGate=@();controls=@();pendingUi=@('Verify production administrator bypass in GitHub before live deployment.');updatedAt=$null}
try {
  if((Invoke-FodoGit @('remote','get-url','origin')) -ne $expectedRemote){throw 'origin does not match the authorized Fodo repository.'}
  if(Invoke-FodoGit @('status','--porcelain')){throw 'Commit or preserve working-tree changes before publication.'}
  $currentBranch=Invoke-FodoGit @('branch','--show-current')
  if($Task -ne 'Configure' -and $currentBranch -ne $taskBranch){throw "Switch to $taskBranch before publishing this task."}
  if($Task -eq 'Configure' -and $currentBranch -notin @('main',$taskBranch)){throw "Configure controls from main or $taskBranch after the corresponding commit passes CI."}
  $head=Invoke-FodoGit @('rev-parse','HEAD')
  $script:setupResult.commit=$head

  if($Task -ne 'Configure') {
    # Normal Git for Windows handles sign-in in the user's session.
    $remoteHeads=Invoke-FodoGit @('ls-remote','--heads','origin')
    if(-not $remoteHeads) {
      Write-Host 'Publishing the already-authorized initial main branch.'
      Invoke-FodoGit @('push','-u','origin','main') | Write-Host
    }
    Invoke-FodoGit @('fetch','origin') | Write-Host
    Invoke-FodoGit @('merge-base','--is-ancestor','origin/main','HEAD') | Out-Null
    Invoke-FodoGit @('push','-u','origin',$taskBranch) | Write-Host
    $remoteHead=(Invoke-FodoGit @('ls-remote','origin',"refs/heads/$taskBranch")) -split '\s+'
    if($remoteHead[0] -ne $head){throw 'Remote branch does not match the local commit.'}
    $script:setupResult.publishedCommit=$head
    Write-Host "Verified branch publication: $head"
  }

  # Obtain an existing credential using Git's normal credential interface.
  # Capture its output privately; never print or persist the credential.
  $env:GIT_TERMINAL_PROMPT='0'
  $credentialRequest="protocol=https`nhost=github.com`n`n"
  $credentialLines=$credentialRequest | & $gitExe -c "safe.directory=$projectRoot" credential fill
  if($LASTEXITCODE -ne 0){throw 'GitHub API authentication is unavailable. Sign in with Git Credential Manager in a normal Windows session and rerun.'}
  foreach($line in $credentialLines){if($line.StartsWith('password=')){$accessToken=$line.Substring(9)}}
  if(-not $accessToken){throw 'Git did not return a GitHub credential.'}
  $script:apiHeaders=@{Authorization="Bearer $accessToken";Accept='application/vnd.github+json';'User-Agent'='Fodo-repository-setup';'X-GitHub-Api-Version'='2022-11-28'}
  $repository=Invoke-GitHubApi GET "repos/$repoName"
  if(-not $repository.permissions.admin){throw 'The signed-in GitHub account needs repository administrator access to configure these controls.'}
  if($repository.default_branch -ne 'main'){throw 'The remote default branch is not main. Review that difference before configuring protection.'}

  if($Task -ne 'Configure') {
    $pulls=@(Invoke-GitHubApi GET "repos/$repoName/pulls?head=3azam0%3Achore%2Fgithub-workflow&base=main&state=open")
    if($pulls.Count) {$pull=$pulls[0]} else {
      $body=[System.IO.File]::ReadAllText((Join-Path $projectRoot 'docs/runbooks/github-workflow-pr.md'))
      $pull=Invoke-GitHubApi POST "repos/$repoName/pulls" @{title='Add GitHub quality checks and controlled release workflow';head=$taskBranch;base='main';body=$body}
    }
    if(-not $pull.number -or $pull.html_url -notmatch '^https://github\.com/3azam0/Sas/pull/[0-9]+$'){throw 'GitHub did not return a valid pull request. Repository configuration has not started.'}
    $script:setupResult.pullRequestUrl=$pull.html_url
    Write-Host "Pull request: $($pull.html_url)"
    [System.IO.Directory]::CreateDirectory((Join-Path $projectRoot '.cache')) | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $projectRoot '.cache/github-pull-request.json'),(ConvertTo-Json @{url=$pull.html_url;branch=$taskBranch;commit=$head}))
  }

  if($Task -ne 'Publish') {
    Write-Host 'Waiting for CI gate on the published commit. Production deployment is not part of this script.'
    $deadline=(Get-Date).AddMinutes($WaitMinutes)
    $lastCiStatus=''
    do {
      $checks=Invoke-GitHubApi GET "repos/$repoName/commits/$head/check-runs?per_page=100"
      $gates=@($checks.check_runs | Where-Object {$_.name -eq 'CI gate' -and $_.app.slug -eq 'github-actions'})
      $script:setupResult.ciGate=@($gates | Select-Object status,conclusion,html_url)
      $ciStatus=if($gates.Count){($gates | ForEach-Object {"$($_.status)/$($_.conclusion)"}) -join ', '}else{'No CI gate reported yet'}
      if($ciStatus -ne $lastCiStatus){Write-Host "CI: $ciStatus | https://github.com/$repoName/actions";$lastCiStatus=$ciStatus}
      if($gates.Count -and @($gates | Where-Object {$_.status -ne 'completed'}).Count -eq 0) {
        if(@($gates | Where-Object {$_.conclusion -ne 'success'}).Count){throw 'CI gate failed. Inspect GitHub Actions and fix the checks before configuring protection.'}
        break
      }
      if((Get-Date) -ge $deadline){throw 'CI gate is not ready. After Actions passes, rerun with -Task Configure.'}
      Start-Sleep -Seconds 30
    }while($true)

    Set-RepositoryControl 'squash merging and cleanup' {
      $settings=Invoke-GitHubApi PATCH "repos/$repoName" @{allow_squash_merge=$true;allow_merge_commit=$false;allow_rebase_merge=$false;allow_auto_merge=$false;delete_branch_on_merge=$true}
      if(-not $settings.allow_squash_merge -or $settings.allow_merge_commit -or $settings.allow_rebase_merge -or -not $settings.delete_branch_on_merge){throw 'Repository merge settings did not match the requested policy.'}
    }
    Set-RepositoryControl 'main protection' {
      $existingProtection=$null
      try {$existingProtection=Invoke-GitHubApi GET "repos/$repoName/branches/main/protection"} catch {if([int]$_.Exception.Response.StatusCode -ne 404){throw}}
      if($existingProtection.restrictions -or $existingProtection.required_pull_request_reviews.require_code_owner_reviews -or $existingProtection.required_pull_request_reviews.required_approving_review_count -gt $RequiredApprovals){throw 'Existing main protection is stricter or has scoped access rules. Preserve it and review the policy before rerunning; this helper will not weaken it.'}
      $protection=@{
        required_status_checks=(New-FodoStatusChecks $existingProtection.required_status_checks $gates[0].app.id)
        enforce_admins=$true
        required_pull_request_reviews=@{dismiss_stale_reviews=$true;require_code_owner_reviews=$false;required_approving_review_count=$RequiredApprovals}
        restrictions=$null;required_conversation_resolution=$true;allow_force_pushes=$false;allow_deletions=$false
      }
      Invoke-GitHubApi PUT "repos/$repoName/branches/main/protection" $protection | Out-Null
      $saved=Invoke-GitHubApi GET "repos/$repoName/branches/main/protection"
      if(-not $saved.enforce_admins.enabled -or $saved.allow_force_pushes.enabled -or $saved.allow_deletions.enabled -or -not $saved.required_status_checks.strict -or -not $saved.required_conversation_resolution.enabled -or @($saved.required_status_checks.checks | Where-Object {$_.context -eq 'CI gate' -and $_.app_id -eq $gates[0].app.id}).Count -ne 1 -or $saved.required_pull_request_reviews.required_approving_review_count -ne $RequiredApprovals){throw 'Protection read-back did not match the requested policy.'}
    }
    Set-RepositoryControl 'immutable version tags' {
      $rulesets=@(Invoke-GitHubApi GET "repos/$repoName/rulesets?per_page=100")
      $existing=@($rulesets | Where-Object {$_.name -eq 'Fodo release tags'})
      $rule=@{name='Fodo release tags';target='tag';enforcement='active';bypass_actors=@();conditions=@{ref_name=@{include=@('refs/tags/v*');exclude=@()}};rules=@(@{type='deletion'},@{type='update'})}
      if($existing.Count){
        $previousRule=Invoke-GitHubApi GET "repos/$repoName/rulesets/$($existing[0].id)"
        if($previousRule.rules.Count -gt 2 -or $previousRule.bypass_actors.Count -or ($previousRule.conditions.ref_name.include -join ',') -ne 'refs/tags/v*' -or $previousRule.conditions.ref_name.exclude.Count){throw 'An existing version-tag ruleset needs review before replacement.'}
        $savedRule=Invoke-GitHubApi PUT "repos/$repoName/rulesets/$($existing[0].id)" $rule
      }else{$savedRule=Invoke-GitHubApi POST "repos/$repoName/rulesets" $rule}
      $savedRule=Invoke-GitHubApi GET "repos/$repoName/rulesets/$($savedRule.id)"
      if($savedRule.enforcement -ne 'active' -or $savedRule.target -ne 'tag' -or $savedRule.rules.Count -ne 2 -or @($savedRule.rules | Where-Object {$_.type -eq 'update'}).Count -ne 1 -or @($savedRule.rules | Where-Object {$_.type -eq 'deletion'}).Count -ne 1 -or $savedRule.bypass_actors.Count){throw 'Version-tag protection read-back failed.'}
    }
    foreach($environment in @('staging','client-demo')) {
      Set-RepositoryControl "$environment environment registration" {
        $savedEnvironment=Invoke-GitHubApi PUT "repos/$repoName/environments/$environment" @{deployment_branch_policy=@{protected_branches=$true;custom_branch_policies=$false}}
        if(-not $savedEnvironment.deployment_branch_policy.protected_branches){throw 'Environment branch policy did not match.'}
      }
    }
    Set-RepositoryControl 'production approval and release tags' {
      $owner=Invoke-GitHubApi GET 'users/3azam0'
      $previousEnvironment=$null
      try {$previousEnvironment=Invoke-GitHubApi GET "repos/$repoName/environments/production"} catch {if([int]$_.Exception.Response.StatusCode -ne 404){throw}}
      if(Test-FodoReviewConflict $previousEnvironment $owner.id){throw 'Existing production review requirements need review; they will not be replaced by the solo-owner policy.'}
      $waitTimer=0
      if($previousEnvironment){
        $oldPolicies=Invoke-GitHubApi GET "repos/$repoName/environments/production/deployment-branch-policies"
        if(@($oldPolicies.branch_policies | Where-Object {$null -ne $_ -and ($_.name -ne 'v*' -or $_.type -ne 'tag')}).Count){throw 'Existing production branch/tag policies need review before replacement.'}
        $timer=@($previousEnvironment.protection_rules | Where-Object {$_.type -eq 'wait_timer'})
        if($timer.Count){$waitTimer=$timer[0].wait_timer}
      }
      Invoke-GitHubApi PUT "repos/$repoName/environments/production" @{wait_timer=$waitTimer;prevent_self_review=$false;reviewers=@(@{type='User';id=$owner.id});deployment_branch_policy=@{protected_branches=$false;custom_branch_policies=$true}} | Out-Null
      $policies=Invoke-GitHubApi GET "repos/$repoName/environments/production/deployment-branch-policies"
      if(-not @($policies.branch_policies | Where-Object {$_.name -eq 'v*' -and $_.type -eq 'tag'}).Count){Invoke-GitHubApi POST "repos/$repoName/environments/production/deployment-branch-policies" @{name='v*';type='tag'} | Out-Null}
      $savedEnvironment=Invoke-GitHubApi GET "repos/$repoName/environments/production"
      $policies=Invoke-GitHubApi GET "repos/$repoName/environments/production/deployment-branch-policies"
      $reviewRules=@($savedEnvironment.protection_rules | Where-Object {$_.type -eq 'required_reviewers'})
      if(-not $reviewRules.Count -or -not @($reviewRules[0].reviewers | Where-Object {$_.reviewer.id -eq $owner.id}).Count -or -not $savedEnvironment.deployment_branch_policy.custom_branch_policies -or $savedEnvironment.deployment_branch_policy.protected_branches -or -not @($policies.branch_policies | Where-Object {$_.name -eq 'v*' -and $_.type -eq 'tag'}).Count){throw 'Production approval/tag policy read-back failed.'}
    }
    if($script:setupFailures){
      $failureSummary=($script:setupResult.controls | Where-Object {$_.status -eq 'failed'} | ForEach-Object {"$($_.name): $($_.message)"}) -join '; '
      throw "$script:setupFailures control(s) remain pending. $failureSummary. Details saved in .cache/github-setup-result.json."
    }
    Write-Host 'API-supported repository controls verified. Review and merge the PR in GitHub after its checks pass.'
    Write-Host 'Before live deployment, disable administrator bypass in GitHub Settings > Environments > production where the account plan supports it. That switch is not exposed by the supported environment API.'
    Write-Host 'Environment registrations contain no hosting resources or application secrets.'
  }
  $script:setupResult.status=if($Task -eq 'Publish'){'published'}else{'api_controls_verified'}
} catch {
  $script:setupResult.status='failed'
  $script:setupResult.message=$_.Exception.Message
  throw
} finally {
  $credentialLines=$null;$accessToken=$null;$script:apiHeaders=$null
  $env:GIT_TERMINAL_PROMPT=$previousPrompt
  $script:setupResult.updatedAt=[DateTime]::UtcNow.ToString('o')
  [System.IO.Directory]::CreateDirectory((Join-Path $projectRoot '.cache')) | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $projectRoot '.cache/github-setup-result.json'),(ConvertTo-Json -InputObject $script:setupResult -Depth 8))
  Pop-Location
}
