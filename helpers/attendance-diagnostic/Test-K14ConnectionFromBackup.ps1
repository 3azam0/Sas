param(
  [Parameter(Mandatory = $true)][string]$DatabasePath,
  [string]$Address = '192.168.123.201',
  [int]$Port = 4370
)

$ErrorActionPreference = 'Stop'
$connection = New-Object -ComObject ADODB.Connection
$connection.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$DatabasePath;Mode=Read;")
try {
  $safeAddress = $Address.Replace("'", "''")
  $command = New-Object -ComObject ADODB.Command
  $command.ActiveConnection = $connection
  $command.CommandText = "SELECT TOP 1 [CommPassword] FROM [Machines] WHERE [IP]='$safeAddress'"
  $recordset = $command.Execute()
  try {
    $commKey = 0
    if (-not $recordset.EOF -and $null -ne $recordset.Fields.Item(0).Value -and $recordset.Fields.Item(0).Value -isnot [System.DBNull]) {
      $commKey = [int]$recordset.Fields.Item(0).Value
    }
  } finally {
    $recordset.Close()
  }
} finally {
  $connection.Close()
}

& (Join-Path $PSScriptRoot 'Test-K14Connection.ps1') -Address $Address -Port $Port -CommKey $commKey
exit $LASTEXITCODE
