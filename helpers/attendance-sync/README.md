# K14 attendance sync for FooDo

The Windows agent reads the employee roster and raw punches using the registered **32-bit ZKTeco Standalone SDK**. It never reads fingerprint templates, writes device users, changes the device clock, disables the device, or clears records. It does not calculate shifts, lateness, absence or payroll.

## Setup

1. Deploy the additive HR database migration, updated `fodo-api` and matching frontend. Edge Function JWT gateway verification must be disabled as for the existing entry point: browser requests are verified by `accessFor`; machine requests use a separate scoped device token.
2. Sign in to FooDo as owner/manager. Open **الموظفون والحضور → جهاز البصمة → إنشاء اتصال**. Copy the device ID and one-time pairing token. This token can upload only roster names/badges and attendance to that device.
3. On the Windows computer in the K14 LAN, close competing ZKTeco software for the initial test. Run `Setup-AttendanceSync.ps1` in Windows PowerShell. Enter the FooDo HTTPS origin, device ID, LAN address, token and communication key (0 if none). Never paste these into chat or Git.
4. Run the printed command with `-Once` using 32-bit Windows PowerShell. Check the employee count and recent punches against the physical device. Check its clock against Cairo local time before collecting real attendance; the software preserves wall-clock readings exactly and cannot resolve a wrong clock or ambiguous daylight-saving times.
5. Open each imported profile to enter the Arabic name, phone, department, job title and hire date. Device name refreshes never overwrite these profile fields. A saved device/badge binding is immutable. Do not reuse a badge for a different person.
6. After the physical test succeeds, use the installed launcher with the config file to run continuously. For automatic startup, pass `-InstallAtLogon` during initial setup. The task runs as the current interactive user at logon. The PC must stay powered on, logged in and connected to the device LAN and internet. Stop/restart it through Windows Task Scheduler.

## Delivery and recovery

Each scan reads current device logs, queues unseen data in batches of 100, and records progress only after a matching server acknowledgement. Network failures retain the identical encrypted pending batch for retry. Both batch receipts and server event identity prevent duplicate punches after a retry or local progress loss. Identical punches for the same badge, second, verification mode, in/out mode and work code collapse into one event because the SDK provides no stable record ID.

Local configuration, progress and pending data live under `%LOCALAPPDATA%\FooDo\AttendanceSync`. Secrets and queued employee data use Windows user DPAPI. Preserve this directory until pending uploads are accepted. Do not move its encrypted files between computers/users; register a new connection instead. The agent reads all current records again after local progress loss; accepted events deduplicate. It cannot recover device records deleted before their first successful upload.

On a failed request the tool retries without printing response bodies or personal data. Check the device connection using the existing `attendance-diagnostic` tool and check pairing status in FooDo. In FooDo, **إيقاف الاتصال** revokes the token. For a lost token, use **تجديد رمز الربط** on the SAME device, stop the running agent, and run setup with `-UpdatePairing`. This revokes the old token while preserving device identity, profile links and pending uploads.

Imported records remain raw and retain inactive employees and unmatched badge events. Missing profiles are visibly marked in attendance until the roster/profile is imported. The first run includes all attendance currently on the device; there is no separate historical backup import.

The agent does not configure Ethernet automatically. Use the normal branch LAN. A direct cable requires a working subnet configuration, as described in the diagnostic tool. Keep port 4370 on the LAN.
