import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
const mode = process.argv[2];
// Every production start uses the same origin, instance guard and database.
if(mode==='start'){await import('./start-local.mjs');}else{
const port = process.env.SAAS_PORT || '3109';
if (!['dev','build','start'].includes(mode)) throw new Error('Unsupported command');
const buildVersion=`0.1.0 / ${new Date().toISOString()}`;
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), mode, ...(mode === 'start' ? [] : ['--webpack']), ...(mode === 'build' ? [] : ['--hostname','127.0.0.1','--port',port])], {
  cwd: resolve('apps/web'), stdio: 'inherit', env: { ...process.env, FODO_BUILD_LABEL:mode==='build'?buildVersion:'development', SAAS_APP_ORIGIN: process.env.SAAS_APP_ORIGIN || `http://127.0.0.1:${port}`, SAAS_DATA_DIR: process.env.SAAS_DATA_DIR || resolve('.data-dev'), SAAS_DEMO_MODE: process.env.SAAS_DEMO_MODE || '1' }
});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit', (code) => {
 if(code===0&&mode==='build')writeFileSync(resolve('apps/web/.next/fodo-build.json'),JSON.stringify({buildVersion,buildId:readFileSync(resolve('apps/web/.next/BUILD_ID'),'utf8').trim()}));
 process.exit(code ?? 1);
});
}
