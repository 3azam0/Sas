param(
  [Parameter(Mandatory = $true)][string]$DatabasePath,
  [Parameter(Mandatory = $true)][string]$MapPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
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
    ' -DatabasePath "' + $DatabasePath + '"' +
    ' -MapPath "' + $MapPath + '"' +
    ' -OutputPath "' + $OutputPath + '"' +
    ' -InterfaceAlias "' + $InterfaceAlias + '"' +
    ' -LaptopAddress "' + $LaptopAddress + '"' +
    ' -DeviceAddress "' + $DeviceAddress + '"' +
    ' -Port ' + $Port
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
  exit $process.ExitCode
}

$adapter = Get-NetAdapter -Name $InterfaceAlias -ErrorAction Stop
if ($adapter.Status -ne 'Up') { throw "Ethernet adapter '$InterfaceAlias' is not connected." }
$added = $false
try {
  $existing = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object IPAddress -eq $LaptopAddress
  if (-not $existing) {
    New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $LaptopAddress -PrefixLength 24 -AddressFamily IPv4 | Out-Null
    $added = $true
    Start-Sleep -Seconds 2
  }
  $powerShell32 = Join-Path $env:WINDIR 'SysWOW64\WindowsPowerShell\v1.0\powershell.exe'
  & $powerShell32 -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Backup-K14SelectedData.ps1') -DatabasePath $DatabasePath -MapPath $MapPath -OutputPath $OutputPath -Address $DeviceAddress -Port $Port
  exit $LASTEXITCODE
} finally {
  if ($added) {
    Remove-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $LaptopAddress -Confirm:$false -ErrorAction SilentlyContinue
  }
}
