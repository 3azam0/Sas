param([switch]$Test)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskOut=Join-Path $taskRoot '.cache/print-helper'
$taskPublic=Join-Path $taskRoot 'apps/web/public/downloads'
New-Item -ItemType Directory -Path $taskOut,$taskPublic -Force | Out-Null
$taskCompiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(!(Test-Path -LiteralPath $taskCompiler)){throw 'Install Microsoft .NET Framework 4.8 to build the Windows helper.'}
$taskSources=@((Join-Path $PSScriptRoot 'Helper.cs'),(Join-Path $PSScriptRoot 'SelfTests.cs'))
$taskRefs=@('/r:System.dll','/r:System.Core.dll','/r:System.Drawing.dll','/r:System.Windows.Forms.dll','/r:System.Web.Extensions.dll')
if($Test){
 & $taskCompiler /nologo /utf8output /target:exe /optimize+ "/out:$taskOut/FooDo.PrintHelper.Tests.exe" @taskRefs @taskSources
 if($LASTEXITCODE){throw 'Helper test compilation failed.'}
 & (Join-Path $taskOut 'FooDo.PrintHelper.Tests.exe') --self-test
 if($LASTEXITCODE){throw 'Helper tests failed.'}
}
& $taskCompiler /nologo /utf8output /target:winexe /optimize+ "/out:$taskOut/FooDo.PrintHelper.exe" @taskRefs @taskSources
if($LASTEXITCODE){throw 'Helper compilation failed.'}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-FooDo-Print.cmd'),(Join-Path $PSScriptRoot 'README.txt') -Destination $taskOut -Force
$taskZip=Join-Path $taskPublic 'foodo-print-windows-1.0.0.zip'
Compress-Archive -LiteralPath (Join-Path $taskOut 'FooDo.PrintHelper.exe'),(Join-Path $taskOut 'Start-FooDo-Print.cmd'),(Join-Path $taskOut 'README.txt') -DestinationPath $taskZip -Force
$taskManifest=@{version='1.0.0';protocol=1;platform='windows';file='/downloads/foodo-print-windows-1.0.0.zip';sha256=(Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLower();exeSha256=(Get-FileHash -LiteralPath (Join-Path $taskOut 'FooDo.PrintHelper.exe') -Algorithm SHA256).Hash.ToLower();signed=$false}
$taskManifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskPublic 'foodo-print-windows.json') -Encoding utf8
Write-Output ('Windows helper packaged: '+$taskZip)
