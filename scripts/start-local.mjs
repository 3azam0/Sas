import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,appendFileSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {acquireFileLock} from './file-lock.mjs';
import {backupDatabase} from './backup-lib.mjs';
const stateDir=resolve(process.env.FODO_LAUNCH_STATE_DIR||'.cache');
const dataDir=resolve(process.env.SAAS_DATA_DIR||'.data-local');
mkdirSync(stateDir,{recursive:true});
const check=process.argv.includes('--check');
const configPath=resolve(stateDir,'local-config.json');
const statePath=resolve(stateDir,'local-preview.json');
const logPath=resolve(stateDir,'local-startup.log');
const build=read(resolve('apps/web/.next/fodo-build.json'));
if(!build?.buildVersion)throw new Error('Build Fodo first: run scripts/run.ps1 build.');
function read(path){try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}}
function log(message){console.log(message);appendFileSync(logPath,message+'\n');}
function openBrowser(url){if(check||process.env.FODO_NO_BROWSER==='1'||process.platform!=='win32')return;const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{stdio:'ignore'});browser.on('error',()=>log(`Open manually: ${url}`));}
function portFromUrl(value){try{const url=new URL(value);return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.pathname==='/'?Number(url.port):null;}catch{return null;}}
async function readyInstance(state){if(!state?.instanceId||state.url!==origin+'/')return false;let body;try{const response=await fetch(origin+'/api/v1/health',{signal:AbortSignal.timeout(1000)});if(!response.ok)return false;body=await response.json();}catch{return false;}if(body.service!=='fodo'||body.instanceId!==state.instanceId)return false;if(body.buildVersion!==build.buildVersion)throw new Error(`Fodo is running an older build at ${origin}/. Stop its server window with Ctrl+C, then start Fodo again. Browser offline data stays at the same address.`);return true;}
const previous=read(statePath);
const config=read(configPath)||{port:Number(process.env.FODO_LOCAL_PORT)||portFromUrl(previous?.url)||3108};
if(!Number.isInteger(config.port)||config.port<1024||config.port>65535)throw new Error('Invalid .cache/local-config.json port.');
if(!existsSync(configPath))writeFileSync(configPath,JSON.stringify(config,null,2),{flag:'wx'});
const origin=`http://127.0.0.1:${config.port}`;
if(await readyInstance(previous)){log(`Fodo is already running: ${origin}/`);openBrowser(origin+'/');}
else {
 let release;
 try{release=acquireFileLock(resolve(stateDir,'fodo-launcher.lock'));}
 catch(error){let state;for(let n=0;n<12;n++){state=read(statePath);if(await readyInstance(state))break;await new Promise(r=>setTimeout(r,250));}if(await readyInstance(state)){log(`Fodo is already running: ${origin}/`);openBrowser(origin+'/');}else{log(error.message);process.exitCode=1;}}
 if(release){
  process.once('exit',release);
  let server;
  try{
   // Probe only the configured port. Never move existing browser data to another origin.
   await new Promise((accept,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(config.port,'127.0.0.1',()=>probe.close(accept));});
   const lastBackup=read(resolve(stateDir,'last-backup.json'));
   if(existsSync(resolve(dataDir,'PG_VERSION'))&&(!lastBackup||!existsSync(lastBackup.path)||!Number.isFinite(Date.parse(lastBackup.createdAt))||Date.now()-Date.parse(lastBackup.createdAt)>86400000)){
    const destination=resolve(`backups/auto-${Date.now()}`);const backup=backupDatabase(dataDir,destination);writeFileSync(resolve(stateDir,'last-backup.json'),JSON.stringify({path:destination,createdAt:backup.createdAt}));log(`Database backup saved: ${destination}`);
   }
   const instanceId=randomUUID();
   server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(config.port)],{cwd:resolve('apps/web'),env:{...process.env,FODO_BUILD_LABEL:build.buildVersion,SAAS_APP_ORIGIN:origin,SAAS_DEMO_MODE:'1',SAAS_DATA_DIR:dataDir,FODO_INSTANCE_ID:instanceId},stdio:['inherit','pipe','pipe']});
   for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{process.stdout.write(chunk);appendFileSync(logPath,chunk);});
   let finished=false,healthy=false;
   const state={url:origin+'/',port:config.port,pid:server.pid,instanceId};writeFileSync(statePath,JSON.stringify(state,null,2));
   server.on('error',error=>{log(error.message);finished=true;release();process.exitCode=1;});
   server.on('exit',code=>{finished=true;release();process.exitCode=check&&healthy?0:code??1;});
   process.on('SIGINT',()=>server.kill());process.on('SIGTERM',()=>server.kill());
   for(let n=0;n<40&&!finished;n++){if(await readyInstance(state)){healthy=true;break;}await new Promise(r=>setTimeout(r,250));}
   if(!healthy){log('Fodo did not become ready. Check .cache/local-startup.log.');server.kill();process.exitCode=1;}
   else{log(`READY — ${origin}/\nKeep this window open. Stop with Ctrl+C.`);if(check)server.kill();else openBrowser(origin+'/');}
  }catch(error){release();log(error.code==='EADDRINUSE'?`Port ${config.port} is occupied by an unverified or older server. Stop its window, then restart Fodo. Your saved address remains ${origin}/.`:error.message);process.exitCode=1;}
 }
}
