param(
  [string]$InterfaceAlias = 'Ethernet',
  [string]$LaptopAddress = '192.168.123.200',
  [string]$DeviceAddress = '192.168.123.201',
  [int]$Port = 4370
)

$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"' +
    ' -InterfaceAlias "' + $InterfaceAlias + '"' +
    ' -LaptopAddress "' + $LaptopAddress + '"' +
    ' -DeviceAddress "' + $DeviceAddress + '"' +
    ' -Port ' + $Port
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -Wait -PassThru
  exit $process.ExitCode
}

$adapter = Get-NetAdapter -Name $InterfaceAlias -ErrorAction Stop
if ($adapter.Status -ne 'Up') { throw "Ethernet adapter '$InterfaceAlias' is not connected." }
$added = $false
try {
  $existing = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object IPAddress -eq $LaptopAddress
  if (-not $existing) {
    Write-Host ("Adding temporary address $LaptopAddress/24 to $InterfaceAlias ...")
    New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $LaptopAddress -PrefixLength 24 -AddressFamily IPv4 | Out-Null
    $added = $true
    Start-Sleep -Seconds 2
  }

  $powerShell32 = Join-Path $env:WINDIR 'SysWOW64\WindowsPowerShell\v1.0\powershell.exe'
  if (-not (Test-Path -LiteralPath $powerShell32)) { $powerShell32 = 'powershell.exe' }
  & $powerShell32 -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Test-K14Connection.ps1') -Address $DeviceAddress -Port $Port
  $diagnosticExit = $LASTEXITCODE
  $nodeModule = Join-Path $PSScriptRoot '..\..\.cache\k14-node\node_modules\node-zklib\zklib.js'
  if ($diagnosticExit -eq 3 -and (Get-Command node.exe -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $nodeModule)) {
    Write-Host 'Official SDK is unavailable; trying the temporary read-only Node protocol client.'
    & node.exe (Join-Path $PSScriptRoot 'Test-K14NodeConnection.cjs') $DeviceAddress $Port
    $diagnosticExit = $LASTEXITCODE
  }
  exit $diagnosticExit
} finally {
  if ($added) {
    Write-Host ("Removing temporary address $LaptopAddress ...")
    Remove-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $LaptopAddress -Confirm:$false -ErrorAction SilentlyContinue
  }
}
