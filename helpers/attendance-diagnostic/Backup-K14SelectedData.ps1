param(
  [Parameter(Mandatory = $true)][string]$DatabasePath,
  [Parameter(Mandatory = $true)][string]$MapPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$Address = '192.168.123.201',
  [int]$Port = 4370
)

$ErrorActionPreference = 'Stop'
trap {
  $errorPath = $OutputPath + '.error.txt'
  ($_ | Out-String) | Set-Content -LiteralPath $errorPath -Encoding UTF8
  exit 1
}

function Get-CommKey([string]$path, [string]$deviceAddress) {
  $connection = New-Object -ComObject ADODB.Connection
  $connection.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$path;Mode=Read;")
  try {
    $safeAddress = $deviceAddress.Replace("'", "''")
    $command = New-Object -ComObject ADODB.Command
    $command.ActiveConnection = $connection
    $command.CommandText = "SELECT TOP 1 [CommPassword] FROM [Machines] WHERE [IP]='$safeAddress'"
    $recordset = $command.Execute()
    try {
      if ($recordset.EOF -or $null -eq $recordset.Fields.Item(0).Value -or $recordset.Fields.Item(0).Value -is [System.DBNull]) { return 0 }
      return [int]$recordset.Fields.Item(0).Value
    } finally {
      $recordset.Close()
    }
  } finally {
    $connection.Close()
  }
}

$employeeMap = Get-Content -LiteralPath $MapPath -Raw -Encoding UTF8 | ConvertFrom-Json
$selected = @($employeeMap | Where-Object { $_.preserveFingerprint })
if ($selected.Count -ne 51) { throw "Expected 51 selected employees, got $($selected.Count)" }
$selectedByOldCode = @{}
foreach ($employee in $selected) { $selectedByOldCode[[string]$employee.oldCode] = $employee }

$commKey = Get-CommKey $DatabasePath $Address
$device = New-Object -ComObject 'zkemkeeper.ZKEM'
$connected = $false
try {
  if ($commKey -ne 0) {
    if (-not $device.SetCommPassword($commKey)) { throw 'The SDK rejected the stored communication key.' }
  }
  if (-not $device.Connect_Net($Address, $Port)) { throw 'Could not connect to the K14 Pro.' }
  $connected = $true

  $count = 0
  if (-not $device.GetDeviceStatus(1, 2, [ref]$count)) { throw 'Could not read the device user count.' }
  $deviceUserCount = $count
  $count = 0
  if (-not $device.GetDeviceStatus(1, 3, [ref]$count)) { throw 'Could not read the device fingerprint count.' }
  $deviceFingerprintCount = $count

  if (-not $device.ReadAllUserID(1)) { throw 'ReadAllUserID failed.' }
  $liveUsers = @{}
  while ($true) {
    $enrollNumber = ''
    $name = ''
    $password = ''
    $privilege = 0
    $enabled = $false
    if (-not $device.SSR_GetAllUserInfo(1, [ref]$enrollNumber, [ref]$name, [ref]$password, [ref]$privilege, [ref]$enabled)) { break }
    $liveUsers[[string]$enrollNumber] = [ordered]@{
      enrollNumber = [string]$enrollNumber
      name = [string]$name
      privilege = [int]$privilege
      enabled = [bool]$enabled
    }
  }
  if ($liveUsers.Count -ne $deviceUserCount) { throw "Downloaded $($liveUsers.Count) users, device reports $deviceUserCount" }

  if (-not $device.ReadAllTemplate(1)) { throw 'ReadAllTemplate failed.' }
  $backupEmployees = @()
  $fingerprintTotal = 0
  foreach ($employee in $employeeMap) {
    $templates = @()
    $liveUser = $null
    if ($employee.preserveFingerprint) {
      $oldCode = [string]$employee.oldCode
      if (-not $liveUsers.ContainsKey($oldCode)) { throw "Selected old badge $oldCode does not exist on the device" }
      $liveUser = $liveUsers[$oldCode]
      for ($fingerIndex = 0; $fingerIndex -lt 10; $fingerIndex++) {
        $templateData = ''
        $templateLength = 0
        if ($device.SSR_GetUserTmpStr(1, $oldCode, $fingerIndex, [ref]$templateData, [ref]$templateLength)) {
          $templates += [ordered]@{
            fingerIndex = $fingerIndex
            length = $templateLength
            data = $templateData
          }
          $fingerprintTotal++
        }
      }
      if ($templates.Count -ne [int]$employee.expectedFingerprints) {
        throw "Old badge $oldCode expected $($employee.expectedFingerprints) fingerprints, downloaded $($templates.Count)"
      }
    }
    $backupEmployees += [ordered]@{
      newCode = [string]$employee.newCode
      oldCode = if ($employee.preserveFingerprint) { [string]$employee.oldCode } else { $null }
      name = [string]$employee.name
      job = [string]$employee.job
      liveDeviceName = if ($null -ne $liveUser) { [string]$liveUser.name } else { $null }
      preserveFingerprint = [bool]$employee.preserveFingerprint
      fingerprints = $templates
    }
  }

  if ($backupEmployees.Count -ne 65) { throw "Expected 65 prepared employees, got $($backupEmployees.Count)" }
  if ($fingerprintTotal -ne 101) { throw "Expected 101 selected fingerprints, downloaded $fingerprintTotal" }

  $snapshot = [ordered]@{
    schemaVersion = 1
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    device = [ordered]@{
      address = $Address
      userCountBeforePreparation = $deviceUserCount
      fingerprintCountBeforePreparation = $deviceFingerprintCount
    }
    preparedEmployeeCount = 65
    preparedFingerprintCount = $fingerprintTotal
    employees = $backupEmployees
  }
  $directory = Split-Path -Parent $OutputPath
  if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory | Out-Null }
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  ([ordered]@{
    outputPath = $OutputPath
    liveUsers = $deviceUserCount
    liveFingerprints = $deviceFingerprintCount
    preparedEmployees = 65
    preparedFingerprints = $fingerprintTotal
  } | ConvertTo-Json -Compress)
} finally {
  if ($connected) { try { $device.Disconnect() } catch { } }
  try { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($device) | Out-Null } catch { }
}
