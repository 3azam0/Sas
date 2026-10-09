import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const checks = { node: process.version, pinnedRuntime: Number(process.versions.node.split('.')[0]) === 24,
  dependenciesInstalled: existsSync('node_modules/next/package.json'), database: 'PGlite embedded PostgreSQL (development only)', port: 3100 };
try { checks.git = execFileSync('git', ['--version'], {encoding:'utf8'}).trim(); } catch { checks.git = 'not available'; }
console.log(JSON.stringify(checks, null, 2));
if (!checks.pinnedRuntime || !checks.dependenciesInstalled) process.exitCode = 1;
