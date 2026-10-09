import {test,expect} from '@playwright/test';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

function launch(script:string,env:Partial<NodeJS.ProcessEnv>,args:string[]=[]){
 const child=spawn(process.execPath,[script,...args],{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout!.on('data',b=>output+=b);child.stderr!.on('data',b=>output+=b);
 const exit=new Promise<number>(r=>child.on('exit',code=>r(code??1)));return {child,exit,output:()=>output};
}
async function stop(child:ChildProcess){if(child.exitCode!==null)return;if(process.platform==='win32'){const kill=spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore'});await new Promise(r=>kill.once('exit',r));}else child.kill();}
async function freePort(){const server=createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;await new Promise<void>(r=>server.close(()=>r()));return port;}
const build=JSON.parse(readFileSync('apps/web/.next/fodo-build.json','utf8'));

test('all production start paths reuse the same healthy process and saved origin',async()=>{
 const stateDir=mkdtempSync(resolve('.cache/launch-test-'));const port=await freePort();
 const env={FODO_LAUNCH_STATE_DIR:stateDir,FODO_LOCAL_PORT:String(port),SAAS_DATA_DIR:join(stateDir,'data'),FODO_NO_BROWSER:'1'};
 const first=launch('scripts/next.mjs',env,['start']);
 try{
  await expect.poll(first.output,{timeout:20000}).toContain('READY');
  const before=JSON.parse(readFileSync(join(stateDir,'local-preview.json'),'utf8'));
  const health=await (await fetch(before.url+'api/v1/health')).json();expect(health.buildVersion).toBe(build.buildVersion);
  const second=launch('scripts/start-local.mjs',env,['--check']);expect(await second.exit).toBe(0);expect(second.output()).toContain('already running');
  expect(JSON.parse(readFileSync(join(stateDir,'local-preview.json'),'utf8'))).toEqual(before);
  expect((await fetch(before.url+'api/v1/health')).ok).toBe(true);
 }finally{await stop(first.child);}
});

test('an old Fodo build or unknown occupied port is refused without stopping its owner',async()=>{
 const stateDir=mkdtempSync(resolve('.cache/launch-conflict-'));let old=true;
 const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(old?{service:'fodo',instanceId:'test-old',buildVersion:'old-build'}:{service:'unrelated'}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;const url=`http://127.0.0.1:${port}/`;
 writeFileSync(join(stateDir,'local-config.json'),JSON.stringify({port}));writeFileSync(join(stateDir,'local-preview.json'),JSON.stringify({url,instanceId:'test-old'}));
 try{
  const env={FODO_LAUNCH_STATE_DIR:stateDir,FODO_NO_BROWSER:'1'};
  const stale=launch('scripts/start-local.mjs',env,['--check']);expect(await stale.exit).toBe(1);expect(stale.output()).toContain('older build');
  old=false;const unknown=launch('scripts/start-local.mjs',env,['--check']);expect(await unknown.exit).toBe(1);expect(unknown.output()).toContain('occupied');
  expect((await fetch(url)).ok).toBe(true);expect(JSON.parse(readFileSync(join(stateDir,'local-config.json'),'utf8')).port).toBe(port);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
