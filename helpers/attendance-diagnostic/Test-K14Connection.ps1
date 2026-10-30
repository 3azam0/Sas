param(
  [string]$Address = '192.168.123.201',
  [ValidateRange(1, 65535)][int]$Port = 4370,
  [ValidateRange(0, 999999999)][int]$CommKey = 0,
  [ValidateRange(500, 30000)][int]$TimeoutMs = 4000,
  [switch]$ReadAttendanceSample
)

$ErrorActionPreference = 'Stop'
$resultPath = Join-Path $PSScriptRoot 'K14-diagnostic-result.json'
$result = [ordered]@{
  schemaVersion = 1
  checkedAtUtc = [DateTime]::UtcNow.ToString('o')
  target = [ordered]@{ address = $Address; port = $Port }
  tcpReachable = $false
  sdkAvailable = $false
  connected = $false
  productName = $null
  firmwareVersion = $null
  platform = $null
  userCount = $null
  fingerprintCount = $null
  attendanceRecordCount = $null
  attendanceReadTest = $false
  attendanceSampleTime = $null
  message = $null
  warnings = @()
}

function Save-Result {
  param([int]$ExitCode)
  $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8
  Write-Host ''
  Write-Host ('Result: ' + $result.message)
  Write-Host ('Report: ' + $resultPath)
  exit $ExitCode
}

Write-Host 'FooDo K14 Pro connection diagnostic'
Write-Host ('Testing ' + $Address + ':' + $Port + ' ...')

$client = [Net.Sockets.TcpClient]::new()
try {
  $attempt = $client.BeginConnect($Address, $Port, $null, $null)
  if (-not $attempt.AsyncWaitHandle.WaitOne($TimeoutMs)) { throw 'Connection timed out.' }
  $client.EndConnect($attempt)
  $result.tcpReachable = $true
  Write-Host 'PASS: TCP port is reachable.' -ForegroundColor Green
} catch {
  $result.message = 'The device is not reachable from this computer. Run this diagnostic on a PC in the same branch network and verify the device IP, cable, and power.'
  $result.warnings += $_.Exception.Message
  Write-Host 'FAIL: TCP port is not reachable.' -ForegroundColor Red
  Save-Result 2
} finally {
  $client.Dispose()
}

$device = $null
try {
  $device = New-Object -ComObject 'zkemkeeper.ZKEM'
  $result.sdkAvailable = $true
  Write-Host 'PASS: ZKTeco Standalone SDK is registered.' -ForegroundColor Green
} catch {
  $result.message = 'The network is reachable, but the ZKTeco Standalone SDK is not registered for this Windows process. Run the diagnostic on the PC that has the working ZKTeco attendance software.'
  $result.warnings += $_.Exception.Message
  Write-Host 'FAIL: ZKTeco SDK is unavailable.' -ForegroundColor Red
  Save-Result 3
}

try {
  if ($CommKey -ne 0) {
    try {
      if (-not $device.SetCommPassword($CommKey)) {
        $result.warnings += 'The SDK did not accept the communication key before connecting.'
      }
    } catch {
      $result.warnings += ('Communication key setup: ' + $_.Exception.Message)
    }
  }

  if (-not $device.Connect_Net($Address, $Port)) {
    $result.message = 'TCP is reachable, but the SDK could not authenticate or open the device. Close the ZKTeco desktop software temporarily and verify the communication key.'
    Write-Host 'FAIL: SDK connection was rejected.' -ForegroundColor Red
    Save-Result 4
  }

  $result.connected = $true
  Write-Host 'PASS: SDK connected to the attendance device.' -ForegroundColor Green

  $value = ''
  try { if ($device.GetProductCode(1, [ref]$value)) { $result.productName = $value } } catch { $result.warnings += ('Product name: ' + $_.Exception.Message) }
  $value = ''
  try { if ($device.GetFirmwareVersion(1, [ref]$value)) { $result.firmwareVersion = $value } } catch { $result.warnings += ('Firmware: ' + $_.Exception.Message) }
  $value = ''
  try { if ($device.GetPlatform(1, [ref]$value)) { $result.platform = $value } } catch { $result.warnings += ('Platform: ' + $_.Exception.Message) }

  $count = 0
  try { if ($device.GetDeviceStatus(1, 2, [ref]$count)) { $result.userCount = $count } } catch { $result.warnings += ('User count: ' + $_.Exception.Message) }
  $count = 0
  try { if ($device.GetDeviceStatus(1, 3, [ref]$count)) { $result.fingerprintCount = $count } } catch { $result.warnings += ('Fingerprint count: ' + $_.Exception.Message) }
  $count = 0
  try { if ($device.GetDeviceStatus(1, 6, [ref]$count)) { $result.attendanceRecordCount = $count } } catch { $result.warnings += ('Attendance count: ' + $_.Exception.Message) }

  if ($ReadAttendanceSample) {
    try {
      if ($device.ReadGeneralLogData(1)) {
        $enroll = ''; $verifyMode = 0; $inOutMode = 0; $year = 0; $month = 0; $day = 0
        $hour = 0; $minute = 0; $second = 0; $workCode = 0
        if ($device.SSR_GetGeneralLogData(1, [ref]$enroll, [ref]$verifyMode, [ref]$inOutMode, [ref]$year, [ref]$month, [ref]$day, [ref]$hour, [ref]$minute, [ref]$second, [ref]$workCode)) {
          $result.attendanceReadTest = $true
          try { $result.attendanceSampleTime = ([DateTime]::new($year, $month, $day, $hour, $minute, $second)).ToString('s') } catch {}
        }
      }
    } catch {
      $result.warnings += ('Read-only attendance test: ' + $_.Exception.Message)
    }
  }

  if (-not $ReadAttendanceSample) {
    $result.message = 'The device connection succeeded. Device information and counters were checked; attendance records were not read, imported, changed, or deleted.'
  } elseif ($result.attendanceReadTest) {
    $result.message = 'Connection and read-only attendance test succeeded. No attendance record was uploaded, changed, or deleted.'
  } else {
    $result.message = 'The device connection succeeded. Device information was read, but no attendance sample was returned; check whether records exist and whether another program is holding the device.'
  }
  Save-Result 0
} catch {
  $result.message = 'The diagnostic connected but an unexpected SDK error occurred.'
  $result.warnings += $_.Exception.Message
  Save-Result 5
} finally {
  if ($null -ne $device) {
    try { $device.Disconnect() } catch {}
    try { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($device) | Out-Null } catch {}
  }
}
