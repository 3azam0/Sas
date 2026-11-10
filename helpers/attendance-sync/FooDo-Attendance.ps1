$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$script:sourceRoot=$PSScriptRoot
. (Join-Path $PSScriptRoot 'AttendanceSync.Common.ps1')
$script:syncProcess=$null;$script:activePath=$null;$script:saved=$false
$script:orange=[Drawing.ColorTranslator]::FromHtml('#D94B20')
$navy=[Drawing.ColorTranslator]::FromHtml('#172B42')
$paper=[Drawing.ColorTranslator]::FromHtml('#F7F5F0')
$muted=[Drawing.ColorTranslator]::FromHtml('#536476')
$form=New-Object Windows.Forms.Form
$form.Text='FooDo | K14 Attendance Sync'
$form.ClientSize=New-Object Drawing.Size(850,720)
$form.MinimumSize=New-Object Drawing.Size(866,759)
$form.StartPosition='CenterScreen';$form.BackColor=$paper
$form.Font=New-Object Drawing.Font('Segoe UI',10)
$header=New-Object Windows.Forms.Panel
$header.SetBounds(0,0,850,92);$header.BackColor=$navy;$header.Anchor='Top,Left,Right'
$form.Controls.Add($header)
function Add-Text($Parent,[string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height,[int]$Size=10,$Color=$muted,[bool]$Bold=$false){
 $label=New-Object Windows.Forms.Label;$label.Text=$Text;$label.SetBounds($X,$Y,$Width,$Height);$label.ForeColor=$Color
 $style=if($Bold){[Drawing.FontStyle]::Bold}else{[Drawing.FontStyle]::Regular}
 $label.Font=New-Object Drawing.Font('Segoe UI',$Size,$style);$Parent.Controls.Add($label);return $label
}
$logoPath=Join-Path $PSScriptRoot 'foodo-logo.png'
if(-not(Test-Path -LiteralPath $logoPath)){$logoPath=Join-Path $PSScriptRoot '../../apps/web/public/branding/foodo-logo-v1.png'}
if(Test-Path -LiteralPath $logoPath){$logo=New-Object Windows.Forms.PictureBox;$logo.SetBounds(24,17,150,58);$logo.SizeMode='Zoom';$logo.BackColor=[Drawing.Color]::White;$logo.Image=[Drawing.Image]::FromFile([IO.Path]::GetFullPath($logoPath));$header.Controls.Add($logo)}
[void](Add-Text $header 'Attendance Sync' 195 18 500 30 19 ([Drawing.Color]::White) $true)
[void](Add-Text $header 'K14 connection  /  Employee codes  /  Daily attendance' 197 53 600 23 10 ([Drawing.Color]::FromArgb(215,225,235)))
[void](Add-Text $form 'Your device, connected to FooDo.' 26 111 760 32 18 $navy $true)
[void](Add-Text $form 'Save your connection once. Sync automatically or use Sync now whenever you need it.' 27 148 790 24)
$card=New-Object Windows.Forms.Panel;$card.SetBounds(26,184,798,300);$card.BackColor=[Drawing.Color]::White;$card.Anchor='Top,Left,Right';$form.Controls.Add($card)
$script:fields=@{}
function Add-Input([string]$Key,[string]$Label,[int]$X,[int]$Y,[int]$Width,[bool]$Secret=$false){
 [void](Add-Text $card $Label $X $Y $Width 21 9)
 $box=New-Object Windows.Forms.TextBox;$box.SetBounds($X,($Y+24),$Width,28);$box.Font=New-Object Drawing.Font('Segoe UI',11);$box.UseSystemPasswordChar=$Secret;$card.Controls.Add($box);$script:fields[$Key]=$box
}
Add-Input 'server' 'FooDo address' 20 16 365
Add-Input 'deviceId' 'Device ID in FooDo' 405 16 370
Add-Input 'address' 'K14 IP address' 20 83 365
Add-Input 'token' 'Pairing token - leave blank to keep a saved token' 405 83 370 $true
Add-Input 'commKey' 'Device communication key - 0 if none' 20 150 365 $true
[void](Add-Text $card 'Automatic sync interval' 405 150 370 21 9)
$hours=New-Object Windows.Forms.NumericUpDown;$hours.SetBounds(405,174,85,29);$hours.Minimum=1;$hours.Maximum=24;$hours.Value=6;$card.Controls.Add($hours)
[void](Add-Text $card 'hours, plus Windows sign-in' 500 177 275 24 10)
$script:edit=New-Object Windows.Forms.CheckBox;$edit.Text='Allow changes to the saved connection';$edit.SetBounds(20,222,470,26);$card.Controls.Add($edit)
$script:savedLabel=Add-Text $card 'New connection: enter the pairing token and communication key.' 20 260 755 24 9
function New-FodoButton([string]$Text,[int]$X,[int]$Width,[bool]$Primary){
 $button=New-Object Windows.Forms.Button;$button.Text=$Text;$button.SetBounds($X,501,$Width,44);$button.FlatStyle='Flat';$button.FlatAppearance.BorderSize=0;$button.Cursor=[Windows.Forms.Cursors]::Hand
 if($Primary){$button.BackColor=$script:orange;$button.ForeColor=[Drawing.Color]::White}else{$button.BackColor=$navy;$button.ForeColor=[Drawing.Color]::White}
 $button.Font=New-Object Drawing.Font('Segoe UI',11,[Drawing.FontStyle]::Bold);$form.Controls.Add($button);return $button
}
$script:syncButton=New-FodoButton '&Sync now' 26 175 $true
$script:saveButton=New-FodoButton 'Save & enable schedule' 215 260 $false
$script:openButton=New-FodoButton 'Open FooDo' 489 160 $false
$script:status=Add-Text $form 'Ready to connect' 27 558 790 27 11 $navy $true
$script:activity=New-Object Windows.Forms.TextBox;$activity.SetBounds(26,590,798,76);$activity.Multiline=$true;$activity.ReadOnly=$true;$activity.ScrollBars='Vertical';$activity.BackColor=[Drawing.Color]::White;$activity.BorderStyle='FixedSingle';$activity.Anchor='Top,Left,Right';$form.Controls.Add($activity)
[void](Add-Text $form 'This PC must be on, signed in and connected to the K14 LAN and internet. Finger templates are not synced.' 27 682 790 23 9)
$settings=@{server='https://fodo.am-agent2026.workers.dev';deviceId='';address='192.168.123.201';syncEveryHours=6}
$connectionPath=Join-Path $PSScriptRoot 'connection-details.json'
if(Test-Path -LiteralPath $connectionPath){$details=Get-Content -LiteralPath $connectionPath -Raw|ConvertFrom-Json;foreach($k in @('server','deviceId','address','syncEveryHours')){if($null -ne $details.$k){$settings[$k]=$details.$k}}}
if(-not $settings.deviceId){$configs=@(Get-ChildItem -LiteralPath (Get-FodoSyncRoot) -Filter '*.json' -ErrorAction SilentlyContinue|Where-Object BaseName -match '^[a-f0-9-]{36}$');if($configs.Count -eq 1){$settings.deviceId=$configs[0].BaseName}}
if($settings.deviceId){$existingPath=Get-FodoConfigPath ([Guid]$settings.deviceId);if(Test-Path -LiteralPath $existingPath){$existing=Get-Content -LiteralPath $existingPath -Raw|ConvertFrom-Json;foreach($k in @('server','deviceId','address')){$settings[$k]=$existing.$k};if($existing.syncEveryHours){$settings.syncEveryHours=$existing.syncEveryHours};$script:activePath=$existingPath;$script:saved=$true}}
foreach($k in @('server','deviceId','address')){$script:fields[$k].Text=[string]$settings[$k]}
$hours.Value=[Math]::Min(24,[Math]::Max(1,[int]$settings.syncEveryHours))
function Refresh-FodoStatus {
 if($script:activePath){
  $script:savedLabel.Text='Saved on this PC. Credentials stay encrypted; empty fields keep the saved credentials.'
  try{$config=Get-Content -LiteralPath $script:activePath -Raw|ConvertFrom-Json;$taskName='FooDo-Attendance-'+$config.deviceId;$task=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop;$info=$task|Get-ScheduledTaskInfo;$trigger=$task.Triggers|Where-Object {$_.Repetition.Interval}|Select-Object -First 1;$interval=[Xml.XmlConvert]::ToTimeSpan($trigger.Repetition.Interval).TotalHours;$hours.Value=[int]$interval;$script:status.Text='Automatic sync every '+$interval+' hours  |  Next: '+$info.NextRunTime.ToString('dd MMM, h:mm tt')}catch{$script:status.Text='Connection saved. Use Sync now or enable the schedule.'}
  $log=Join-Path (Get-FodoSyncRoot) 'attendance-sync.log';if(Test-Path -LiteralPath $log){$script:activity.Text=(Get-Content -LiteralPath $log -Tail 5)-join [Environment]::NewLine}
 }
 $script:syncButton.Enabled=[bool]$script:activePath
 $script:saveButton.Enabled=(-not $script:saved -or $script:edit.Checked)
}
$script:edit.Add_CheckedChanged({Refresh-FodoStatus})
$script:saveButton.Add_Click({
 try{
  $token=New-Object Security.SecureString;if($script:fields.token.Text){$token=ConvertTo-SecureString $script:fields.token.Text -AsPlainText -Force}
  $key=New-Object Security.SecureString;if($script:fields.commKey.Text){$key=ConvertTo-SecureString $script:fields.commKey.Text -AsPlainText -Force}
  Copy-FodoSyncFiles $script:sourceRoot
  $script:activePath=Save-FodoSyncConfig -Server $script:fields.server.Text.Trim() -DeviceId ([Guid]::Parse($script:fields.deviceId.Text.Trim())) -Address $script:fields.address.Text.Trim() -Token $token -CommKey $key -SyncEveryHours ([int]$hours.Value) -UpdatePairing:$script:edit.Checked
  Install-FodoSyncSchedule -ConfigPath $script:activePath -SyncEveryHours ([int]$hours.Value)
  $script:fields.token.Clear();$script:fields.commKey.Clear();$script:saved=$true;$script:edit.Checked=$false;Refresh-FodoStatus
 }catch{$script:status.Text='Settings need attention';$script:activity.Text=$_.Exception.Message}
})
$script:openButton.Add_Click({try{$origin=[Uri]$script:fields.server.Text.Trim();if(-not $origin.IsAbsoluteUri -or $origin.Scheme -ne 'https' -or $origin.UserInfo){throw 'Use an HTTPS FooDo address.'};Start-Process -FilePath $origin.AbsoluteUri}catch{$script:activity.Text='Open your FooDo HTTPS address in your browser.'}})
$timer=New-Object Windows.Forms.Timer;$timer.Interval=700
$script:syncButton.Add_Click({
 try{
  if(-not $script:activePath){throw 'Save the connection first.'}
  $exe=Join-Path $env:WINDIR 'SysWOW64\WindowsPowerShell\v1.0\powershell.exe';if(-not(Test-Path -LiteralPath $exe)){$exe=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'}
  $runner=Join-Path (Get-FodoSyncRoot) 'Run-ScheduledAttendance.ps1'
  $script:syncProcess=Start-Process -FilePath $exe -ArgumentList @('-NoProfile','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',('"'+$runner+'"'),'-ConfigPath',('"'+$script:activePath+'"')) -WindowStyle Hidden -PassThru
  $script:status.Text='Syncing attendance from K14...';$script:syncButton.Enabled=$false;$script:saveButton.Enabled=$false;$timer.Start()
 }catch{$script:status.Text='Sync could not start';$script:activity.Text=$_.Exception.Message}
})
$timer.Add_Tick({
 if($script:syncProcess -and $script:syncProcess.HasExited){
  $timer.Stop();$code=$script:syncProcess.ExitCode;$script:syncProcess.Dispose();$script:syncProcess=$null;Refresh-FodoStatus
  if($code -eq 0){$script:status.Text='Sync complete. New attendance is available in FooDo.'}else{$script:status.Text='Sync needs attention - check the cable, SDK and pairing.'}
 }
})
$form.Add_FormClosed({$timer.Stop();$timer.Dispose()})
$form.Add_Shown({$form.WindowState=[Windows.Forms.FormWindowState]::Normal;$form.Show();$form.Activate()})
Refresh-FodoStatus
[void]$form.ShowDialog()
