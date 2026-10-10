import {recipeCommandSchema,type RecipeCommand,type Recipe} from '@saas/contracts';
import {validateRecipe} from '../../../packages/domain/recipes';
import {receiptDocumentSchema,type ReceiptDocument} from '@saas/contracts';
import {countCommandSchema,type CountCommand,type StockCount,type CountDefinition} from '@saas/contracts';
import {decimal} from '@saas/domain';
import Dexie,{type Table} from 'dexie';
import {z} from 'zod';
import {transferCommandSchema,type TransferCommand,type Transfer} from '@saas/contracts';
import {commandSchema,setupCommandSchema,openingSchema,purchaseCommandSchema,type PurchaseCommand,type PurchaseOrder,type ReturnSource,type OpeningDocument,type SetupCommand,type Command,type DemoProfile,type Snapshot,type CommandResult} from '@saas/contracts';
export type LocalCommand={id:string;scope:DemoProfile;command:Command;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled'|'superseded';error?:string;createdAt:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string;resolvedAt?:string;resolution?:string};
export type LocalSetup={id:string;scope:DemoProfile;command:SetupCommand;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled';createdAt:string;error?:string;sourceDeviceId?:string};
export type LocalOpening={id:string;scope:DemoProfile;document:OpeningDocument;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
class LocalDatabase extends Dexie {
 snapshots!:Table<Snapshot,DemoProfile>;commands!:Table<LocalCommand,string>;preferences!:Table<{key:string;value:string},string>;
 setups!:Table<LocalSetup,string>;
 recipes!:Table<LocalRecipe,string>;receipts!:Table<LocalReceipt,string>;openings!:Table<LocalOpening,string>;purchases!:Table<LocalPurchase,string>;transfers!:Table<LocalTransfer,string>;counts!:Table<LocalCount,string>;
 constructor(name='restaurant-saas-v1'){super(name);this.version(1).stores({snapshots:'organizationId',commands:'id,scope,status,createdAt',preferences:'key'});this.version(2).stores({setups:'id,scope,status,createdAt'});this.version(3).stores({openings:'id,scope,status,createdAt'});this.version(4).stores({purchases:'id,scope,status,createdAt'});this.version(5).stores({transfers:'id,scope,status,createdAt'});this.version(6).stores({counts:'id,scope,status,createdAt'});this.version(7).stores({receipts:'id,scope,status,createdAt'});this.version(8).stores({recipes:'id,scope,status,createdAt'});}
}
export const local=new LocalDatabase();
function requireGrant(snapshot:Snapshot|undefined){if(!snapshot||!Number.isFinite(Date.parse(snapshot.access.expiresAt))||Date.parse(snapshot.access.expiresAt)<=Date.now())throw new Error('انتهت صلاحية العمل دون اتصال. جدد الجلسة عبر الإنترنت؛ عملياتك محفوظة.');return snapshot;}
function bindGeneration(snapshot:Snapshot,command:{generation?:string}){if(command.generation&&command.generation!==snapshot.generation)throw new Error('العملية تخص بيانات قبل إعادة التطوير. حدّث الشاشة.');if(snapshot.generation)command.generation=snapshot.generation;}
export async function saveCommand(command:Command){command=commandSchema.parse(command);await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{const snapshot=requireGrant(await local.snapshots.get(command.organizationId));bindGeneration(snapshot,command);if((await identityOwners()).has(command.operationId)||await local.setups.get(command.operationId)||(await local.openings.toArray()).some(o=>o.id===command.operationId||o.document.lines.some(l=>l.lineId===command.operationId)))throw new Error('معرّف العملية مستخدم بالفعل.');await local.commands.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot.access.deviceId});});}
export function projectSetup(snapshot:Snapshot,rows:LocalSetup[]):Snapshot{
 const result={...snapshot,items:[...snapshot.items],locations:[...snapshot.locations],units:[...(snapshot.units??[])],suppliers:[...(snapshot.suppliers??[])]};
 const pending=rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id));
 const priority={'unit.save':0,'location.save':1,'supplier.save':1,'item.save':2};
 for(const row of pending.sort((a,b)=>priority[a.command.type]-priority[b.command.type]||a.createdAt.localeCompare(b.createdAt))){const c=row.command;const revision=c.expectedRevision+1;
  if(c.type==='unit.save'){result.units=result.units.filter(x=>x.id!==c.record.id).concat({...c.record,revision});}
  if(c.type==='supplier.save'){result.suppliers=result.suppliers.filter(x=>x.id!==c.record.id).concat({...c.record,revision});}
  if(c.type==='location.save'){result.locations=result.locations.filter(x=>x.id!==c.record.id).concat({...c.record,revision});}
  if(c.type==='item.save'){result.items=result.items.filter(x=>x.id!==c.record.id).concat({...c.record,unit:result.units.find(u=>u.id===c.record.unitId)?.name??'—',revision});}
 }
 result.items=result.items.map(i=>({...i,unit:result.units.find(u=>u.id===i.unitId)?.name??i.unit}));
 return result;
}
export async function saveSetup(input:SetupCommand){
 const command=setupCommandSchema.parse(input);
 await local.transaction('rw',[local.setups,local.snapshots,local.commands,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  bindGeneration(requireGrant(await local.snapshots.get(command.organizationId)),command);
  const rows=await local.setups.where('scope').equals(command.organizationId).toArray();
  if(rows.some(r=>r.command.type===command.type&&r.command.record.id===command.record.id&&(r.status==='pending'||r.status==='acceptedAwaiting')))throw new Error('يوجد تعديل محفوظ لهذا السجل. زامنه أولاً قبل تعديل جديد.');
  if((await identityOwners()).has(command.operationId)||await local.commands.get(command.operationId)||(await local.openings.toArray()).some(o=>o.id===command.operationId||o.document.lines.some(l=>l.lineId===command.operationId)))throw new Error('معرّف العملية مستخدم بالفعل.');
  await local.setups.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:(await local.snapshots.get(command.organizationId))!.access.deviceId});
 });
}
export async function resolveSetup(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.setups,local.snapshots],async()=>{
  const row=await local.setups.get(id);if(!row||row.scope!==scope||row.status!=='needsReview')throw new Error('يمكن معالجة التعديلات المرفوضة فقط.');
  if(action==='retry')requireGrant(await local.snapshots.get(scope));
  await local.setups.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});
 });
}
export async function acceptSnapshot(snapshot:Snapshot){await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{const previous=await local.snapshots.get(snapshot.organizationId);if(snapshot.generation&&previous&&previous.generation!==snapshot.generation){for(const table of [local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes])await table.where('scope').equals(snapshot.organizationId).delete();}await local.snapshots.put(snapshot);for(const row of await local.recipes.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.recipes.update(row.id,{status:'accepted',error:undefined});for(const row of await local.receipts.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.receipts.update(row.id,{status:'accepted',error:undefined});for(const row of await local.counts.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.counts.update(row.id,{status:'accepted',error:undefined});for(const row of await local.transfers.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.transfers.update(row.id,{status:'accepted',error:undefined});const accepted=new Set(snapshot.acceptedOperationIds);const rows=await local.commands.where('scope').equals(snapshot.organizationId).toArray();for(const row of rows)if(accepted.has(row.id))await local.commands.update(row.id,{status:'accepted',error:undefined});const setups=await local.setups.where('scope').equals(snapshot.organizationId).toArray();for(const row of setups)if(accepted.has(row.id))await local.setups.update(row.id,{status:'accepted',error:undefined});for(const row of await local.purchases.where('scope').equals(snapshot.organizationId).toArray())if(accepted.has(row.id))await local.purchases.update(row.id,{status:'accepted',error:undefined});for(const row of await local.openings.where('scope').equals(snapshot.organizationId).toArray())if(accepted.has(row.id))await local.openings.update(row.id,{status:'accepted',error:undefined});});}
export async function bootstrap(expectedScope?:DemoProfile){const response=await fetch('/api/v1/bootstrap',{cache:'no-store'});if(!response.ok)throw new Error(response.status===401?'انتهت الجلسة. جدد الجلسة للمزامنة.':'تعذر تنزيل البيانات');const snapshot=await response.json() as Snapshot;if(expectedScope&&snapshot.organizationId!==expectedScope)throw new Error('الجلسة تخص مؤسسة أخرى. أعد الدخول للمؤسسة الصحيحة.');await acceptSnapshot(snapshot);return snapshot;}
async function identityOwners(){
 const owners=new Map<string,string>();
 for(const row of await local.recipes.toArray())for(const id of recipeIdentities(row.command))owners.set(id,`recipe:${row.id}`);
 for(const row of await local.receipts.toArray())for(const id of [row.id,...row.document.lines.map(l=>l.lineId)])owners.set(id,`receipt:${row.id}`);
 for(const row of await local.counts.toArray())for(const id of countIdentities(row.command))owners.set(id,`count:${row.id}`);
 for(const row of await local.transfers.toArray())for(const id of transferIdentities(row.command))owners.set(id,`transfer:${row.id}`);
 for(const row of await local.commands.toArray())owners.set(row.id,`command:${row.id}`);
 for(const row of await local.setups.toArray())owners.set(row.id,`setup:${row.id}`);
 for(const row of await local.openings.toArray())for(const id of [row.id,...row.document.lines.map(l=>l.lineId)])owners.set(id,`opening:${row.id}`);
 for(const row of await local.purchases.toArray())for(const id of purchaseIdentities(row.command))owners.set(id,`purchase:${row.id}`);
 return owners;
}
export async function saveOpening(input:OpeningDocument,replacesId?:string){
 const document=openingSchema.parse(input);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(document.businessDate>today)throw new Error('تاريخ الرصيد الافتتاحي لا يمكن أن يكون في المستقبل.');
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(document.organizationId));bindGeneration(snapshot,document);
  const projected=projectSetup(snapshot,await local.setups.where('scope').equals(document.organizationId).toArray());
  const old=replacesId?await local.openings.get(replacesId):undefined;
  if(replacesId&&(!old||old.scope!==document.organizationId||old.document.locationId!==document.locationId||old.status!=='needsReview'||snapshot.acceptedOperationIds.includes(replacesId)))throw new Error('يمكن تصحيح المستندات المرفوضة فقط في الموقع نفسه.');
  const owners=await identityOwners();
  if([document.operationId,...document.lines.map(l=>l.lineId)].some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف المستند أو السطر مستخدم بالفعل.');
  const pending=await local.openings.where('scope').equals(document.organizationId).toArray();
  if(!projected.locations.some(l=>l.id===document.locationId&&l.active!==false))throw new Error('الموقع غير نشط أو غير متاح.');
  for(const line of document.lines){
   if(!projected.items.some(i=>i.id===line.itemId&&i.active!==false))throw new Error('إحدى المواد غير نشطة أو غير متاحة.');
   if(snapshot.balances.some(b=>b.locationId===document.locationId&&b.itemId===line.itemId)||snapshot.entries.some(e=>e.locationId===document.locationId&&e.itemId===line.itemId)||pending.some(o=>o.id!==replacesId&&o.status!=='cancelled'&&o.status!=='superseded'&&o.document.locationId===document.locationId&&o.document.lines.some(l=>l.itemId===line.itemId)))throw new Error('إحدى المواد لها رصيد أو مستند افتتاحي سابق في الموقع.');
  }
  await local.openings.add({id:document.operationId,scope:document.organizationId,document,status:'pending',createdAt:document.capturedAt,sourceDeviceId:snapshot.access.deviceId,replacesId});
  if(old)await local.openings.update(old.id,{status:'superseded',replacementId:document.operationId});
 });
}
export async function resolveOpening(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.snapshots,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const row=await local.openings.get(id),snapshot=await local.snapshots.get(scope);
  if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة المستندات المرفوضة فقط.');
  if(action==='retry')requireGrant(snapshot);
  await local.openings.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});
 });
}
export async function sync(scope:DemoProfile){
 const run=async()=>{
  await bootstrap(scope); // Check reset generation before uploading any saved operation.
  const setups=await local.setups.where('scope').equals(scope).sortBy('createdAt');
  const priority={'unit.save':0,'location.save':1,'supplier.save':1,'item.save':2};
  for(const row of setups.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>priority[a.command.type]-priority[b.command.type]||a.createdAt.localeCompare(b.createdAt))){
   const response=await fetch('/api/v1/setup',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.command)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الإعدادات. التعديلات محفوظة؛ جدد الجلسة أو أعد المحاولة.');
   const result=await response.json() as CommandResult;
   await local.setups.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع الإعدادات'});
  }
  let confirmed=setups.some(r=>r.status==='pending'||r.status==='acceptedAwaiting')?await bootstrap(scope):null;
  const recipeQueue=(await local.recipes.where('scope').equals(scope).toArray()).filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.command.expectedRevision-b.command.expectedRevision);
  while(recipeQueue.length){
   const latest=(await local.snapshots.get(scope))!;
   const index=recipeQueue.findIndex(r=>r.command.expectedRevision<=(latest.recipes?.find(d=>d.recipeId===r.command.recipeId)?.revision??0)&&(r.command.type!=='recipe.save'||r.command.definition.lines.every(l=>l.kind!=='recipe'||latest.recipeVersions?.some(v=>v.versionId===l.versionId))));
   if(index<0){for(const row of recipeQueue)await local.recipes.update(row.id,{status:'needsReview',error:'المسودة السابقة أو إصدار الوصفة الفرعية لم يقبل. راجع الوصفات.'});break;}
   const row=recipeQueue.splice(index,1)[0];
   const response=await fetch('/api/v1/recipes',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':latest.generation??''},body:JSON.stringify(row.command)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الوصفات. التعديلات محفوظة.');
   const result=await response.json() as CommandResult;await local.recipes.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع الوصفة'});
   if(response.ok)confirmed=await bootstrap(scope);
  }
  const openings=await local.openings.where('scope').equals(scope).sortBy('createdAt');
  for(const row of openings.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting')){
   const response=await fetch('/api/v1/openings',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.document)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الرصيد الافتتاحي. المستندات محفوظة؛ جدد الجلسة أو أعد المحاولة.');
   const result=await response.json() as CommandResult;
   await local.openings.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع الرصيد الافتتاحي'});
  }
  if(openings.some(r=>r.status==='pending'||r.status==='acceptedAwaiting'))confirmed=await bootstrap(scope);
  const purchaseRows=await local.purchases.where('scope').equals(scope).toArray();
  for(const row of purchaseRows.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>a.command.expectedRevision-b.command.expectedRevision||a.createdAt.localeCompare(b.createdAt))){
   const serverOrder=(await local.snapshots.get(scope))?.purchaseOrders?.find(o=>o.orderId===row.command.orderId);
   if(row.command.expectedRevision>(serverOrder?.revision??0)){await local.purchases.update(row.id,{status:'needsReview',error:'الإصدار السابق لم يقبل. راجع أمر الشراء.'});continue;}
   const response=await fetch('/api/v1/purchases',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.command)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة المشتريات. المستندات محفوظة.');
   const result=await response.json() as CommandResult;
   await local.purchases.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع المشتريات'});
   if(response.ok)confirmed=await bootstrap(scope);
  }
  async function uploadStockUntil(cutoff:string){
  const transferBlockers=(await local.transfers.where('scope').equals(scope).toArray()).filter(r=>r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview');
  const blockers=(await local.openings.where('scope').equals(scope).toArray()).filter(r=>r.status==='needsReview'||r.status==='pending'||r.status==='acceptedAwaiting');
  const purchaseSnapshot=await local.snapshots.get(scope);
  const purchaseBlockers=(await local.purchases.where('scope').equals(scope).toArray()).filter(r=>r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview');
  const rows=await local.commands.where('scope').equals(scope).toArray();
  const documents=await local.receipts.where('scope').equals(scope).toArray();
  const queue=[...rows,...documents].filter(r=>(r.status==='pending'||r.status==='acceptedAwaiting')&&r.createdAt<=cutoff).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  for(const row of queue){
   if('document'in row){
    if(blockers.some(o=>o.document.locationId===row.document.locationId&&o.document.lines.some(l=>row.document.lines.some(x=>x.itemId===l.itemId)))){await local.receipts.update(row.id,{status:'needsReview',error:'الرصيد الافتتاحي لم يقبل بعد. راجع مستنده.'});continue;}
    const response=await fetch('/api/v1/receipts',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.document)});
    if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الاستلام. المستندات محفوظة.');
    const result=await response.json() as CommandResult;await local.receipts.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع مستند الاستلام'});
    if(response.ok)confirmed=await bootstrap(scope);continue;
   }
   if(row.command.type==='waste.post'&&(await local.receipts.where('scope').equals(scope).toArray()).some(r=>(r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview')&&r.createdAt<=row.createdAt&&r.document.locationId===row.command.locationId&&r.document.lines.some(l=>l.itemId===row.command.itemId))){await local.commands.update(row.id,{status:'needsReview',error:'مستند الاستلام السابق لم يقبل. راجع مستنده.'});continue;}

   if(transferBlockers.some(r=>r.command.type==='transfer.receive'&&projectTransfers((confirmed??purchaseSnapshot)!,transferRows).find(t=>t.transferId===r.command.transferId)?.document.destinationId===row.command.locationId)){await local.commands.update(row.id,{status:'needsReview',error:'استلام التحويل لم يقبل بعد. راجع مستنده.'});continue;}
   if(purchaseBlockers.some(r=>(r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview')&&r.command.type==='purchase.receive'&&projectPurchases(purchaseSnapshot!,purchaseRows).find(o=>o.orderId===r.command.orderId)?.document.locationId===row.command.locationId)){await local.commands.update(row.id,{status:'needsReview',error:'استلام الشراء لم يقبل بعد. راجع مستنده.'});continue;}
   if(blockers.some(o=>o.document.locationId===row.command.locationId&&o.document.lines.some(l=>l.itemId===row.command.itemId))){await local.commands.update(row.id,{status:'needsReview',error:'الرصيد الافتتاحي لم يقبل بعد. راجع مستنده ثم أعد محاولة العملية.'});continue;}
   if(confirmed&&(!confirmed.items.some(i=>i.id===row.command.itemId)||!confirmed.locations.some(l=>l.id===row.command.locationId))){
    await local.commands.update(row.id,{status:'needsReview',error:'المادة أو الموقع لم تتم مزامنته. راجع الإعدادات ثم أعد المحاولة.'});continue;
   }
   const response=await fetch('/api/v1/commands',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.command)});
   if(response.status===401)throw new Error('انتهت الجلسة. جدد الجلسة؛ العمليات محفوظة.');
   if(response.status===403)throw new Error('الجلسة أو الصلاحيات تغيرت. العمليات محفوظة؛ أعد الدخول للمؤسسة الصحيحة.');
   if(response.status>=500||response.status===429)throw new Error('المزامنة غير متاحة الآن. العمليات محفوظة.');
   const result=await response.json() as CommandResult & {message?:string};
   if(response.ok&&result.outcome==='accepted')await local.commands.update(row.id,{status:'acceptedAwaiting',error:undefined});
   else await local.commands.update(row.id,{status:'needsReview',error:result.message||'راجع العملية'});
  }
  }
  const transferRows=await local.transfers.where('scope').equals(scope).toArray();
  const transferQueue=transferRows.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.command.expectedRevision-b.command.expectedRevision);
  while(transferQueue.length){
   const latest=await local.snapshots.get(scope);
   const index=transferQueue.findIndex(r=>r.command.expectedRevision<=(latest?.transfers?.find(t=>t.transferId===r.command.transferId)?.revision??0));
   if(index<0){for(const r of transferQueue)await local.transfers.update(r.id,{status:'needsReview',error:'الإرسال أو الإصدار السابق لم يقبل. راجع التحويل.'});break;}
   const row=transferQueue.splice(index,1)[0];
   await uploadStockUntil(row.createdAt);
   const dispatch=row.command;
   if(dispatch.type==='transfer.dispatch'&&(await local.receipts.where('scope').equals(scope).toArray()).some(r=>r.status==='needsReview'&&r.createdAt<=row.createdAt&&r.document.locationId===dispatch.sourceId&&r.document.lines.some(l=>dispatch.lines.some(x=>x.itemId===l.itemId)))){await local.transfers.update(row.id,{status:'needsReview',error:'مستند الاستلام السابق لم يقبل. راجع مستنده.'});continue;}
   const current=(await local.snapshots.get(scope))?.transfers?.find(t=>t.transferId===row.command.transferId);
   if(row.command.expectedRevision>(current?.revision??0)){await local.transfers.update(row.id,{status:'needsReview',error:'الإرسال أو الإصدار السابق لم يقبل. راجع التحويل.'});continue;}
   const response=await fetch('/api/v1/transfers',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.command)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة التحويلات. المستندات محفوظة.');
   const result=await response.json() as CommandResult;
   await local.transfers.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع التحويل'});
   if(response.ok)confirmed=await bootstrap(scope);
  }
  await uploadStockUntil('9999');
  const countRows=await local.counts.where('scope').equals(scope).toArray();
  if(countRows.some(r=>r.status==='pending'||r.status==='acceptedAwaiting')){
   await bootstrap(scope); // All preceding stock operations settle before count finalization.
   const countQueue=countRows.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>a.command.expectedRevision-b.command.expectedRevision||a.createdAt.localeCompare(b.createdAt));
   for(const row of countQueue){
    const latest=(await local.snapshots.get(scope))!,doc=projectCounts(latest,countRows).find(d=>d.countId===row.command.countId);
    if(latest.acceptedOperationIds.includes(row.id))continue;
    const current=latest.counts?.find(d=>d.countId===row.command.countId);
    if(row.command.expectedRevision>(current?.revision??0)){await local.counts.update(row.id,{status:'needsReview',error:'مسودة الجرد أو الإصدار السابق لم يقبل.'});continue;}
    if(row.command.type==='count.finalize'&&!latest.acceptedOperationIds.includes(row.id)&&doc&&await hasUnresolvedStock(scope,doc.document.locationId)){await local.counts.update(row.id,{status:'needsReview',error:'توجد حركات مخزون معلقة أو مرفوضة للموقع. حلها ثم أعد العد.'});continue;}
    const response=await fetch('/api/v1/counts',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.command)});
    if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الجرد. المستندات محفوظة.');
    const result=await response.json() as CommandResult;await local.counts.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع الجرد'});
    if(response.ok)await bootstrap(scope);
   }
  }
  return bootstrap(scope);
 };
 if(navigator.locks)return navigator.locks.request(`saas-sync-${scope}`,run);
 return run();
}
export async function resolveReview(scope:DemoProfile,id:string,action:'retry'|'cancel'|'correct',replacement?:Command){
 await local.transaction('rw',[local.commands,local.snapshots,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const row=await local.commands.get(id);const snapshot=await local.snapshots.get(scope);
  if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة العمليات المرفوضة فقط. حدّث البيانات أولاً.');
  if(action!=='cancel')requireGrant(snapshot);
  const resolvedAt=new Date().toISOString();
  if(action==='retry'){await local.commands.update(id,{status:'pending',error:undefined,resolvedAt,resolution:'إعادة إرسال البيانات الأصلية'});return;}
  if(action==='cancel'){await local.commands.update(id,{status:'cancelled',resolvedAt,resolution:'ألغى المستخدم العملية المرفوضة؛ لم تُرحّل للمخزون'});return;}
  const command=commandSchema.parse(replacement);
  if((await identityOwners()).has(command.operationId))throw new Error('معرّف التصحيح مستخدم بالفعل.');
  if(command.organizationId!==scope||command.operationId===id)throw new Error('التصحيح يحتاج معرّف عملية جديداً ضمن المؤسسة الحالية.');
  await local.commands.add({id:command.operationId,scope,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot!.access.deviceId,replacesId:id});
  await local.commands.update(id,{status:'superseded',replacementId:command.operationId,resolvedAt,resolution:'تم إنشاء عملية مصححة مرتبطة'});
 });
}
const rowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:commandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional(),resolvedAt:z.iso.datetime().optional(),resolution:z.string().max(300).optional(),error:z.string().max(500).optional()});
const setupRowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:setupCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),error:z.string().max(500).optional()});
const openingRowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),document:openingSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),error:z.string().max(500).optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const purchaseRowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:purchaseCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),error:z.string().max(500).optional(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const transferRowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:transferCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),error:z.string().max(500).optional(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const countRowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:countCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),error:z.string().max(500).optional(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const receiptRowSchema=openingRowSchema.extend({document:receiptDocumentSchema});
const recipeRowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:recipeCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),error:z.string().max(500).optional()});
const archiveSchema=z.object({version:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5),z.literal(6),z.literal(7),z.literal(8),z.literal(9),z.literal(10),z.literal(11)]),generation:z.uuid().optional(),exportedAt:z.iso.datetime(),organizationId:z.enum(['grills','bistro']),commands:z.array(rowSchema).max(5000),setups:z.array(setupRowSchema).max(5000).optional(),openings:z.array(openingRowSchema).max(5000).optional(),purchases:z.array(purchaseRowSchema).max(5000).optional(),transfers:z.array(transferRowSchema).max(5000).optional(),recipes:z.array(recipeRowSchema).max(5000).optional(),receipts:z.array(receiptRowSchema).max(5000).optional(),counts:z.array(countRowSchema).max(5000).optional()}).superRefine((v,ctx)=>{if(v.version<11&&v.recipes?.length)ctx.addIssue({code:'custom',message:'إصدار الوصفات غير صالح'});if(v.version<10&&v.receipts?.length)ctx.addIssue({code:'custom',message:'إصدار مستندات الاستلام غير صالح'});if(v.version<8&&v.counts?.length)ctx.addIssue({code:'custom',message:'إصدار الجرد غير صالح'});if(v.version<7&&v.transfers?.length)ctx.addIssue({code:'custom',message:'إصدار التحويلات غير صالح'});if((v.version<3&&v.setups?.length)||(v.version<4&&v.openings?.length)||(v.version<5&&v.purchases?.length))ctx.addIssue({code:'custom',message:'إصدار ملف المستندات غير صالح'});if(v.version<6&&v.purchases?.some(r=>r.command.type==='purchase.return'||r.replacesId||r.replacementId))ctx.addIssue({code:'custom',message:'إصدار المرتجعات غير صالح'});});
export type RecoveryPreview={archive:z.infer<typeof archiveSchema>;newCount:number;duplicateCount:number;acceptedCount:number;legacyCount:number};
export async function previewRecovery(text:string,scope:DemoProfile):Promise<RecoveryPreview>{
 if(new TextEncoder().encode(text).length>10*1024*1024)throw new Error('الملف يتجاوز الحد المسموح: ١٠ ميجابايت.');
 let archive:z.infer<typeof archiveSchema>;try{archive=archiveSchema.parse(JSON.parse(text));}catch{throw new Error('ملف الاسترداد غير صالح أو إصداره غير مدعوم.');}
 if(archive.organizationId!==scope)throw new Error('ملف الاسترداد يخص مؤسسة أخرى.');
 const snapshot=requireGrant(await local.snapshots.get(scope));if(snapshot.generation&&archive.generation!==snapshot.generation)throw new Error('نسخة الاسترداد تخص بيانات قبل إعادة التطوير.');const accepted=new Set(snapshot.acceptedOperationIds);const seen=new Set<string>();let newCount=0,duplicateCount=0,acceptedCount=0;
 if(snapshot.generation){for(const row of [...archive.commands,...archive.setups??[],...archive.openings??[],...archive.purchases??[],...archive.transfers??[],...archive.counts??[],...archive.receipts??[],...archive.recipes??[]]){const payload='document'in row?row.document:row.command;if(payload.generation!==snapshot.generation)throw new Error('تحتوي النسخة عمليات من قبل إعادة بيانات التطوير.');}}
 const setupRows=archive.setups??[];
 const owners=await identityOwners();
 const reserve=(id:string,owner:string)=>{if(seen.has(id)||(owners.has(id)&&owners.get(id)!==owner))throw new Error('معرّف مكرر أو مستخدم لعملية مختلفة.');seen.add(id);};
 for(const row of setupRows){
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId)throw new Error('هوية أو نطاق تعديل الإعدادات غير صالح.');reserve(row.id,`setup:${row.id}`);
  const existing=await local.setups.get(row.id);
  if(existing){if(existing.scope!==scope||JSON.stringify(setupCommandSchema.parse(existing.command))!==JSON.stringify(row.command))throw new Error('معرّف إعداد موجود ببيانات مختلفة.');duplicateCount++;}
  else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const projected=projectSetup(snapshot,[...await local.setups.where('scope').equals(scope).toArray(),...setupRows.map(r=>({...r,status:r.status==='cancelled'?'cancelled' as const:'pending' as const}))]);
 for(const row of archive.openings??[]){
  if(row.scope!==scope||row.document.organizationId!==scope||row.id!==row.document.operationId)throw new Error('نطاق المستند الافتتاحي غير صالح.');
  for(const id of [row.id,...row.document.lines.map(l=>l.lineId)])reserve(id,`opening:${row.id}`);
  if(!projected.locations.some(l=>l.id===row.document.locationId)||row.document.lines.some(l=>!projected.items.some(i=>i.id===l.itemId)))throw new Error('يحتوي المستند مادة أو موقعاً غير متاح.');
  const existing=await local.openings.get(row.id);
  if(existing){if(existing.scope!==scope||JSON.stringify(openingSchema.parse(existing.document))!==JSON.stringify(row.document))throw new Error('مستند موجود ببيانات مختلفة.');duplicateCount++;}
  else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const recipeHistory=[...await local.recipes.toArray(),...archive.recipes??[]];
 // Historical cancelled drafts/publications still need scoped reference validation.
 // They enter this validation view only; restore preserves their cancelled status.
 const recipeProjection=projectRecipes(projected,recipeHistory.map(r=>({...r,status:'pending' as const})));
 for(const row of recipeHistory){const c=row.command;if(row.scope!==scope||c.organizationId!==scope||c.type!=='recipe.publish'||recipeProjection.recipeVersions?.some(v=>v.versionId===c.versionId))continue;
  const saved=recipeHistory.find(r=>r.scope===scope&&r.command.organizationId===scope&&r.command.recipeId===c.recipeId&&r.command.type==='recipe.save'&&r.command.expectedRevision+1===c.expectedRevision)?.command;
  if(saved?.type==='recipe.save')recipeProjection.recipeVersions?.push({recipeId:c.recipeId,versionId:c.versionId,versionNumber:0,definition:saved.definition,publishedAt:c.capturedAt});
 }
 for(const row of archive.recipes??[]){
  const c=row.command;if(row.scope!==scope||c.organizationId!==scope||row.id!==c.operationId)throw new Error('نطاق إجراء الوصفة غير صالح.');for(const id of recipeIdentities(c))reserve(id,`recipe:${row.id}`);
  const definition=c.type==='recipe.save'?c.definition:recipeProjection.recipeVersions?.find(v=>v.versionId===c.versionId)?.definition??recipeProjection.recipes?.find(r=>r.recipeId===c.recipeId)?.definition;
  if(!definition)throw new Error('مسودة الوصفة غير متاحة في المؤسسة أو الملف.');
  if(c.type==='recipe.save')validateRecipe(recipeProjection,c.recipeId,definition,false);
  const existing=await local.recipes.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(recipeCommandSchema.parse(existing.command))!==JSON.stringify(c))throw new Error('إجراء وصفة موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const receiptHistory=[...await local.receipts.toArray(),...archive.receipts??[]];
 for(const row of archive.receipts??[]){
  if(row.scope!==scope||row.document.organizationId!==scope||row.id!==row.document.operationId)throw new Error('نطاق مستند الاستلام غير صالح.');
  for(const id of [row.id,...row.document.lines.map(l=>l.lineId)])reserve(id,`receipt:${row.id}`);
  validateReceiptReferences(projected,row.document);
  const chain=new Set([row.id]);let link=row.replacesId;while(link){if(chain.has(link))throw new Error('دورة في روابط تصحيح الاستلام.');chain.add(link);link=receiptHistory.find(r=>r.id===link)?.replacesId;}
  if(row.replacesId){const old=receiptHistory.find(r=>r.id===row.replacesId);if(!old||old.scope!==scope||old.document.locationId!==row.document.locationId||old.status!=='superseded'||old.replacementId!==row.id)throw new Error('رابط تصحيح الاستلام غير صالح.');}
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل تصحيح الاستلام غير مكتمل.');
  if(row.replacementId){const next=receiptHistory.find(r=>r.id===row.replacementId);if(!next||next.scope!==scope||next.document.locationId!==row.document.locationId||next.replacesId!==row.id)throw new Error('بديل الاستلام غير صالح.');}
  const existing=await local.receipts.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(receiptDocumentSchema.parse(existing.document))!==JSON.stringify(row.document))throw new Error('مستند استلام موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const purchaseHistory=[...await local.purchases.toArray(),...archive.purchases??[]];
 for(const row of archive.purchases??[]){
  const validRelated=(id:string)=>{const other=purchaseHistory.find(r=>r.id===id);return other&&other.scope===scope&&other.command.type==='purchase.return'&&row.command.type==='purchase.return'&&other.command.orderId===row.command.orderId&&other.command.receiptId===row.command.receiptId?other:undefined;};
  if(row.replacesId&&!validRelated(row.replacesId))throw new Error('رابط تصحيح المرتجع غير صالح أو يخص مؤسسة أخرى.');
  if(row.replacementId&&validRelated(row.replacementId)?.replacesId!==row.id)throw new Error('سجل بديل المرتجع غير مكتمل.');
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId)throw new Error('نطاق مستند الشراء غير صالح.');for(const id of purchaseIdentities(row.command))reserve(id,`purchase:${row.id}`);
  const c=row.command;if(c.type!=='purchase.save'&&!snapshot.purchaseOrders?.some(o=>o.orderId===c.orderId)&&!(archive.purchases??[]).some(r=>r.command.type==='purchase.save'&&r.command.orderId===c.orderId)&&!(await local.purchases.toArray()).some(r=>r.command.type==='purchase.save'&&r.command.orderId===c.orderId))throw new Error('أمر الشراء غير متاح في المؤسسة أو الملف.');if(c.type==='purchase.save'&&(!projected.locations.some(l=>l.id===c.locationId)||!projected.suppliers?.some(x=>x.id===c.supplierId)||c.lines.some(l=>!projected.items.some(i=>i.id===l.itemId))))throw new Error('يحتوي أمر الشراء مراجع غير متاحة في المؤسسة.');
  if(c.type==='purchase.return'){const receipt=snapshot.purchaseReceipts?.find(r=>r.document.operationId===c.receiptId&&r.document.orderId===c.orderId);if(!receipt||!projected.locations.some(l=>l.id===c.locationId)||!projected.suppliers?.some(s=>s.id===c.supplierId)||c.lines.some(l=>!receipt.document.lines.some(x=>x.movementId===l.sourceMovementId)))throw new Error('مراجع المرتجع خارج نطاق المؤسسة أو غير متاحة.');}
  const existing=await local.purchases.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(purchaseCommandSchema.parse(existing.command))!==JSON.stringify(row.command))throw new Error('مستند شراء موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const transferHistory=[...await local.transfers.toArray(),...archive.transfers??[]];
 for(const row of archive.transfers??[]){
  const chain=new Set<string>([row.id]);let link=row.replacesId;
  while(link){if(chain.has(link))throw new Error('دورة غير صالحة في روابط تصحيح التحويل.');chain.add(link);link=transferHistory.find(r=>r.id===link)?.replacesId;}
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId)throw new Error('نطاق التحويل غير صالح.');
  for(const id of transferIdentities(row.command))reserve(id,`transfer:${row.id}`);
  const c=row.command,dispatch=c.type==='transfer.dispatch'?c:snapshot.transfers?.find(t=>t.transferId===c.transferId)?.document??transferHistory.find(r=>r.scope===scope&&r.command.type==='transfer.dispatch'&&r.command.transferId===c.transferId)?.command;
  if(!dispatch||dispatch.type!=='transfer.dispatch'||!projected.locations.some(l=>l.id===dispatch.sourceId)||!projected.locations.some(l=>l.id===dispatch.destinationId)||dispatch.lines.some(l=>!projected.items.some(i=>i.id===l.itemId))||(c.type!=='transfer.dispatch'&&c.lines.some(l=>!dispatch.lines.some(d=>d.movementId===l.dispatchLineId))))throw new Error('مراجع التحويل غير متاحة في المؤسسة أو الملف.');
  if(row.replacesId){const old=transferHistory.find(r=>r.id===row.replacesId);if(!old||old.scope!==scope||!sameTransferCorrection(old.command,c)||old.replacementId!==row.id||old.status!=='superseded')throw new Error('رابط تصحيح التحويل غير صالح.');}
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل تصحيح التحويل غير مكتمل.');
  if(row.replacementId){const next=transferHistory.find(r=>r.id===row.replacementId);if(!next||next.replacesId!==row.id||next.scope!==scope||!sameTransferCorrection(c,next.command))throw new Error('بديل التحويل غير صالح.');}
  const existing=await local.transfers.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(transferCommandSchema.parse(existing.command))!==JSON.stringify(c))throw new Error('تحويل موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const countHistory=[...await local.counts.toArray(),...archive.counts??[]];
 const countDefinition=(c:CountCommand)=>definitionForCount(snapshot,countHistory,c);
 for(const row of archive.counts??[]){
  const c=row.command;if(row.scope!==scope||c.organizationId!==scope||row.id!==c.operationId)throw new Error('نطاق الجرد غير صالح.');for(const id of countIdentities(c))reserve(id,`count:${row.id}`);
  const d=countDefinition(c);if(!d||d.type!=='count.save'||!projected.locations.some(l=>l.id===d.locationId)||d.lines.some(l=>!projected.items.some(i=>i.id===l.itemId&&i.unitId===l.unitId))||(c.type==='count.finalize'&&(c.lines.length!==d.lines.length||c.lines.some(l=>!d.lines.some(x=>x.lineId===l.lineId)))))throw new Error('مراجع الجرد غير متاحة في المؤسسة أو الملف.');
  const chain=new Set([row.id]);let link=row.replacesId;while(link){if(chain.has(link))throw new Error('دورة غير صالحة في روابط إعادة العد.');chain.add(link);link=countHistory.find(r=>r.id===link)?.replacesId;}
  if(row.replacesId){const old=countHistory.find(r=>r.id===row.replacesId),oldD=old&&countDefinition(old.command);if(!old||old.scope!==scope||old.status!=='superseded'||old.replacementId!==row.id||c.type!=='count.save'||old.command.countId===c.countId||oldD?.locationId!==d.locationId)throw new Error('رابط إعادة العد غير صالح.');}
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل إعادة العد غير مكتمل.');
  if(row.replacementId){const next=countHistory.find(r=>r.id===row.replacementId);if(!next||next.scope!==scope||next.replacesId!==row.id||next.command.type!=='count.save'||next.command.countId===c.countId||next.command.locationId!==d.locationId)throw new Error('بديل الجرد غير صالح.');}
  const existing=await local.counts.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(countCommandSchema.parse(existing.command))!==JSON.stringify(c))throw new Error('جرد موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 for(const row of archive.commands){
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId)throw new Error('هوية أو نطاق عملية غير صالح داخل الملف.');reserve(row.id,`command:${row.id}`);
  if(!projected.items.some(i=>i.id===row.command.itemId)||!projected.locations.some(l=>l.id===row.command.locationId))throw new Error('يحتوي الملف مادة أو موقعاً غير متاح في المؤسسة الحالية.');
  const existing=await local.commands.get(row.id);
  if(existing){if(existing.scope!==scope||JSON.stringify(commandSchema.parse(existing.command))!==JSON.stringify(row.command))throw new Error('يوجد معرّف عملية بنفس الرقم وبيانات مختلفة. لم يُستورد أي شيء.');duplicateCount++;}
  else if(accepted.has(row.id))acceptedCount++;
  else newCount++;
 }
 return {archive,newCount,duplicateCount,acceptedCount,legacyCount:[...archive.commands,...setupRows,...archive.openings??[],...archive.purchases??[],...archive.transfers??[],...archive.counts??[],...archive.receipts??[],...archive.recipes??[]].filter(r=>!r.sourceDeviceId).length};
}
export async function restoreRecovery(text:string,scope:DemoProfile){
 return local.transaction('rw',[local.commands,local.snapshots,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const preview=await previewRecovery(text,scope);const snapshot=requireGrant(await local.snapshots.get(scope));const accepted=new Set(snapshot.acceptedOperationIds);
  for(const row of preview.archive.setups??[]){if(await local.setups.get(row.id)||accepted.has(row.id))continue;await local.setups.add({...row,status:row.status==='cancelled'?'cancelled':row.status==='needsReview'?'needsReview':'pending'});}
  for(const row of preview.archive.recipes??[]){if(await local.recipes.get(row.id)||accepted.has(row.id))continue;await local.recipes.add({...row,status:row.status==='cancelled'||row.status==='needsReview'?row.status:'pending'});}
  for(const row of preview.archive.receipts??[]){if(await local.receipts.get(row.id)||accepted.has(row.id))continue;await local.receipts.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.openings??[]){if(await local.openings.get(row.id)||accepted.has(row.id))continue;await local.openings.add({...row,status:row.status==='cancelled'||row.status==='superseded'?row.status:row.status==='needsReview'?'needsReview':'pending'});}
  for(const row of preview.archive.purchases??[]){if(await local.purchases.get(row.id)||accepted.has(row.id))continue;await local.purchases.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.transfers??[]){if(await local.transfers.get(row.id)||accepted.has(row.id))continue;await local.transfers.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.counts??[]){if(await local.counts.get(row.id)||accepted.has(row.id))continue;await local.counts.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.commands){
   if(await local.commands.get(row.id)||accepted.has(row.id))continue;
   // A file cannot prove server acceptance. Same-ID delivery safely reconciles it.
   const status=row.status==='cancelled'||row.status==='superseded'?row.status:row.status==='needsReview'?'needsReview':'pending';
   await local.commands.add({...row,status});
  }
  return preview;
 });
}
export async function recoveryArchive(scope:DemoProfile){return local.transaction('r',[local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.snapshots],async()=>({version:11,generation:(await local.snapshots.get(scope))?.generation,exportedAt:new Date().toISOString(),organizationId:scope,commands:await local.commands.where('scope').equals(scope).toArray(),setups:await local.setups.where('scope').equals(scope).toArray(),openings:await local.openings.where('scope').equals(scope).toArray(),purchases:await local.purchases.where('scope').equals(scope).toArray(),transfers:await local.transfers.where('scope').equals(scope).toArray(),recipes:await local.recipes.where('scope').equals(scope).toArray(),receipts:await local.receipts.where('scope').equals(scope).toArray(),counts:await local.counts.where('scope').equals(scope).toArray()}));}
export async function downloadRecovery(scope:DemoProfile){const blob=new Blob([JSON.stringify(await recoveryArchive(scope),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`fodo-recovery-${scope}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export type LocalPurchase={id:string;scope:DemoProfile;command:PurchaseCommand;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
export function projectPurchases(snapshot:Snapshot,rows:LocalPurchase[]):PurchaseOrder[]{
 const orders=new Map((snapshot.purchaseOrders??[]).map(o=>[o.orderId,structuredClone(o)]));
 for(const r of rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id)).sort((a,b)=>a.command.expectedRevision-b.command.expectedRevision||a.createdAt.localeCompare(b.createdAt))){
  const c=r.command,old=orders.get(c.orderId);if((old?.revision??0)!==c.expectedRevision)continue;
  if(c.type==='purchase.save')orders.set(c.orderId,{orderId:c.orderId,revision:c.expectedRevision+1,state:'draft',document:c,received:old?.received??{}});
  else if(old){old.revision++;if(c.type==='purchase.submit')old.state='submitted';if(c.type==='purchase.cancel')old.state='cancelled';if(c.type==='purchase.receive'){for(const l of c.lines){const def=old.document.lines.find(x=>x.lineId===l.orderLineId);if(def)old.received[l.orderLineId]=decimal(old.received[l.orderLineId]??'0').add(decimal(l.enteredQuantity).mul(def.factor)).toString();}old.state=old.document.lines.every(l=>decimal(old.received[l.lineId]??'0').gte(l.quantity))?'fullyReceived':'partiallyReceived';}}
 }
 return [...orders.values()];
}
export function projectedPurchaseCommands(snapshot:Snapshot,rows:LocalPurchase[]):Command[]{
 const orders=projectPurchases(snapshot,rows);const commands:Command[]=[];
 for(const row of rows){const c=row.command;if(c.type!=='purchase.receive'||row.status!=='pending'&&row.status!=='acceptedAwaiting'||snapshot.acceptedOperationIds.includes(c.operationId))continue;const order=orders.find(o=>o.orderId===c.orderId);if(!order)continue;for(const l of c.lines){const def=order.document.lines.find(x=>x.lineId===l.orderLineId);if(def)commands.push({operationId:l.movementId,organizationId:c.organizationId,locationId:order.document.locationId,type:'receipt.post',itemId:def.itemId,quantity:decimal(l.enteredQuantity).mul(def.factor).toString(),unitCost:def.unitCost,reason:c.reference,businessDate:c.businessDate,capturedAt:c.capturedAt,schemaVersion:1});}}
 for(const row of rows){const c=row.command;if(c.type!=='purchase.return'||row.status!=='pending'&&row.status!=='acceptedAwaiting'||snapshot.acceptedOperationIds.includes(c.operationId))continue;const source=snapshot.returnSources?.find(s=>s.receiptId===c.receiptId);for(const l of c.lines){const def=source?.lines.find(x=>x.sourceMovementId===l.sourceMovementId);if(def)commands.push({operationId:l.movementId,organizationId:c.organizationId,locationId:c.locationId,type:'waste.post',itemId:def.itemId,quantity:l.quantity,reason:c.reason,businessDate:c.businessDate,capturedAt:c.capturedAt,schemaVersion:1});}}
 return commands;
}
function purchaseIdentities(c:PurchaseCommand){return [c.operationId,...(c.type==='purchase.receive'||c.type==='purchase.return')?c.lines.map(l=>l.movementId):[]];}
export async function savePurchase(input:PurchaseCommand,replacesId?:string){
 const command=purchaseCommandSchema.parse(input);
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(command.organizationId)),rows=await local.purchases.where('scope').equals(command.organizationId).toArray();const owners=await identityOwners();bindGeneration(snapshot,command);
  if(purchaseIdentities(command).some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف العملية مستخدم بالفعل.');
  const current=projectPurchases(snapshot,rows).find(o=>o.orderId===command.orderId);if((current?.revision??0)!==command.expectedRevision)throw new Error('تغير إصدار أمر الشراء. راجع آخر نسخة.');
  if(command.type==='purchase.return'){const source=snapshot.returnSources?.find(s=>s.receiptId===command.receiptId&&s.orderId===command.orderId&&s.supplierId===command.supplierId&&s.locationId===command.locationId);if(!source||command.lines.some(l=>!source.lines.some(x=>x.sourceMovementId===l.sourceMovementId)))throw new Error('الاستلام الأصلي غير متاح في البيانات المقبولة. زامن أولاً.');}
  const old=replacesId?rows.find(r=>r.id===replacesId):undefined;
  if(replacesId&&(!old||old.status!=='needsReview'||snapshot.acceptedOperationIds.includes(old.id)||old.command.type!=='purchase.return'||command.type!=='purchase.return'||old.command.orderId!==command.orderId||old.command.receiptId!==command.receiptId))throw new Error('يمكن تصحيح المرتجع المرفوض فقط من المصدر نفسه.');
  if(rows.some(r=>r.id!==replacesId&&r.command.orderId===command.orderId&&r.status==='needsReview'))throw new Error('راجع العمليات المرفوضة للأمر أولاً.');
  await local.purchases.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot.access.deviceId,replacesId});if(old)await local.purchases.update(old.id,{status:'superseded',replacementId:command.operationId});
 });
}
export async function resolvePurchase(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.purchases,local.snapshots],async()=>{const row=await local.purchases.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة العمليات المرفوضة فقط.');if(action==='retry')requireGrant(s);await local.purchases.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}
export function availableReturnSources(snapshot:Snapshot,rows:LocalPurchase[],excludeId?:string):ReturnSource[]{
 const sources=structuredClone(snapshot.returnSources??[]);
 for(const r of rows){const c=r.command;if(c.type!=='purchase.return'||r.scope!==snapshot.organizationId||r.id===excludeId||r.status!=='pending'&&r.status!=='acceptedAwaiting'||snapshot.acceptedOperationIds.includes(r.id))continue;const source=sources.find(s=>s.receiptId===c.receiptId);for(const line of c.lines){const def=source?.lines.find(l=>l.sourceMovementId===line.sourceMovementId);if(def)def.available=decimal(def.available).sub(line.quantity).toString();}}
 return sources;
}

export type LocalTransfer={id:string;scope:DemoProfile;command:TransferCommand;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
function transferIdentities(c:TransferCommand){return [c.operationId,...c.lines.map(l=>l.movementId)];}
function sameTransferCorrection(a:TransferCommand,b:TransferCommand){return a.type===b.type&&(a.type==='transfer.dispatch'&&b.type==='transfer.dispatch'?a.sourceId===b.sourceId&&a.destinationId===b.destinationId&&a.transferId!==b.transferId:a.transferId===b.transferId);}
export function projectTransfers(snapshot:Snapshot,rows:LocalTransfer[]):Transfer[]{
 const docs=new Map((snapshot.transfers??[]).map(t=>[t.transferId,structuredClone(t)]));
 for(const row of rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id)).sort((a,b)=>a.command.expectedRevision-b.command.expectedRevision||a.createdAt.localeCompare(b.createdAt))){
  const c=row.command,t=docs.get(c.transferId);if((t?.revision??0)!==c.expectedRevision)continue;
  if(c.type==='transfer.dispatch')docs.set(c.transferId,{transferId:c.transferId,document:c,revision:1,postedAt:c.capturedAt,amount:'0',state:'inTransit',lines:c.lines.map(l=>({dispatchLineId:l.movementId,itemId:l.itemId,unitId:l.unitId,quantity:l.quantity,received:'0',lost:'0',remaining:l.quantity,amount:'0',remainingValue:'0'}))});
  else if(t){t.revision++;for(const l of c.lines){const target=t.lines.find(x=>x.dispatchLineId===l.dispatchLineId);if(target){target.remaining=decimal(target.remaining).sub(l.quantity).toString();if(c.type==='transfer.receive')target.received=decimal(target.received).add(l.quantity).toString();else target.lost=decimal(target.lost).add(l.quantity).toString();}}t.state=t.lines.some(l=>decimal(l.remaining).gt(0))?'partial':t.lines.some(l=>decimal(l.lost).gt(0))?'resolvedWithLoss':'completed';}
 }
 return [...docs.values()];
}
export function projectedTransferCommands(snapshot:Snapshot,rows:LocalTransfer[]):Command[]{
 const docs=projectTransfers(snapshot,rows),commands:Command[]=[];
 for(const row of rows){const c=row.command;if(row.scope!==snapshot.organizationId||row.status!=='pending'&&row.status!=='acceptedAwaiting'||snapshot.acceptedOperationIds.includes(row.id)||c.type==='transfer.loss')continue;
  const d=docs.find(t=>t.transferId===c.transferId)?.document;if(!d)continue;
  for(const l of c.lines){const itemId='itemId'in l?l.itemId:d.lines.find(x=>x.movementId===l.dispatchLineId)?.itemId;if(itemId)commands.push({operationId:l.movementId,organizationId:c.organizationId,locationId:c.type==='transfer.dispatch'?d.sourceId:d.destinationId,type:c.type==='transfer.dispatch'?'waste.post':'receipt.post',itemId,quantity:l.quantity,unitCost:'0',reason:c.reason,businessDate:c.businessDate,capturedAt:c.capturedAt,schemaVersion:1});}
 }
 return commands;
}
export async function saveTransfer(input:TransferCommand,replacesId?:string){
 const c=transferCommandSchema.parse(input);
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(c.organizationId)),rows=await local.transfers.where('scope').equals(c.organizationId).toArray(),old=replacesId?rows.find(r=>r.id===replacesId):undefined;
  bindGeneration(snapshot,c);
  if(replacesId&&(!old||old.status!=='needsReview'||snapshot.acceptedOperationIds.includes(old.id)||!sameTransferCorrection(old.command,c)))throw new Error('يمكن تصحيح التحويل المرفوض فقط مع الحفاظ على المصدر والوجهة.');
  const owners=await identityOwners();if(transferIdentities(c).some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف التحويل أو السطر مستخدم بالفعل.');
  const projected=projectSetup(snapshot,await local.setups.where('scope').equals(c.organizationId).toArray());
  const current=projectTransfers(snapshot,rows).find(t=>t.transferId===c.transferId);if((current?.revision??0)!==c.expectedRevision)throw new Error('تغير إصدار التحويل. زامن وراجع البيانات.');
  if(c.type==='transfer.dispatch'){
   if(![c.sourceId,c.destinationId].every(id=>projected.locations.some(l=>l.id===id&&l.active!==false))||c.lines.some(l=>!projected.items.some(i=>i.id===l.itemId&&i.unitId===l.unitId&&i.active!==false)))throw new Error('مواقع أو مواد التحويل غير متاحة.');
   if(old&&rows.some(r=>r.command.transferId===old.command.transferId&&r.id!==old.id&&r.status!=='cancelled'&&r.status!=='superseded'))throw new Error('راجع وألغِ إجراءات التحويل المرفوض التابعة أولاً.');
  }else if(!current||c.lines.some(l=>!current.lines.some(x=>x.dispatchLineId===l.dispatchLineId)))throw new Error('الإرسال أو سطوره غير متاحة. زامن أو احفظ الإرسال أولاً.');
  if(rows.some(r=>r.id!==replacesId&&r.command.transferId===c.transferId&&r.status==='needsReview'))throw new Error('راجع الإجراءات المرفوضة للتحويل أولاً.');
  await local.transfers.add({id:c.operationId,scope:c.organizationId,command:c,status:'pending',createdAt:c.capturedAt,sourceDeviceId:snapshot.access.deviceId,replacesId});if(old)await local.transfers.update(old.id,{status:'superseded',replacementId:c.operationId});
 });
}
export async function resolveTransfer(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.snapshots,local.transfers,local.counts,local.receipts,local.recipes],async()=>{const row=await local.transfers.get(id),snapshot=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة التحويلات المرفوضة فقط.');if(action==='retry')requireGrant(snapshot);await local.transfers.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}

export type LocalCount={id:string;scope:DemoProfile;command:CountCommand;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
function countIdentities(c:CountCommand){return [c.operationId,...c.type==='count.finalize'?c.lines.map(l=>l.movementId):[]];}
function definitionForCount(snapshot:Snapshot,rows:LocalCount[],c:CountCommand):CountDefinition|undefined{
 if(c.type==='count.save')return c;
 const definitions=[...snapshot.counts?.map(d=>d.document)??[],...snapshot.countRevisions?.map(r=>r.command).filter((d):d is CountDefinition=>d.type==='count.save')??[],...rows.map(r=>r.command).filter((d):d is CountDefinition=>d.type==='count.save')];
 return definitions.filter(d=>d.organizationId===c.organizationId&&d.countId===c.countId&&d.expectedRevision<c.expectedRevision).sort((a,b)=>b.expectedRevision-a.expectedRevision)[0];
}
export function projectCounts(snapshot:Snapshot,rows:LocalCount[]):StockCount[]{
 const docs=new Map((snapshot.counts??[]).map(d=>[d.countId,structuredClone(d)]));
 for(const row of rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id)).sort((a,b)=>a.command.expectedRevision-b.command.expectedRevision||a.createdAt.localeCompare(b.createdAt))){const c=row.command,current=docs.get(c.countId);if((current?.revision??0)!==c.expectedRevision)continue;if(c.type==='count.save')docs.set(c.countId,{countId:c.countId,revision:c.expectedRevision+1,state:'draft',document:c,postedAt:c.capturedAt});else if(current){current.revision++;current.state=c.type==='count.finalize'?'finalized':'cancelled';}}
 return [...docs.values()];
}
async function hasUnresolvedStock(scope:DemoProfile,locationId:string){
 const active=(r:{status:string})=>r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview';
 if((await local.receipts.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.document.locationId===locationId))return true;
 if((await local.commands.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.command.locationId===locationId)||(await local.openings.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.document.locationId===locationId))return true;
 const snapshot=(await local.snapshots.get(scope))!,purchases=await local.purchases.where('scope').equals(scope).toArray(),orders=projectPurchases(snapshot,purchases);
 if(purchases.some(r=>active(r)&&(r.command.type==='purchase.receive'||r.command.type==='purchase.reverse'||r.command.type==='purchase.return')&&orders.find(o=>o.orderId===r.command.orderId)?.document.locationId===locationId))return true;
 const transfers=await local.transfers.where('scope').equals(scope).toArray();return transfers.some(r=>{if(!active(r)||r.command.type==='transfer.loss')return false;const d=r.command.type==='transfer.dispatch'?r.command:definitionForTransfer(snapshot,transfers,r.command.transferId);return d&&(r.command.type==='transfer.dispatch'?d.sourceId:d.destinationId)===locationId;});
}
function definitionForTransfer(snapshot:Snapshot,rows:LocalTransfer[],id:string){return snapshot.transfers?.find(t=>t.transferId===id)?.document??rows.find(r=>r.command.type==='transfer.dispatch'&&r.command.transferId===id)?.command as import('@saas/contracts').TransferDispatch|undefined;}
export async function saveCount(input:CountCommand,replacesId?:string){
 const c=countCommandSchema.parse(input);
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(c.organizationId)),rows=await local.counts.where('scope').equals(c.organizationId).toArray(),current=projectCounts(snapshot,rows).find(d=>d.countId===c.countId),owners=await identityOwners();bindGeneration(snapshot,c);
  if(countIdentities(c).some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف الجرد أو حركة التسوية مستخدم بالفعل.');
  if((current?.revision??0)!==c.expectedRevision)throw new Error('تغير إصدار الجرد. زامن وراجع البيانات.');if(current&&current.state!=='draft')throw new Error('الجرد معتمد أو ملغى. لا يمكن تعديله.');
  const old=replacesId?rows.find(r=>r.id===replacesId):undefined,oldDefinition=old&&definitionForCount(snapshot,rows,old.command);
  if(replacesId&&(!old||old.status!=='needsReview'||snapshot.acceptedOperationIds.includes(old.id)||c.type!=='count.save'||c.countId===old.command.countId||oldDefinition?.locationId!==c.locationId))throw new Error('إعادة العد تحتاج مستنداً جديداً للموقع نفسه بعد الرفض.');
  if(c.type==='count.save'){
   if(!snapshot.locations.some(l=>l.id===c.locationId&&l.active!==false)||c.lines.some(l=>!snapshot.items.some(i=>i.id===l.itemId&&i.unitId===l.unitId)))throw new Error('مراجع الجرد غير متاحة في البيانات المقبولة. زامن أولاً.');
   if(!current){if(snapshot.stockCheckpoints?.find(p=>p.locationId===c.locationId)?.sequence!==c.stockSequence||c.lines.some(l=>!decimal(l.expectedQuantity).eq(snapshot.balances.find(b=>b.locationId===c.locationId&&b.itemId===l.itemId)?.quantity??'0')))throw new Error('أساس الجرد لا يطابق آخر بيانات مقبولة.');}
   else if(c.stockSequence!==current.document.stockSequence||c.cutoffAt!==current.document.cutoffAt||c.locationId!==current.document.locationId||c.lines.some(l=>{const old=current.document.lines.find(x=>x.itemId===l.itemId);return old&&!decimal(old.expectedQuantity).eq(l.expectedQuantity);}))throw new Error('تعديل المسودة يحافظ على أساسها. استخدم جرداً جديداً لإعادة العد.');
  }else if(!current||(c.type==='count.finalize'&&(c.lines.length!==current.document.lines.length||c.lines.some(l=>!current.document.lines.some(x=>x.lineId===l.lineId)))))throw new Error('مسودة الجرد أو سطوره غير متاحة.');
  if(rows.some(r=>r.id!==replacesId&&r.command.countId===c.countId&&r.status==='needsReview'))throw new Error('راجع إجراءات الجرد المرفوضة أولاً.');
  await local.counts.add({id:c.operationId,scope:c.organizationId,command:c,status:'pending',createdAt:c.capturedAt,sourceDeviceId:snapshot.access.deviceId,replacesId});if(old)await local.counts.update(old.id,{status:'superseded',replacementId:c.operationId});
 });
}
export async function resolveCount(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.snapshots,local.counts,local.receipts,local.recipes],async()=>{const r=await local.counts.get(id),s=await local.snapshots.get(scope);if(!r||r.scope!==scope||r.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة إجراءات الجرد المرفوضة فقط.');if(action==='retry')requireGrant(s);await local.counts.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}

export type LocalReceipt={id:string;scope:DemoProfile;document:ReceiptDocument;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
function validateReceiptReferences(snapshot:Snapshot,doc:ReceiptDocument){
 if(!snapshot.locations.some(l=>l.id===doc.locationId))throw new Error('الموقع غير متاح.');
 if(doc.supplierId&&!snapshot.suppliers?.some(s=>s.id===doc.supplierId))throw new Error('المورد غير متاح.');
 for(const line of doc.lines){const item=snapshot.items.find(i=>i.id===line.itemId);if(!item||item.unitId!==line.unitId)throw new Error('المادة أو وحدة المخزون غير متاحة.');if(line.purchaseUnitId){const pack=item.purchaseUnits?.find(p=>p.id===line.purchaseUnitId),q=pack?decimal(line.enteredQuantity!).mul(pack.factor):null;if(!q||q.decimalPlaces()>6||!q.eq(line.quantity))throw new Error('راجع تحويل وحدة الشراء.');}}
}
export async function saveReceipt(input:ReceiptDocument,replacesId?:string){
 const document=receiptDocumentSchema.parse(input);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(document.businessDate>today)throw new Error('تاريخ الاستلام لا يمكن أن يكون في المستقبل.');
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(document.organizationId));bindGeneration(snapshot,document);
  const projected=projectSetup(snapshot,await local.setups.where('scope').equals(document.organizationId).toArray());validateReceiptReferences(projected,document);
  if(!projected.locations.some(l=>l.id===document.locationId&&l.active!==false)||document.lines.some(l=>!projected.items.some(i=>i.id===l.itemId&&i.active!==false))||document.supplierId&&!projected.suppliers?.some(s=>s.id===document.supplierId&&s.active))throw new Error('الموقع أو إحدى المواد أو المورد غير نشط.');
  const old=replacesId?await local.receipts.get(replacesId):undefined;
  if(replacesId&&(!old||old.scope!==document.organizationId||old.document.locationId!==document.locationId||old.status!=='needsReview'||snapshot.acceptedOperationIds.includes(replacesId)))throw new Error('يمكن تصحيح الاستلام المرفوض فقط في الموقع نفسه.');
  const owners=await identityOwners();if([document.operationId,...document.lines.map(l=>l.lineId)].some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف المستند أو السطر مستخدم بالفعل.');
  await local.receipts.add({id:document.operationId,scope:document.organizationId,document,status:'pending',createdAt:document.capturedAt,sourceDeviceId:snapshot.access.deviceId,replacesId});if(old)await local.receipts.update(old.id,{status:'superseded',replacementId:document.operationId});
 });
}
export async function resolveReceipt(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.snapshots,local.receipts,local.recipes],async()=>{const row=await local.receipts.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة الاستلام المرفوض فقط.');if(action==='retry')requireGrant(s);await local.receipts.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}
export function projectedReceiptCommands(snapshot:Snapshot,rows:LocalReceipt[]):Command[]{return rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id)).flatMap(r=>r.document.lines.map(l=>({...r.document,...l,operationId:l.lineId,type:'receipt.post' as const})));}

export type LocalRecipe={id:string;scope:DemoProfile;command:RecipeCommand;status:LocalSetup['status'];createdAt:string;sourceDeviceId?:string;error?:string};
function recipeIdentities(c:RecipeCommand){return [c.operationId,...c.type==='recipe.publish'?[c.versionId]:[]];}
export function projectRecipes(snapshot:Snapshot,rows:LocalRecipe[]):Snapshot{
 const recipes=new Map((snapshot.recipes??[]).map(r=>[r.recipeId,structuredClone(r)])),versions=[...snapshot.recipeVersions??[]];
 const queue=rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.command.expectedRevision-b.command.expectedRevision);
 while(queue.length){const index=queue.findIndex(r=>(recipes.get(r.command.recipeId)?.revision??0)===r.command.expectedRevision);if(index<0)break;const {command:c}=queue.splice(index,1)[0],current=recipes.get(c.recipeId);
  if(c.type==='recipe.save')recipes.set(c.recipeId,{recipeId:c.recipeId,revision:c.expectedRevision+1,state:'draft',definition:c.definition,publishedVersionId:current?.publishedVersionId});
  else if(current&&current.state==='draft'){const versionNumber=Math.max(0,...versions.filter(v=>v.recipeId===c.recipeId).map(v=>v.versionNumber))+1;versions.push({recipeId:c.recipeId,versionId:c.versionId,versionNumber,definition:current.definition,publishedAt:c.capturedAt});recipes.set(c.recipeId,{...current,revision:c.expectedRevision+1,state:'published',publishedVersionId:c.versionId});}
 }
 return {...snapshot,recipes:[...recipes.values()],recipeVersions:versions};
}
export async function saveRecipe(input:RecipeCommand){
 const c=recipeCommandSchema.parse(input);
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(c.organizationId));bindGeneration(snapshot,c);const rows=await local.recipes.where('scope').equals(c.organizationId).toArray();
  const projected=projectRecipes(projectSetup(snapshot,await local.setups.where('scope').equals(c.organizationId).toArray()),rows),current=projected.recipes?.find(r=>r.recipeId===c.recipeId);
  if((current?.revision??0)!==c.expectedRevision)throw new Error('تغير إصدار الوصفة. افتح أحدث مسودة.');
  if(rows.some(r=>r.command.recipeId===c.recipeId&&r.status==='needsReview'))throw new Error('ألغِ أو أعد محاولة إجراءات الوصفة المرفوضة أولاً.');
  const owners=await identityOwners();if(recipeIdentities(c).some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)||snapshot.recipeVersions?.some(v=>v.versionId===id)))throw new Error('معرّف العملية أو الإصدار مستخدم بالفعل.');
  if(c.type==='recipe.publish'&&(!current||current.state!=='draft'))throw new Error('احفظ مسودة قبل نشر إصدار.');
  const d=c.type==='recipe.save'?c.definition:current!.definition;validateRecipe(projected,c.recipeId,d);
  if(projected.recipes?.some(r=>r.recipeId!==c.recipeId&&r.definition.code===d.code))throw new Error('كود الوصفة مستخدم بالفعل.');
  await local.recipes.add({id:c.operationId,scope:c.organizationId,command:c,status:'pending',createdAt:c.capturedAt,sourceDeviceId:snapshot.access.deviceId});
 });
}
export async function resolveRecipeAction(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.snapshots,local.recipes],async()=>{const row=await local.recipes.get(id),snapshot=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة إجراءات الوصفة المرفوضة فقط.');if(action==='retry')requireGrant(snapshot);await local.recipes.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}
