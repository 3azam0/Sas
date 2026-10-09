param([ValidateSet('setup','dev','build','start','typecheck','test','browser','backup','cloud-check')][string]$Task='setup',[switch]$SandboxCompat)
$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
$previousOptions=$env:NODE_OPTIONS
$previousTemp=$env:TEMP
$previousTmp=$env:TMP
try {
  $nodeCommand=Get-Command node -ErrorAction SilentlyContinue
  $runtimePath=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
  $taskNode=if($nodeCommand){$nodeCommand.Source}elseif(Test-Path -LiteralPath $runtimePath){$runtimePath}else{throw 'Install Node.js 24 or add it to PATH.'}
  if($SandboxCompat){
    $preload=(Join-Path $PSScriptRoot 'windows-compat.cjs').Replace('\','/')
    $env:NODE_OPTIONS="$previousOptions --require=`"$preload`""
    New-Item -ItemType Directory -Path '.cache/tmp' -Force | Out-Null
    $env:TEMP=(Resolve-Path '.cache/tmp').Path
    $env:TMP=$env:TEMP
  }
  switch($Task){
    'setup' { & $taskNode scripts/environment.mjs }
    'dev' { & $taskNode scripts/next.mjs dev }
    'start' { & $taskNode scripts/next.mjs start }
    'build' { & $taskNode scripts/next.mjs build; if($LASTEXITCODE -eq 0){ & $taskNode scripts/precache.mjs } }
    'typecheck' { & $taskNode node_modules/typescript/bin/tsc --noEmit }
    'test' { & $taskNode node_modules/vitest/vitest.mjs run }
    'browser' { & $taskNode scripts/browser-check.mjs }
    'backup' { & $taskNode scripts/backup.mjs create }
    'cloud-check' { & $taskNode scripts/supabase-check.mjs }
  }
  $taskExitCode=$LASTEXITCODE
} finally {
  $env:NODE_OPTIONS=$previousOptions
  $env:TEMP=$previousTemp
  $env:TMP=$previousTmp
  Pop-Location
}
exit $taskExitCode
