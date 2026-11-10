param([ValidatePattern('^[\p{L}\p{N} _.()-]{1,80}$')][string]$InterfaceAlias='Ethernet',[string]$LaptopAddress='192.168.123.200')
$ErrorActionPreference='Stop'
$ip=$null
if(-not [Net.IPAddress]::TryParse($LaptopAddress,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Enter a valid local IPv4 address.'}
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
 $args='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -InterfaceAlias "'+$InterfaceAlias+'" -LaptopAddress '+$ip.ToString()
 $process=Start-Process -FilePath "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $args -Verb RunAs -WindowStyle Hidden -PassThru -Wait
 exit $process.ExitCode
}
try{
 $adapter=Get-NetAdapter -Name $InterfaceAlias -ErrorAction Stop
 if($adapter.Status -ne 'Up'){throw 'Connect the Ethernet cable first.'}
 if((Get-NetIPInterface -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4).Dhcp -eq 'Enabled'){throw 'This adapter uses DHCP. Configure a dedicated static Ethernet connection or use the normal branch LAN; this helper will not disable DHCP.'}
 if(-not(Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4|Where-Object IPAddress -eq $ip.ToString())){
  New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $ip.ToString() -PrefixLength 24 -AddressFamily IPv4|Out-Null
 }
 Add-Type -AssemblyName System.Windows.Forms
 [void][Windows.Forms.MessageBox]::Show('Direct cable address is ready. Existing Ethernet addresses, Wi-Fi, DNS and gateway settings were retained.','FooDo attendance')
}catch{
 Add-Type -AssemblyName System.Windows.Forms
 [void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'FooDo attendance - network setup')
 exit 1
}
