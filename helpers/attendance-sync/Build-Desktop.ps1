param([string]$OutputDirectory=(Join-Path $PSScriptRoot '../../.cache/attendance-desktop'))
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Path $OutputDirectory -Force|Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not(Test-Path -LiteralPath $compiler)){$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'}
$assembly=[System.Management.Automation.PowerShell].Assembly.Location
$target=Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) 'FooDoAttendance.exe'
& $compiler /nologo /target:winexe /platform:anycpu ('/reference:'+$assembly) /reference:System.Windows.Forms.dll ('/out:'+$target) (Join-Path $PSScriptRoot 'FooDoAttendance.cs')
if($LASTEXITCODE -ne 0){throw 'FooDo desktop launcher compilation failed.'}
Write-Host 'FooDo desktop launcher built.'
