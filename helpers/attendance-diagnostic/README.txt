FooDo K14 Pro connection diagnostic

Purpose
-------
This is a read-only test for a ZKTeco K14 Pro attendance device. It checks:
1. Network access to 192.168.123.201 on TCP port 4370.
2. Whether the ZKTeco Standalone SDK (zkemkeeper) is installed.
3. Whether the SDK can connect and read device information and counts.
4. Whether one attendance record can be read without saving the employee ID.

The tool does not upload data to FooDo, register fingerprints, change device
settings, clear attendance records, or import attendance history.

How to run
----------
1. Copy this folder to the Windows PC where the current ZKTeco software works.
2. Temporarily close the ZKTeco attendance software so it does not hold the device.
3. If the PC and device are connected through the normal branch network, double-click
   Run-K14-Diagnostic.cmd. Administrator rights are not normally needed.
4. If the device cable is connected directly to the PC and Windows shows a 169.254.x.x
   Ethernet address, double-click Run-K14-DirectCable.cmd and approve the Windows UAC
   prompt. It temporarily adds 192.168.123.200/24 and removes it after the test.
5. Send K14-diagnostic-result.json back for review. It does not contain the device
   serial number, MAC address, fingerprint template, or employee ID.

For this development test only, the direct-cable runner may use the temporary
node-zklib package under .cache/k14-node when the official Windows COM SDK is not
registered. That fallback reads device counters only; it does not download users
or attendance history and is not the final production-agent dependency choice.

If the device IP changes, open PowerShell in this folder and run:
  .\Test-K14Connection.ps1 -Address 192.168.123.201 -Port 4370

If the device has a non-zero communication key, add:
  -CommKey 1234

Exit codes
----------
0 = connection and diagnostic completed
2 = network/port unreachable
3 = ZKTeco SDK unavailable in this Windows process
4 = SDK connection rejected (often communication key or another open program)
5 = unexpected SDK error
6 = direct protocol handshake or read-only counter query failed

Security
--------
Keep port 4370 inside the branch LAN. Do not expose it on the public internet.
Do not send the device serial number or communication key in public messages.
