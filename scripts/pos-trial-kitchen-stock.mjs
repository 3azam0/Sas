import {request} from '@playwright/test';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {stableId} from './sample-data/seed.mjs';
import {finishSql} from './sample-data/admin.mjs';

// Explicitly scoped to the current fictional first-client trial, never a reset
// or a stock receipt. The normal API preserves stock valuation and audit history.
const mode=process.argv[2],org='707a2ecc-a724-48ad-8e68-32069b308c63',origin='https://fodo.am-agent2026.workers.dev';
const directory='.cache/pos-trial-kitchen',path=directory+'/run.json',servings=2;
if(!['prepare','apply','verify','replenish'].includes(mode))throw Error('Use prepare, apply, verify or replenish --approved-test-receipt');
if(mode==='replenish'&&!process.argv.includes('--approved-test-receipt'))throw Error('A separate explicit user approval is required for a temporary receiving document');
await mkdir(directory,{recursive:true});
await build({stdin:{contents:"export {salesStockOptions} from './packages/domain/recipes'; export {decimal} from './packages/domain/index'; export {kitchenIssueSchema,receiptDocumentSchema} from './packages/contracts/index';",resolveDir:process.cwd(),loader:'ts'},outfile:directory+'/domain.mjs',bundle:true,platform:'node',format:'esm',target:'es2022',tsconfig:'tsconfig.json',logLevel:'warning'});
const {salesStockOptions,decimal,kitchenIssueSchema,receiptDocumentSchema}=await import(pathToFileURL(resolve(directory+'/domain.mjs')).href);
const trial=JSON.parse(await readFile('.cloud-build/client-sample/run.json','utf8'));
assert.equal(trial.organizationId,org);assert.ok(trial.id&&trial.generation);
const owner=JSON.parse(await readFile('.cloud-build/initial-owner.json','utf8'));
const client=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin},timeout:30000});
const digest=value=>createHash('sha256').update(JSON.stringify([...value].map(r=>JSON.stringify(r)).sort())).digest('hex');
const unchanged=s=>Object.fromEntries(['salesImports','financeRecords','kitchenTickets','menuItems','recipes','recipeVersions','pointsOfSale','kitchens','locations','items','units','suppliers'].map(key=>[key,digest(s[key]??[])]));
const balance=(s,locationId,itemId)=>s.balances.find(b=>b.locationId===locationId&&b.itemId===itemId)??{locationId,itemId,quantity:'0',value:'0'};
const key=b=>JSON.stringify([b.locationId,b.itemId]);
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
try{
 const login=await client.post('/api/v1/auth/login',{data:{email:owner.email,password:owner.password,deviceId:randomUUID()}});
 assert.equal(login.ok(),true,'Existing owner sign-in failed: '+login.status());
 const bootstrap=async()=>{const r=await client.get('/api/v1/bootstrap');assert.equal(r.ok(),true,'Cannot load workspace');const s=await r.json();assert.equal(s.organizationId,org);assert.equal(s.generation,trial.generation);return s;};
 let s=await bootstrap(),run;
 if(mode==='replenish'){
  const planned=JSON.parse(await readFile(directory+'/replenishment.json','utf8')),doc=planned.command;
  assert.equal(planned.organizationId,org);assert.equal(planned.generation,s.generation);assert.equal(planned.trialId,trial.id);
  if(!s.acceptedOperationIds.includes(doc.operationId)){
   assert.deepEqual(unchanged(s),planned.beforeUnchanged);assert.equal(digest(s.balances),digest(planned.beforeBalances),'Stock changed since the receipt was prepared');
   let response;
   try{response=await client.post('/api/v1/receipts',{headers:{'X-Fodo-Generation':s.generation},data:doc});}catch{ s=await bootstrap();if(!s.acceptedOperationIds.includes(doc.operationId))throw Error('Receipt response interrupted; retry its saved operation ID'); }
   if(response){const result=await response.json();if(!response.ok()||result.outcome!=='accepted'){s=await bootstrap();if(!s.acceptedOperationIds.includes(doc.operationId))throw Error('Receipt not confirmed: '+(result.message??result.code??response.status()));}}
   s=await bootstrap();
  }
  const posted=s.receipts.find(r=>r.document.operationId===doc.operationId);assert.ok(posted&&s.acceptedOperationIds.includes(doc.operationId));assert.deepEqual(posted.document,doc);assert.deepEqual(unchanged(s),planned.beforeUnchanged);
  const expected=new Map(planned.beforeBalances.map(b=>[key(b),{...b}]));let amount=decimal('0');
  for(const line of doc.lines){const old=balance({balances:[...expected.values()]},doc.locationId,line.itemId),value=decimal(line.quantity).mul(line.unitCost);amount=amount.add(value);expected.set(key(old),{...old,quantity:decimal(old.quantity).add(line.quantity).toString(),value:decimal(old.value).add(value).toString()});}
  for(const k of new Set([...expected.keys(),...s.balances.map(key)])){const before=expected.get(k)??{quantity:'0',value:'0'},after=s.balances.find(b=>key(b)===k)??{quantity:'0',value:'0'};assert.ok(decimal(before.quantity).eq(after.quantity),'Receipt quantity mismatch '+k);assert.ok(decimal(before.value).eq(after.value),'Receipt value mismatch '+k);}
  assert.ok(decimal(posted.amount).eq(amount));assert.equal(s.receipts.filter(r=>r.document.operationId===doc.operationId).length,1);
  planned.verification={verifiedAt:new Date().toISOString(),operationId:doc.operationId,reference:doc.reason,materials:doc.lines.length,amount:posted.amount,nonStockDataUnchanged:true,oneAcceptedDocument:true};planned.needsUserChoice=false;
  await writeFile(directory+'/replenishment.json',JSON.stringify(planned,null,2));
  const manifest=JSON.parse(await readFile('.cloud-build/client-sample/manifest.json','utf8'));manifest.qibliPOSReplenishment={...planned.verification,operationIds:[doc.operationId,...doc.lines.map(l=>l.lineId)]};await writeFile('.cloud-build/client-sample/manifest.json',JSON.stringify(manifest,null,2));await writeFile('.cloud-build/client-sample/finish.sql',finishSql(org,trial.id,manifest));
  console.log(JSON.stringify(planned.verification,null,2));
 }else{
 try{run=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!run){
  assert.equal(mode,'prepare','Prepare the transfer before applying');
  const kitchen=s.kitchens.find(k=>k.id==='71518ce2-c2eb-4171-b310-e4be415ca961');
  assert.ok(kitchen?.active&&kitchen.name==='المطبخ القبلي'&&kitchen.locationId&&kitchen.parentLocationId);
  const source=s.locations.find(l=>l.id===kitchen.parentLocationId);assert.ok(source?.active!==false&&source?.name==='المخزن الرئيسي');
  assert.ok(s.pointsOfSale.some(p=>p.name==='قبلي'&&p.active&&p.kitchenId===kitchen.id));
  const menus=s.menuItems.filter(m=>m.active&&m.source==='POS'&&m.code.startsWith('SAMPLE-WS-')&&m.kitchenIds?.includes(kitchen.id));assert.equal(menus.length,12);
  const needs=new Map();
  for(const menu of menus){
   const version=s.recipeVersions.find(v=>v.versionId===menu.versionId);assert.ok(version&&version.definition.effectiveDate<=day());
   assert.ok(menu.sellingPrice!==undefined);
   for(const r of salesStockOptions(version.recipeId,version.definition,s.recipeVersions))needs.set(r.itemId,decimal(needs.get(r.itemId)??'0').add(decimal(r.quantity).mul(servings).mul(menu.outputPerSale).div(version.definition.outputQuantity)).toString());
  }
  const operationId=stableId(trial.id,'qibli-pos-trial-stock-v1'),lines=[],summary=[],shortages=[];
  for(const [itemId,required] of [...needs].sort(([a],[b])=>a.localeCompare(b))){
   const target=decimal(required).toDecimalPlaces(6,0),destination=balance(s,kitchen.locationId,itemId),quantity=target.sub(destination.quantity);
   if(quantity.lte(0))continue;
   const item=s.items.find(i=>i.id===itemId);assert.ok(item?.active!==false&&item?.unitId,'Active ingredient required');
   const available=balance(s,source.id,itemId);
   if(decimal(available.quantity).lt(quantity))shortages.push({itemId,name:item.name,unit:item.unit,needed:quantity.toFixed(6),available:available.quantity,missing:quantity.sub(available.quantity).toFixed(6),otherLocations:s.balances.filter(b=>b.itemId===itemId&&decimal(b.quantity).gt(0)).map(b=>({location:s.locations.find(l=>l.id===b.locationId)?.name,quantity:b.quantity})),lastReceipt:s.receiptPrices?.find(p=>p.locationId===source.id&&p.itemId===itemId)});
   lines.push({lineId:stableId(operationId,itemId),itemId,unitId:item.unitId,quantity:quantity.toFixed(6)});
   summary.push({itemId,name:item.name,unit:item.unit,quantity:quantity.toFixed(6),target:target.toFixed(6),sourceBefore:available.quantity,destinationBefore:destination.quantity});
  }
  if(shortages.length){
   const details={source:source.name,kitchen:kitchen.name,servingsPerSample:servings,shortages};
   await writeFile(directory+'/shortages.json',JSON.stringify(details,null,2));await writeFile(directory+'/transfer-preview.json',JSON.stringify(summary,null,2));
   if(shortages.every(r=>r.lastReceipt?.unitCost)){
    const receiptId=stableId(trial.id,'qibli-pos-trial-restock-v1');
    const command=receiptDocumentSchema.parse({operationId:receiptId,organizationId:org,generation:s.generation,locationId:source.id,type:'receipt.document',businessDate:day(),reason:'TRIAL-QIBLI-RESTOCK-20261022',capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:shortages.map(r=>({lineId:stableId(receiptId,r.itemId),itemId:r.itemId,unitId:s.items.find(i=>i.id===r.itemId).unitId,quantity:r.missing,unitCost:decimal(r.lastReceipt.unitCost).toFixed(6)}))});
    let saved;try{saved=JSON.parse(await readFile(directory+'/replenishment.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!saved)await writeFile(directory+'/replenishment.json',JSON.stringify({organizationId:org,generation:s.generation,trialId:trial.id,needsUserChoice:true,beforeBalances:s.balances,beforeUnchanged:unchanged(s),command},null,2));
   }
   console.log(JSON.stringify(details,null,2));throw Error('Warehouse shortages must be resolved before preparing a transfer');
  }
  assert.ok(lines.length>0&&lines.length<=200,'No transfer is needed or too many ingredients');
  const command=kitchenIssueSchema.parse({operationId,organizationId:org,generation:s.generation,type:'kitchen.transfer',locationId:source.id,destinationLocationId:kitchen.locationId,kitchenId:kitchen.id,kitchen:kitchen.name,businessDate:day(),reference:'TRIAL-QIBLI-POS-20261022',notes:'مخزون تجريبي مؤقت لتجربة حصتين من كل صنف في قائمة الكاشير. يشمل المكونات غير المحددة للخصم لمراجعة التكلفة.',capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines});
  run={dataset:'qibli-pos-trial-stock-v1',trialId:trial.id,organizationId:org,generation:s.generation,preparedAt:new Date().toISOString(),servingsPerSample:servings,menuIds:menus.map(m=>m.id).sort(),beforeUnchanged:unchanged(s),beforeBalances:s.balances,beforeKitchenDocuments:(s.kitchenIssues??[]).map(r=>r.document.operationId),command,summary};
  await writeFile(path,JSON.stringify(run,null,2));
 }
 assert.equal(run.trialId,trial.id);assert.equal(run.organizationId,org);assert.equal(run.generation,s.generation);
 if(mode==='prepare'){console.log(JSON.stringify({prepared:true,reference:run.command.reference,operationId:run.command.operationId,source:s.locations.find(l=>l.id===run.command.locationId)?.name,kitchen:run.command.kitchen,menuCount:run.menuIds.length,servingsPerSample:run.servingsPerSample,materials:run.summary},null,2));}
 else{
  if(mode==='apply'&&!s.acceptedOperationIds.includes(run.command.operationId)){
   assert.deepEqual(unchanged(s),run.beforeUnchanged,'Configuration or business records changed; review the prepared transfer');
   assert.equal(digest(s.balances),digest(run.beforeBalances),'Stock changed since preparation; review before applying');
   let response;
   try{response=await client.post('/api/v1/kitchen-issues',{headers:{'X-Fodo-Generation':s.generation},data:run.command});}catch{ s=await bootstrap();if(!s.acceptedOperationIds.includes(run.command.operationId))throw Error('Response interrupted; rerun the saved command, never prepare a new ID'); }
   if(response){const result=await response.json();if(!response.ok()||result.outcome!=='accepted'){s=await bootstrap();if(!s.acceptedOperationIds.includes(run.command.operationId))throw Error('Transfer not confirmed: '+(result.message??result.code??response.status()));}}
   s=await bootstrap();
  }
  const posted=s.kitchenIssues.find(r=>r.document.operationId===run.command.operationId);assert.ok(posted&&s.acceptedOperationIds.includes(run.command.operationId),'Transfer is not accepted');
  assert.deepEqual(posted.document,run.command);assert.deepEqual(unchanged(s),run.beforeUnchanged,'Unexpected non-stock change');
  const expected=new Map(run.beforeBalances.map(b=>[key(b),{...b}]));
  for(const line of posted.lines){
   const source=balance({balances:[...expected.values()]},run.command.locationId,line.itemId),destination=balance({balances:[...expected.values()]},run.command.destinationLocationId,line.itemId);
   expected.set(key(source),{...source,quantity:decimal(source.quantity).sub(line.quantity).toString(),value:decimal(source.value).sub(line.amount).toString()});
   expected.set(key(destination),{...destination,quantity:decimal(destination.quantity).add(line.quantity).toString(),value:decimal(destination.value).add(line.amount).toString()});
  }
  for(const k of new Set([...expected.keys(),...s.balances.map(key)])){
   const before=expected.get(k)??{quantity:'0',value:'0'},after=s.balances.find(b=>key(b)===k)??{quantity:'0',value:'0'};
   assert.ok(decimal(before.quantity).eq(after.quantity),'Quantity mismatch '+k);assert.ok(decimal(before.value).eq(after.value),'Value mismatch '+k);
  }
  assert.equal(s.kitchenIssues.filter(r=>r.document.operationId===run.command.operationId).length,1);
  assert.equal(s.kitchenIssues.length,run.beforeKitchenDocuments.length+1);
  const report={verifiedAt:new Date().toISOString(),operationId:run.command.operationId,reference:run.command.reference,kitchen:run.command.kitchen,materials:posted.lines.length,menuCount:run.menuIds.length,servingsPerSample:run.servingsPerSample,amount:posted.amount,quantityAndValueConserved:true,nonStockDataUnchanged:true,oneAcceptedDocument:true};
  run.verification=report;await writeFile(path,JSON.stringify(run,null,2));await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));
  const manifest=JSON.parse(await readFile('.cloud-build/client-sample/manifest.json','utf8'));
  manifest.qibliPOSStock={...report,operationIds:[run.command.operationId,...run.command.lines.map(l=>l.lineId)],itemIds:run.command.lines.map(l=>l.itemId),menuIds:run.menuIds};
  await writeFile('.cloud-build/client-sample/manifest.json',JSON.stringify(manifest,null,2));await writeFile('.cloud-build/client-sample/finish.sql',finishSql(org,trial.id,manifest));
  console.log(JSON.stringify(report,null,2));
 }
 }
}finally{owner.password='';await client.post('/api/v1/auth/logout').catch(()=>{});await client.dispose();}
