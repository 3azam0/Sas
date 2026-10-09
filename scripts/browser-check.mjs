import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const port=process.env.TEST_PORT || '3101';
const origin=`http://127.0.0.1:${port}`;
const dataDir=process.env.TEST_DATA_DIR || '.data-browser-test';
const build=JSON.parse(readFileSync('apps/web/.next/fodo-build.json','utf8'));
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',port],{cwd:resolve('apps/web'),env:{...process.env,FODO_BUILD_LABEL:build.buildVersion,SAAS_DEMO_MODE:'1',SAAS_APP_ORIGIN:origin,SAAS_DATA_DIR:resolve(dataDir)},stdio:'inherit'});
let result=1;
try {
  let ready=false;
  // Windows can report the child as ready before the listening socket is
  // reachable from this process. Give the production server a short, bounded
  // warm-up window before treating it as a failure.
  let lastError='';
  for(let i=0;i<30;i++) {try{const response=await fetch(origin+'/',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}lastError=`HTTP ${response.status}`;}catch(error){lastError=error?.message||String(error);}await new Promise(r=>setTimeout(r,250));}
  if(!ready)console.error(`Readiness probe failed for ${origin}: ${lastError}`);
  if(!ready)throw new Error('Local server was not reachable from the test runner');
  const tests=spawn(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test'],{stdio:'inherit',env:{...process.env,TEST_ORIGIN:origin}});
  result=await new Promise(r=>tests.on('exit',code=>r(code??1)));
} finally {
  if(process.platform==='win32')await new Promise(r=>{const cleanup=spawn('taskkill',['/pid',String(server.pid),'/t','/f'],{stdio:'ignore'});cleanup.on('exit',r);});
  else server.kill('SIGTERM');
}
process.exitCode=result;
