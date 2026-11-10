# K14 attendance sync for FooDo

Version **1.1.0** includes the FooDo desktop window, a **Sync now** button and a configurable schedule (default **every 6 hours**, plus Windows sign-in). Open **Open-FooDo.cmd**. The computer must stay on, signed in and connected to the K14 LAN and internet. Closing the window leaves the Windows schedule enabled. **Update/refresh in the web browser only reads data already uploaded to FooDo; direct device sync requires the Windows tool.**

## Moving to another Windows computer

1. Extract the tool into a permanent folder. Install the vendor's 32-bit ZKTeco Standalone SDK if it is not already registered. The private transfer package may include the supplied vendor SDK folder; no historical MDB or employee files belong in this tool package.
2. Connect the new PC to the same branch LAN. For this direct cable, the K14 is `192.168.123.201:4370`; the current PC uses secondary address `192.168.123.200/24`. The optional `Configure-DirectCable.ps1` helper adds this address to a **dedicated static Ethernet** interface and retains existing addresses. It requires Windows administrator approval and refuses to disable DHCP. Disconnect the old collector before reusing the same laptop address.
3. Keep the **same device ID in FooDo** to retain employee links and attendance. Prepare the second PC without changing the working first PC. When actually switching collectors, stop the old PC's `FooDo-Attendance-<device-id>` task, renew the pairing token on that same FooDo connection, and enter it directly in the new tool. Renewing the token invalidates the old credential.
4. Fill in the FooDo address, existing device ID, K14 IP, pairing token and device communication key, then choose **Save & enable schedule**. Use **Sync now** to verify the first upload and check the last connection time in FooDo.
5. Configuration backups remain in `%LOCALAPPDATA%\FooDo\AttendanceSync\saved-config`. Blank credential fields preserve saved credentials when editing is explicitly enabled. **Do not transfer DPAPI configuration/progress files to another Windows user or computer**; Windows encryption is tied to their original user and machine. The portable connection-details file contains no credentials.

For the command-line alternative, run `Setup-AttendanceSync.ps1 -InstallAtLogon -SyncEveryHours 6`. Dragging a configuration JSON onto `Start-AttendanceSync.cmd` runs one manual scan; opening it without a file opens the FooDo window.

The Windows agent reads the employee roster and raw punches using the registered **32-bit ZKTeco Standalone SDK**. It never reads fingerprint templates, writes device users, changes the device clock, disables the device, or clears records. It does not calculate shifts, lateness, absence or payroll.

## Setup

1. Deploy the additive HR database migration, updated `fodo-api` and matching frontend. Edge Function JWT gateway verification must be disabled as for the existing entry point: browser requests are verified by `accessFor`; machine requests use a separate scoped device token.
2. Sign in to FooDo as owner/manager. Open **الموظفون والحضور → جهاز البصمة → إنشاء اتصال**. Copy the device ID and one-time pairing token. This token can upload only roster names/badges and attendance to that device.
3. On the Windows computer in the K14 LAN, close competing ZKTeco software for the initial test. Run `Setup-AttendanceSync.ps1` in Windows PowerShell. Enter the FooDo HTTPS origin, device ID, LAN address, token and communication key (0 if none). Never paste these into chat or Git.
4. Run the printed command with `-Once` using 32-bit Windows PowerShell. Check the employee count and recent punches against the physical device. Check its clock against Cairo local time before collecting real attendance; the software preserves wall-clock readings exactly and cannot resolve a wrong clock or ambiguous daylight-saving times.
5. Open each imported profile to enter the Arabic name, phone, department, job title and hire date. Device name refreshes never overwrite these profile fields. A saved device/badge binding is immutable. Do not reuse a badge for a different person.
6. After the physical test succeeds, enable the six-hour schedule through the FooDo window or `-InstallAtLogon -SyncEveryHours 6`. Each scheduled/manual scan runs once and exits; the task runs as the current interactive user with limited privileges. Stop/restart it through Windows Task Scheduler. The low-level agent can still run continuously when invoked directly without `-Once`.

## Delivery and recovery

Each scan reads current device logs, queues unseen data in batches of 100, and records progress only after a matching server acknowledgement. Network failures retain the identical encrypted pending batch for retry. Both batch receipts and server event identity prevent duplicate punches after a retry or local progress loss. Identical punches for the same badge, second, verification mode, in/out mode and work code collapse into one event because the SDK provides no stable record ID.

Local configuration, progress and pending data live under `%LOCALAPPDATA%\FooDo\AttendanceSync`. Secrets and queued employee data use Windows user DPAPI. Preserve this directory until pending uploads are accepted. Do not move its encrypted files between computers/users; pair the new computer to the same existing FooDo device instead. The agent reads all current records again after local progress loss; accepted events deduplicate. It cannot recover device records deleted before their first successful upload.

On a failed request the tool retries without printing response bodies or personal data. Check the device connection using the existing `attendance-diagnostic` tool and check pairing status in FooDo. In FooDo, **إيقاف الاتصال** revokes the token. For a lost token, use **تجديد رمز الربط** on the SAME device, stop the running agent, and run setup with `-UpdatePairing`. This revokes the old token while preserving device identity, profile links and pending uploads.

Imported records remain raw and retain inactive employees and unmatched badge events. Missing profiles are visibly marked in attendance until the roster/profile is imported. The first run includes all attendance currently on the device; there is no separate historical backup import.

The sync agent does not configure Ethernet automatically. Use the normal branch LAN or the optional direct-cable helper described above. Keep port 4370 on the LAN.
