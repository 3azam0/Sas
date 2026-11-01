// Explicit, removable trial catalog only. This script never posts stock or sales.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {request} from '@playwright/test';
import {stableId} from './sample-data/seed.mjs';

const origin='https://fodo.am-agent2026.workers.dev',org='707a2ecc-a724-48ad-8e68-32069b308c63';
const directory='.cloud-build/pos-sample-menu',path=directory+'/run.json',mode=process.argv[2]??'prepare';
const choices=[
 ['WS-089','وجبات أولاد سعد'],['WS-090','وجبات أولاد سعد'],['WS-091','وجبات أولاد سعد'],
 ['WS-092','وجبات أولاد سعد'],['WS-093','وجبات أولاد سعد'],['WS-094','وجبات أولاد سعد'],
 ['WS-021','المندي'],['WS-012','مشويات'],['WS-050','مشويات'],
 ['WS-042','أطباق جانبية'],['WS-044','أطباق جانبية'],['WS-072','السلطات']
];
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const effects=s=>({balances:digest([...s.balances].sort((a,b)=>(a.locationId+':'+a.itemId).localeCompare(b.locationId+':'+b.itemId))),sales:digest((s.salesImports??[]).map(r=>r.document.operationId).sort()),finance:digest((s.financeRecords??[]).map(r=>r.command.operationId).sort()),kitchen:digest(s.kitchenTickets??[]),originalMenus:digest((s.menuItems??[]).filter(m=>m.source==='FODO').sort((a,b)=>a.id.localeCompare(b.id)))});
if(!['prepare','apply','verify'].includes(mode))throw Error('Use prepare, apply or verify');
await mkdir(directory,{recursive:true});
const trial=JSON.parse(await readFile('.cloud-build/client-sample/run.json','utf8'));
if(trial.organizationId!==org||!trial.id||!trial.generation)throw Error('Matching local trial record is required');
const owner=JSON.parse(await readFile('.cloud-build/initial-owner.json','utf8')),deviceId=randomUUID();
const client=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin},timeout:30000});
try{
 const login=await client.post('/api/v1/auth/login',{data:{email:owner.email,password:owner.password,deviceId}});
 if(!login.ok())throw Error('Hosted sign-in failed: '+login.status());
 const bootstrap=async()=>{const r=await client.get('/api/v1/bootstrap');if(!r.ok())throw Error('Cannot load workspace: '+r.status());const s=await r.json();if(s.organizationId!==org||s.generation!==trial.generation)throw Error('Trial organization/generation mismatch');return s;};
 let snapshot=await bootstrap(),run;
 try{run=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(run&&(run.organizationId!==org||run.generation!==snapshot.generation||run.trialId!==trial.id))throw Error('Saved sample commands belong to a different trial');
 if(!snapshot.capabilities?.counterPOS)throw Error('Cashier API upgrade is required');
 if(!snapshot.pointsOfSale?.some(p=>p.active&&p.source==='POS'))throw Error('No active POS-source terminal exists');
 if(!run){
  if(mode!=='prepare')throw Error('Prepare and review the sample commands first');
  const kitchenIds=snapshot.kitchens.filter(k=>k.active&&k.locationId).map(k=>k.id).sort();
  if(!kitchenIds.length)throw Error('No active kitchen stock location');
  const createdAt=new Date().toISOString();
  const commands=choices.map(([code,category])=>{
   const original=snapshot.menuItems.find(m=>m.source==='FODO'&&m.code===code&&m.active),version=snapshot.recipeVersions.find(v=>v.versionId===original?.versionId);
   const price=version?.definition.salePrice;
   if(!original||!/^TRIAL-/.test(version?.definition.code??'')||!/^\d+(?:\.\d{1,2})?$/.test(price??''))throw Error('Missing approved trial recipe/price for '+code);
   const sampleCode='SAMPLE-'+code,id=stableId(trial.id,'cashier-menu:'+sampleCode);
   if(snapshot.menuItems.some(m=>m.source==='POS'&&(m.code===sampleCode||m.id===id)))throw Error('Sample mapping already exists without its saved operation record');
   return {operationId:stableId(trial.id,'cashier-command:'+sampleCode),organizationId:org,generation:snapshot.generation,type:'menu.save',expectedRevision:0,capturedAt:createdAt,schemaVersion:1,record:{id,source:'POS',code:sampleCode,name:original.name,versionId:original.versionId,outputPerSale:original.outputPerSale,active:true,sellingPrice:price,category,kitchenIds}};
  });
  run={dataset:'cashier-menu-samples-v1',trialId:trial.id,organizationId:org,generation:snapshot.generation,createdAt,before:effects(snapshot),commands,accepted:[]};
  await writeFile(path,JSON.stringify(run,null,2));
 }
 if(mode==='apply'){
  for(const command of run.commands){
   if(run.accepted.includes(command.operationId))continue;
   if(!snapshot.acceptedOperationIds.includes(command.operationId)){
    let response;
    try{response=await client.post('/api/v1/menu',{headers:{'X-Fodo-Generation':run.generation},data:command});}catch{snapshot=await bootstrap();if(!snapshot.acceptedOperationIds.includes(command.operationId))throw Error('Menu response was interrupted; retry this saved operation');}
    if(response){const result=await response.json();if(!response.ok()||result.outcome!=='accepted'){snapshot=await bootstrap();if(!snapshot.acceptedOperationIds.includes(command.operationId))throw Error(command.record.code+': '+(result.message??result.code??response.status()));}}
   }
   run.accepted.push(command.operationId);await writeFile(path,JSON.stringify(run,null,2));
  }
 }
 if(mode!=='prepare'){
  snapshot=await bootstrap();
  for(const c of run.commands){const m=snapshot.menuItems.find(x=>x.id===c.record.id);if(!m||Object.keys(c.record).some(key=>JSON.stringify(m[key])!==JSON.stringify(c.record[key])))throw Error('Posted sample differs: '+c.record.code);}
  const after=effects(snapshot),unchanged=Object.fromEntries(Object.keys(run.before).map(key=>[key,run.before[key]===after[key]]));
  const report={dataset:run.dataset,trialId:run.trialId,organizationId:org,generation:run.generation,verifiedAt:new Date().toISOString(),sampleCount:run.commands.length,allOperationsAccepted:run.commands.every(c=>snapshot.acceptedOperationIds.includes(c.operationId)),unchanged,terminals:snapshot.pointsOfSale.filter(p=>p.active).map(p=>({name:p.name,source:p.source,kitchenId:p.kitchenId,availableSamples:run.commands.filter(c=>c.record.source===p.source&&c.record.kitchenIds.includes(p.kitchenId)).length})),meals:run.commands.map(c=>({id:c.record.id,code:c.record.code,name:c.record.name,category:c.record.category,sellingPrice:c.record.sellingPrice}))};
  await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));
  if(!report.allOperationsAccepted||Object.values(unchanged).some(v=>!v))throw Error('Review the saved verification report: unexpected workspace change');
  console.log(JSON.stringify(report,null,2));
 }else console.log(JSON.stringify({prepared:run.commands.length,trialId:run.trialId,generation:run.generation,prices:'Existing fictional trial recipe prices',meals:run.commands.map(c=>({code:c.record.code,name:c.record.name,price:c.record.sellingPrice,category:c.record.category}))},null,2));
}finally{owner.password='';await client.post('/api/v1/auth/logout').catch(()=>{});await client.dispose();}
