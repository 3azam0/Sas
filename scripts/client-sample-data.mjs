import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {request} from '@playwright/test';
import {captureSql,cleanupSql,finishSql} from './sample-data/admin.mjs';
const directory='.cloud-build/client-sample',statePath=directory+'/run.json',origin='https://fodo.am-agent2026.workers.dev',organizationId='707a2ecc-a724-48ad-8e68-32069b308c63';
const mode=process.argv[2];await mkdir(directory,{recursive:true});
if(mode==='cleanup'){
 const run=JSON.parse(await readFile(statePath,'utf8'));await writeFile(directory+'/cleanup.sql',cleanupSql(run.organizationId,run.id));console.log('Prepared cleanup SQL only. Execute through the authorized administrative connector when the trial is finished.');process.exit(0);
}
if(!['prepare','seed','verify'].includes(mode))throw Error('Use prepare, seed, verify or cleanup');
const owner=JSON.parse(await readFile('.cloud-build/initial-owner.json','utf8')),deviceId=randomUUID(),client=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin,'X-Fodo-Device':deviceId}});
try{
 const login=await client.post('/api/v1/auth/login',{data:{email:owner.email,password:owner.password,deviceId}});if(!login.ok())throw Error('Hosted sign-in failed');
 const bootstrap=async()=>{const r=await client.get('/api/v1/bootstrap');if(!r.ok())throw Error('Bootstrap failed '+r.status());const s=await r.json();if(s.organizationId!==organizationId)throw Error('Unexpected organization');return s;};
 const snapshot=await bootstrap();
 if(mode==='prepare'){
  try{await readFile(statePath);throw Error('Existing run file; inspect it before preparing another trial');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(snapshot.entries.length||snapshot.recipes?.length||snapshot.menuItems?.length)throw Error('Operational baseline is not empty');
  const run={id:randomUUID(),organizationId,origin,originalGeneration:snapshot.generation,createdAt:new Date().toISOString(),commands:{},accepted:[]};
  await writeFile(statePath,JSON.stringify(run,null,2));await writeFile(directory+'/baseline-snapshot.json',JSON.stringify(snapshot,null,2));await writeFile(directory+'/capture.sql',captureSql(organizationId,run.id));await writeFile(directory+'/cleanup.sql',cleanupSql(organizationId,run.id));
  console.log(JSON.stringify({runId:run.id,items:snapshot.items.length,locations:snapshot.locations,units:snapshot.units,materials:snapshot.items.filter(i=>/أرز|رز |لحم|ضاني|كندوز|فراخ|دجاج|حمام|كوارع|عكاوي|كبد|سكر|ملح|فلفل|زيت|سمن|بصل|طماطم|حليب|لبن|مكرون|فول|فلافل|عدس|عيش|طحين|دقيق|بامية|ملوخية|بطاط|بسلة|سبانخ|مربى|عسل|ورق عنب|فريك|زبدة|زبده/.test(i.name)).map(i=>({id:i.id,name:i.name,unit:i.unit}))},null,2));
 }else if(mode==='seed'){
  const run=JSON.parse(await readFile(statePath,'utf8')),trialGeneration=process.argv[3];if(!trialGeneration||snapshot.generation!==trialGeneration||snapshot.generation===run.originalGeneration)throw Error('Verified trial generation required');
  if(run.generation&&run.generation!==trialGeneration)throw Error('Run generation mismatch');run.generation=trialGeneration;await writeFile(statePath,JSON.stringify(run,null,2));
  const {seedClientSample}=await import('./sample-data/seed.mjs'),baseline=JSON.parse(await readFile(directory+'/baseline-snapshot.json','utf8'));
  const manifest=await seedClientSample({snapshot:{...baseline,generation:run.generation},run,bootstrap,async post(key,route,fields){
   let c=run.commands[key];if(!c){c={...fields,operationId:fields.operationId,organizationId,generation:run.generation,capturedAt:run.createdAt,schemaVersion:1};run.commands[key]=c;await writeFile(statePath,JSON.stringify(run,null,2));}
   if(run.accepted.includes(key))return;
   const response=await client.post('/api/v1/'+route,{headers:{'X-Fodo-Generation':run.generation},data:c});const body=await response.json();
   if(!response.ok()||body.outcome!=='accepted'){
    if(response.status()<500||!(await bootstrap()).acceptedOperationIds.includes(c.operationId))throw Error(key+': '+JSON.stringify(body));
    console.log('Confirmed server acceptance after response timeout: '+key);
   }
   run.accepted.push(key);await writeFile(statePath,JSON.stringify(run,null,2));
   if(run.accepted.length%20===0)console.log('Accepted '+run.accepted.length+' sample operations');
  }});
  await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(directory+'/finish.sql',finishSql(organizationId,run.id,manifest));const {menu,materialIds,operationIds,...summary}=manifest;console.log(JSON.stringify({...summary,acceptedOperations:operationIds.length},null,2));
 }else{
  const summary={items:snapshot.items.length,suppliers:snapshot.suppliers.length,recipes:snapshot.recipes.length,menuItems:snapshot.menuItems.length,productions:snapshot.productions.length,purchases:snapshot.purchaseOrders.length,returns:snapshot.supplierReturns.length,counts:snapshot.counts.length,salesImports:snapshot.salesImports.length,shortageImports:snapshot.salesImports.filter(x=>x.stockShortages?.length).length,recentMovements:snapshot.entries.length,reconciliationMatches:snapshot.reconciliation.every(x=>x.matches),negativeBalances:snapshot.balances.filter(x=>Number(x.quantity)<0).length};
  await writeFile(directory+'/verification.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
 }
}finally{await client.post('/api/v1/auth/logout').catch(()=>{});await client.dispose();}
