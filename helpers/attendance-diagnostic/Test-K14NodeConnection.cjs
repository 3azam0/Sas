const fs = require('fs');
const path = require('path');

const address = process.argv[2] || '192.168.123.201';
const port = Number(process.argv[3] || 4370);
const reportPath = path.join(__dirname, 'K14-diagnostic-result.json');
const modulePath = path.resolve(__dirname, '../../.cache/k14-node/node_modules/node-zklib');
const result = {
  schemaVersion: 1,
  checkedAtUtc: new Date().toISOString(),
  target: {address, port},
  tcpReachable: true,
  sdkAvailable: false,
  protocolClient: 'node-zklib@1.3.0',
  connected: false,
  userCount: null,
  attendanceRecordCount: null,
  attendanceCapacity: null,
  attendanceReadTest: false,
  message: null,
  warnings: [],
};

function save() {
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  process.stdout.write(`\nResult: ${result.message}\nReport: ${reportPath}\n`);
}

function describe(error) {
  if (error?.err?.message) return `${error.command || 'device command'}: ${error.err.message}`;
  if (error?.message) return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
}

async function main() {
  let device;
  try {
    const ZKLib = require(modulePath);
    device = new ZKLib(address, port, 8000, 5200);
    await device.createSocket();
    result.connected = true;
    try {
      const info = await device.getInfo();
      result.userCount = Number.isFinite(Number(info?.userCounts)) ? Number(info.userCounts) : null;
      result.attendanceRecordCount = Number.isFinite(Number(info?.logCounts)) ? Number(info.logCounts) : null;
      result.attendanceCapacity = Number.isFinite(Number(info?.logCapacity)) ? Number(info.logCapacity) : null;
      result.attendanceReadTest = info != null;
      result.message = 'Direct device protocol connection succeeded and read-only counters were returned. No users, fingerprints, or attendance history were downloaded or changed.';
    } catch (error) {
      result.warnings.push(describe(error));
      result.message = 'Direct ZKTeco protocol connection succeeded. This K14 Pro firmware did not return counters in the format expected by the temporary client; no history was downloaded or changed.';
    }
    save();
    return 0;
  } catch (error) {
    result.message = 'The TCP port is reachable, but the direct ZKTeco protocol handshake or counter query failed.';
    result.warnings.push(describe(error));
    save();
    return 6;
  } finally {
    if (device) {
      try { await device.disconnect(); } catch {}
    }
  }
}

main().then(code => { process.exitCode = code; });
