import {financeCommandSchema,type FinanceCommand} from '@saas/contracts';
import {menuCommandSchema,salesImportSchema,type MenuCommand,type SalesImportDocument,type MenuItem} from '@saas/contracts';
import {validateMenu,validateSale,previewSales,salesStockRequirements,resolveSalesRouting} from '../../../packages/domain/sales';
import {productionSchema,type ProductionDocument} from '@saas/contracts';
import {validateProduction} from '../../../packages/domain/production';
import {recipeCommandSchema,type RecipeCommand,type Recipe} from '@saas/contracts';
import {validateRecipe} from '../../../packages/domain/recipes';
import {kitchenIssueSchema,type KitchenIssueDocument} from '@saas/contracts';
import {receiptDocumentSchema,type ReceiptDocument} from '@saas/contracts';
import {validateReceiptLineConversion} from '../../../packages/domain/receiving';
import {countCommandSchema,type CountCommand,type StockCount,type CountDefinition} from '@saas/contracts';
import {decimal} from '@saas/domain';
import Dexie,{type Table} from 'dexie';
import {z} from 'zod';
import {transferCommandSchema,type TransferCommand,type Transfer} from '@saas/contracts';
import {commandSchema,setupCommandSchema,openingSchema,purchaseCommandSchema,type PurchaseCommand,type PurchaseOrder,type ReturnSource,type OpeningDocument,type SetupCommand,type Command,type DemoProfile,type Snapshot,type CommandResult} from '@saas/contracts';
export type LocalCommand={id:string;scope:DemoProfile;command:Command;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled'|'superseded';error?:string;createdAt:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string;resolvedAt?:string;resolution?:string};
export type LocalSetup={id:string;scope:DemoProfile;command:SetupCommand;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled';createdAt:string;error?:string;sourceDeviceId?:string};
export type LocalOpening={id:string;scope:DemoProfile;document:OpeningDocument;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
export type LocalFinance={id:string;scope:DemoProfile;command:FinanceCommand;status:LocalCommand['status'];createdAt:string;sourceDeviceId?:string;error?:string;replacesId?:string;replacementId?:string};
class LocalDatabase extends Dexie {
 finance!:Table<LocalFinance,string>;
 kitchenIssues!:Table<LocalKitchenIssue,string>;menus!:Table<LocalMenu,string>;sales!:Table<LocalSales,string>;
 snapshots!:Table<Snapshot,DemoProfile>;commands!:Table<LocalCommand,string>;preferences!:Table<{key:string;value:string},string>;
 setups!:Table<LocalSetup,string>;
 productions!:Table<LocalProduction,string>;recipes!:Table<LocalRecipe,string>;receipts!:Table<LocalReceipt,string>;openings!:Table<LocalOpening,string>;purchases!:Table<LocalPurchase,string>;transfers!:Table<LocalTransfer,string>;counts!:Table<LocalCount,string>;
 constructor(name='restaurant-saas-v1'){super(name);this.version(1).stores({snapshots:'organizationId',commands:'id,scope,status,createdAt',preferences:'key'});this.version(2).stores({setups:'id,scope,status,createdAt'});this.version(3).stores({openings:'id,scope,status,createdAt'});this.version(4).stores({purchases:'id,scope,status,createdAt'});this.version(5).stores({transfers:'id,scope,status,createdAt'});this.version(6).stores({counts:'id,scope,status,createdAt'});this.version(7).stores({receipts:'id,scope,status,createdAt'});this.version(8).stores({recipes:'id,scope,status,createdAt'});this.version(9).stores({productions:'id,scope,status,createdAt'});this.version(10).stores({menus:'id,scope,status,createdAt',sales:'id,scope,status,createdAt'});this.version(11).stores({kitchenIssues:'id,scope,status,createdAt'});this.version(12).stores({finance:'id,scope,status,createdAt'});}
}
export const local=new LocalDatabase();
function requireGrant(snapshot:Snapshot|undefined){if(!snapshot||!Number.isFinite(Date.parse(snapshot.access.expiresAt))||Date.parse(snapshot.access.expiresAt)<=Date.now())throw new Error('انتهت صلاحية العمل دون اتصال. جدد الجلسة عبر الإنترنت؛ عملياتك محفوظة.');return snapshot;}
function bindGeneration(snapshot:Snapshot,command:{generation?:string}){if(command.generation&&command.generation!==snapshot.generation)throw new Error('العملية تخص بيانات قبل إعادة التطوير. حدّث الشاشة.');if(snapshot.generation)command.generation=snapshot.generation;}
export async function saveCommand(command:Command){command=commandSchema.parse(command);await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const snapshot=requireGrant(await local.snapshots.get(command.organizationId));bindGeneration(snapshot,command);if((await identityOwners()).has(command.operationId)||await local.setups.get(command.operationId)||(await local.openings.toArray()).some(o=>o.id===command.operationId||o.document.lines.some(l=>l.lineId===command.operationId)))throw new Error('معرّف العملية مستخدم بالفعل.');await local.commands.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot.access.deviceId});});}
export function projectSetup(snapshot:Snapshot,rows:LocalSetup[]):Snapshot{
 const result={...snapshot,items:[...snapshot.items],locations:[...snapshot.locations],units:[...(snapshot.units??[])],suppliers:[...(snapshot.suppliers??[])],kitchens:[...(snapshot.kitchens??[])],pointsOfSale:[...(snapshot.pointsOfSale??[])]};
 const pending=rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id));
 const priority={'unit.save':0,'location.save':1,'supplier.save':1,'kitchen.save':2,'pos.save':3,'item.save':2};
 for(const row of pending.sort((a,b)=>priority[a.command.type]-priority[b.command.type]||a.createdAt.localeCompare(b.createdAt))){const c=row.command;const revision=c.expectedRevision+1;
  if(c.type==='unit.save'){result.units=result.units.filter(x=>x.id!==c.record.id).concat({...c.record,revision});}
  if(c.type==='kitchen.save'){const old=result.kitchens.find(k=>k.id===c.record.id),record={...old,...c.record,revision};result.kitchens=result.kitchens.filter(x=>x.id!==c.record.id).concat(record);if(record.locationId)result.locations=result.locations.filter(l=>l.id!==record.locationId).concat({id:record.locationId,name:record.name,kind:'مطبخ',active:record.active,revision,kitchenId:record.id,parentLocationId:record.parentLocationId});}
  if(c.type==='pos.save'){result.pointsOfSale=result.pointsOfSale.filter(p=>p.id!==c.record.id).concat({...c.record,revision});}
  if(c.type==='supplier.save'){result.suppliers=result.suppliers.filter(x=>x.id!==c.record.id).concat({...c.record,revision});}
  if(c.type==='location.save'){result.locations=result.locations.filter(x=>x.id!==c.record.id).concat({...c.record,revision});}
  if(c.type==='item.save'){result.items=result.items.filter(x=>x.id!==c.record.id).concat({...c.record,unit:result.units.find(u=>u.id===c.record.unitId)?.name??'—',revision});}
 }
 result.items=result.items.map(i=>({...i,unit:result.units.find(u=>u.id===i.unitId)?.name??i.unit}));
 return result;
}
export async function saveSetup(input:SetupCommand){
 const command=setupCommandSchema.parse(input);
 await local.transaction('rw',[local.setups,local.snapshots,local.commands,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
export async function acceptSnapshot(snapshot:Snapshot){await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const previous=await local.snapshots.get(snapshot.organizationId);if(snapshot.generation&&previous&&previous.generation!==snapshot.generation){for(const table of [local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance])await table.where('scope').equals(snapshot.organizationId).delete();}await local.snapshots.put(snapshot);for(const table of [local.menus,local.sales,local.kitchenIssues,local.finance])for(const row of await table.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await table.update(row.id,{status:'accepted',error:undefined});for(const row of await local.productions.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.productions.update(row.id,{status:'accepted',error:undefined});for(const row of await local.recipes.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.recipes.update(row.id,{status:'accepted',error:undefined});for(const row of await local.receipts.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.receipts.update(row.id,{status:'accepted',error:undefined});for(const row of await local.counts.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.counts.update(row.id,{status:'accepted',error:undefined});for(const row of await local.transfers.where('scope').equals(snapshot.organizationId).toArray())if(snapshot.acceptedOperationIds.includes(row.id))await local.transfers.update(row.id,{status:'accepted',error:undefined});const accepted=new Set(snapshot.acceptedOperationIds);const rows=await local.commands.where('scope').equals(snapshot.organizationId).toArray();for(const row of rows)if(accepted.has(row.id))await local.commands.update(row.id,{status:'accepted',error:undefined});const setups=await local.setups.where('scope').equals(snapshot.organizationId).toArray();for(const row of setups)if(accepted.has(row.id))await local.setups.update(row.id,{status:'accepted',error:undefined});for(const row of await local.purchases.where('scope').equals(snapshot.organizationId).toArray())if(accepted.has(row.id))await local.purchases.update(row.id,{status:'accepted',error:undefined});for(const row of await local.openings.where('scope').equals(snapshot.organizationId).toArray())if(accepted.has(row.id))await local.openings.update(row.id,{status:'accepted',error:undefined});});}
export async function bootstrap(expectedScope?:DemoProfile){const response=await fetch('/api/v1/bootstrap',{cache:'no-store'});if(!response.ok)throw new Error(response.status===401?'انتهت الجلسة. جدد الجلسة للمزامنة.':'تعذر تنزيل البيانات');const snapshot=await response.json() as Snapshot;if(expectedScope&&snapshot.organizationId!==expectedScope)throw new Error('الجلسة تخص مؤسسة أخرى. أعد الدخول للمؤسسة الصحيحة.');await acceptSnapshot(snapshot);return snapshot;}
async function identityOwners(){
 const owners=new Map<string,string>();
 for(const row of await local.finance.toArray())owners.set(row.id,`finance:${row.id}`);
 for(const row of await local.kitchenIssues.toArray())for(const id of [row.id,...row.document.lines.map(l=>l.lineId)])owners.set(id,`kitchen:${row.id}`);
 for(const row of await local.menus.toArray())owners.set(row.id,`menu:${row.id}`);
 for(const row of await local.sales.toArray())for(const id of salesIdentities(row.document))owners.set(id,`sales:${row.id}`);
 for(const row of await local.productions.toArray())for(const id of productionIdentities(row.document))owners.set(id,`production:${row.id}`);
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
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
 await local.transaction('rw',[local.snapshots,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
  const priority={'unit.save':0,'location.save':1,'supplier.save':1,'kitchen.save':2,'pos.save':3,'item.save':2};
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
  const menuQueue=(await local.menus.where('scope').equals(scope).toArray()).filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.command.expectedRevision-b.command.expectedRevision);
  for(const row of menuQueue){const latest=(await local.snapshots.get(scope))!,c=row.command;if(!latest.recipeVersions?.some(v=>v.versionId===c.record.versionId)||(latest.menuItems?.find(m=>m.id===c.record.id)?.revision??0)!==c.expectedRevision){await local.menus.update(row.id,{status:'needsReview',error:'الإصدار السابق أو نشر الوصفة لم يقبل؛ راجع الربط.'});continue;}
   const response=await fetch('/api/v1/menu',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':latest.generation??''},body:JSON.stringify(c)});if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة أصناف البيع. الإجراءات محفوظة.');const result=await response.json() as CommandResult;await local.menus.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع ربط صنف البيع'});if(response.ok)confirmed=await bootstrap(scope);
  }
  async function uploadSale(row:LocalSales){const latest=await bootstrap(scope);if(latest.acceptedOperationIds.includes(row.id))return;try{const preview=previewSales(latest,row.document);if(preview.conflictCount)throw new Error('تفصيل بيع مقبول ببيانات مختلفة.');const fresh=preview.lines.filter(l=>l.state==='new').map(l=>l.line);resolveSalesRouting(latest,row.document,fresh.length>0);for(const l of fresh)validateSale(latest,row.document.source,l,true,row.document.kitchenId);const required=salesStockRequirements(latest,fresh);const blocker=await productionBlocker(scope,{inputLocationId:row.document.locationId,lines:required},row.createdAt,row.id);if(blocker)throw new Error(blocker);}catch(e){await local.sales.update(row.id,{status:'needsReview',error:e instanceof Error?e.message:'ربط البيع لم يقبل'});return;}
   const response=await fetch('/api/v1/sales',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':latest.generation??''},body:JSON.stringify(row.document)});if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة المبيعات. الملف محفوظ.');const result=await response.json() as CommandResult;await local.sales.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع استيراد المبيعات'});if(response.ok)confirmed=await bootstrap(scope);
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
  const batches=await local.productions.where('scope').equals(scope).toArray();
  const saleRows=await local.sales.where('scope').equals(scope).toArray();
  const kitchenRows=await local.kitchenIssues.where('scope').equals(scope).toArray();
  const queue=[...rows,...documents,...batches,...saleRows,...kitchenRows].filter(r=>(r.status==='pending'||r.status==='acceptedAwaiting')&&r.createdAt<=cutoff).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  for(const row of queue){
   if('document'in row&&row.document.type==='sales.import'){await uploadSale({...row,document:row.document});continue;}
   if('document'in row&&row.document.type==='production.post'){
    const d=row.document,latest=await bootstrap(scope);
    const earlier=await productionBlocker(scope,d,row.createdAt,row.id);
    if(!latest.recipeVersions?.some(v=>v.versionId===d.versionId)||earlier){await local.productions.update(row.id,{status:'needsReview',error:earlier??'إصدار الوصفة لم يقبل. راجع نشره.'});continue;}
    const response=await fetch('/api/v1/production',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':latest.generation??''},body:JSON.stringify(d)});
    if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الإنتاج. الدفعة محفوظة.');
    const result=await response.json() as CommandResult;await local.productions.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع دفعة الإنتاج'});if(response.ok)confirmed=await bootstrap(scope);continue;
   }
   if('document'in row){
    const issue=row.document;if(issue.type==='kitchen.issue'||issue.type==='kitchen.transfer'){await uploadKitchenIssue(row as LocalKitchenIssue);continue;}
    const receipt=row.document;if(receipt.type!=='receipt.document')continue;
    if(blockers.some(o=>o.document.locationId===receipt.locationId&&o.document.lines.some(l=>receipt.lines.some(x=>x.itemId===l.itemId)))){await local.receipts.update(row.id,{status:'needsReview',error:'الرصيد الافتتاحي لم يقبل بعد. راجع مستنده.'});continue;}
    const latest=(await local.snapshots.get(scope))!;
    try{validateReceiptReferences(latest,receipt);}catch{await local.receipts.update(row.id,{status:'needsReview',error:'إعداد المادة أو وحدة الاستلام أو الموقع أو المورد لم يقبل بعد. راجع إعداد المخزون ثم أعد محاولة الاستلام.'});continue;}
    const response=await fetch('/api/v1/receipts',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':(await local.snapshots.get(scope))?.generation??''},body:JSON.stringify(row.document)});
    if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الاستلام. المستندات محفوظة.');
    const result=await response.json() as CommandResult;await local.receipts.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع مستند الاستلام'});
    if(response.ok)confirmed=await bootstrap(scope);continue;
   }
   if(row.command.type==='waste.post'&&await unresolvedKitchenFor(scope,row.command.locationId,[row.command.itemId],row.createdAt,row.id)){await local.commands.update(row.id,{status:'needsReview',error:'صرف مطبخ سابق لم يقبل؛ راجع مستنده.'});continue;}
   if(row.command.type==='waste.post'&&await unresolvedSalesFor(scope,row.command.locationId,[row.command.itemId],row.createdAt,row.id)){await local.commands.update(row.id,{status:'needsReview',error:'خصم مبيعات سابق لم يقبل؛ راجع ملف البيع أولاً.'});continue;}
   if(row.command.type==='waste.post'&&await unresolvedProductionFor(scope,row.command.locationId,[row.command.itemId],row.createdAt)){await local.commands.update(row.id,{status:'needsReview',error:'دفعة الإنتاج السابقة لم تقبل. راجعها أولاً.'});continue;}
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
   if(dispatch.type==='transfer.dispatch'&&await unresolvedKitchenFor(scope,dispatch.sourceId,dispatch.lines.map(l=>l.itemId),row.createdAt,row.id)){await local.transfers.update(row.id,{status:'needsReview',error:'صرف مطبخ سابق لم يقبل؛ راجع مستنده.'});continue;}
   if(dispatch.type==='transfer.dispatch'&&await unresolvedSalesFor(scope,dispatch.sourceId,dispatch.lines.map(l=>l.itemId),row.createdAt,row.id)){await local.transfers.update(row.id,{status:'needsReview',error:'خصم مبيعات سابق لم يقبل؛ راجع ملف البيع أولاً.'});continue;}
   if(dispatch.type==='transfer.dispatch'&&await unresolvedProductionFor(scope,dispatch.sourceId,dispatch.lines.map(l=>l.itemId),row.createdAt)){await local.transfers.update(row.id,{status:'needsReview',error:'دفعة الإنتاج السابقة لم تقبل. راجعها أولاً.'});continue;}
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
  for(const row of (await local.finance.where('scope').equals(scope).toArray()).filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
   const latest=await bootstrap(scope);if(latest.acceptedOperationIds.includes(row.id))continue;
   const response=await fetch('/api/v1/finance',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':latest.generation??''},body:JSON.stringify(row.command)});
   if(response.status===401||response.status===403||response.status===429||response.status>=500)throw new Error('تعذرت مزامنة العمليات المالية. عملياتك محفوظة.');
   const result=await response.json() as CommandResult;await local.finance.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع العملية المالية'});
  }
  return bootstrap(scope);
 };
 if(navigator.locks)return navigator.locks.request(`saas-sync-${scope}`,run);
 return run();
}
export async function resolveReview(scope:DemoProfile,id:string,action:'retry'|'cancel'|'correct',replacement?:Command){
 await local.transaction('rw',[local.commands,local.snapshots,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
const rowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),command:commandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional(),resolvedAt:z.iso.datetime().optional(),resolution:z.string().max(300).optional(),error:z.string().max(500).optional()});
const setupRowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),command:setupCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),error:z.string().max(500).optional()});
const openingRowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),document:openingSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),error:z.string().max(500).optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const purchaseRowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),command:purchaseCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),error:z.string().max(500).optional(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const transferRowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),command:transferCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),error:z.string().max(500).optional(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const countRowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),command:countCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),error:z.string().max(500).optional(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const receiptRowSchema=openingRowSchema.extend({document:receiptDocumentSchema});
const kitchenRowSchema=openingRowSchema.extend({document:kitchenIssueSchema});
const recipeRowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),command:recipeCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),error:z.string().max(500).optional()});
const productionRowSchema=z.object({id:z.uuid(),scope:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),document:productionSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),error:z.string().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional()});
const menuRowSchema=recipeRowSchema.extend({command:menuCommandSchema});
const salesRowSchema=productionRowSchema.extend({document:salesImportSchema});
const financeRowSchema=purchaseRowSchema.extend({command:financeCommandSchema});
const archiveSchema=z.object({version:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5),z.literal(6),z.literal(7),z.literal(8),z.literal(9),z.literal(10),z.literal(11),z.literal(12),z.literal(13),z.literal(14),z.literal(15),z.literal(16),z.literal(17),z.literal(18)]),generation:z.uuid().optional(),exportedAt:z.iso.datetime(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),commands:z.array(rowSchema).max(5000),finance:z.array(financeRowSchema).max(5000).optional(),setups:z.array(setupRowSchema).max(5000).optional(),openings:z.array(openingRowSchema).max(5000).optional(),purchases:z.array(purchaseRowSchema).max(5000).optional(),transfers:z.array(transferRowSchema).max(5000).optional(),menus:z.array(menuRowSchema).max(5000).optional(),sales:z.array(salesRowSchema).max(5000).optional(),productions:z.array(productionRowSchema).max(5000).optional(),recipes:z.array(recipeRowSchema).max(5000).optional(),receipts:z.array(receiptRowSchema).max(5000).optional(),kitchenIssues:z.array(kitchenRowSchema).max(5000).optional(),counts:z.array(countRowSchema).max(5000).optional()}).superRefine((v,ctx)=>{if(v.version<18&&v.finance?.length)ctx.addIssue({code:'custom',message:'إصدار العمليات المالية غير صالح'});if(v.version<17&&(v.setups?.some(r=>r.command.type==='pos.save'||r.command.type==='kitchen.save'&&!!r.command.record.locationId)||v.menus?.some(r=>r.command.record.kitchenIds!==undefined)||v.sales?.some(r=>r.document.posId)||v.kitchenIssues?.some(r=>r.document.type==='kitchen.transfer')))ctx.addIssue({code:'custom',message:'إصدار مخزون المطابخ ونقاط البيع غير صالح'});if(v.version<16&&(v.setups?.some(r=>r.command.type==='kitchen.save')||v.kitchenIssues?.some(r=>r.document.kitchenId)))ctx.addIssue({code:'custom',message:'إصدار إدارة المطابخ غير صالح'});if(v.version<15&&v.kitchenIssues?.length)ctx.addIssue({code:'custom',message:'إصدار صرف المطابخ غير صالح'});if(v.version<14&&v.receipts?.some(r=>r.document.lines.some(l=>l.receivingUnit)))ctx.addIssue({code:'custom',message:'إصدار وحدات الاستلام غير صالح'});if(v.version<13&&(v.menus?.length||v.sales?.length))ctx.addIssue({code:'custom',message:'إصدار المبيعات غير صالح'});if(v.version<12&&v.productions?.length)ctx.addIssue({code:'custom',message:'إصدار الإنتاج غير صالح'});if(v.version<11&&v.recipes?.length)ctx.addIssue({code:'custom',message:'إصدار الوصفات غير صالح'});if(v.version<10&&v.receipts?.length)ctx.addIssue({code:'custom',message:'إصدار مستندات الاستلام غير صالح'});if(v.version<8&&v.counts?.length)ctx.addIssue({code:'custom',message:'إصدار الجرد غير صالح'});if(v.version<7&&v.transfers?.length)ctx.addIssue({code:'custom',message:'إصدار التحويلات غير صالح'});if((v.version<3&&v.setups?.length)||(v.version<4&&v.openings?.length)||(v.version<5&&v.purchases?.length))ctx.addIssue({code:'custom',message:'إصدار ملف المستندات غير صالح'});if(v.version<6&&v.purchases?.some(r=>r.command.type==='purchase.return'||r.replacesId||r.replacementId))ctx.addIssue({code:'custom',message:'إصدار المرتجعات غير صالح'});});
export type RecoveryPreview={archive:z.infer<typeof archiveSchema>;newCount:number;duplicateCount:number;acceptedCount:number;legacyCount:number};
export async function previewRecovery(text:string,scope:DemoProfile):Promise<RecoveryPreview>{
 if(new TextEncoder().encode(text).length>10*1024*1024)throw new Error('الملف يتجاوز الحد المسموح: ١٠ ميجابايت.');
 let archive:z.infer<typeof archiveSchema>;try{archive=archiveSchema.parse(JSON.parse(text));}catch{throw new Error('ملف الاسترداد غير صالح أو إصداره غير مدعوم.');}
 if(archive.organizationId!==scope)throw new Error('ملف الاسترداد يخص مؤسسة أخرى.');
 const snapshot=requireGrant(await local.snapshots.get(scope));if(snapshot.generation&&archive.generation!==snapshot.generation)throw new Error('نسخة الاسترداد تخص نسخة سابقة من البيانات.');const accepted=new Set(snapshot.acceptedOperationIds);const seen=new Set<string>();let newCount=0,duplicateCount=0,acceptedCount=0;
 if(snapshot.generation){for(const row of [...archive.commands,...archive.setups??[],...archive.openings??[],...archive.purchases??[],...archive.transfers??[],...archive.counts??[],...archive.receipts??[],...archive.recipes??[],...archive.productions??[],...archive.menus??[],...archive.sales??[],...archive.kitchenIssues??[],...archive.finance??[]]){const payload='document'in row?row.document:row.command;if(payload.generation!==snapshot.generation)throw new Error('تحتوي النسخة عمليات تخص نسخة سابقة من البيانات.');}}
 const setupRows=archive.setups??[];
 const owners=await identityOwners();
 const reserve=(id:string,owner:string)=>{if(seen.has(id)||(owners.has(id)&&owners.get(id)!==owner))throw new Error('معرّف مكرر أو مستخدم لعملية مختلفة.');seen.add(id);};
 for(const row of setupRows){
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId)throw new Error('هوية أو نطاق تعديل الإعدادات غير صالح.');reserve(row.id,`setup:${row.id}`);
  const existing=await local.setups.get(row.id);
  if(existing){if(existing.scope!==scope||JSON.stringify(setupCommandSchema.parse(existing.command))!==JSON.stringify(row.command))throw new Error('معرّف إعداد موجود ببيانات مختلفة.');duplicateCount++;}
  else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 for(const row of archive.finance??[]){
  const c=row.command;
  if(row.scope!==scope||c.organizationId!==scope||row.id!==c.operationId)throw new Error('نطاق العملية المالية غير صالح.');
  reserve(row.id,`finance:${row.id}`);
  if(!snapshot.locations.some(l=>l.id===c.locationId))throw new Error('موقع العملية المالية غير متاح.');
  const history=[...await local.finance.toArray(),...archive.finance??[]];
  if(row.replacesId){const old=history.find(r=>r.id===row.replacesId);if(!old||old.scope!==scope||old.status!=='superseded'||old.replacementId!==row.id||c.replacesOperationId!==old.id||old.command.type!==c.type||old.command.locationId!==c.locationId)throw new Error('رابط التصحيح المالي غير صالح.');}
  if(c.replacesOperationId!==row.replacesId)throw new Error('مرجع التصحيح المالي غير صالح.');
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل التصحيح المالي غير مكتمل.');
  if(row.replacementId){const next=history.find(r=>r.id===row.replacementId);if(!next||next.scope!==scope||next.replacesId!==row.id)throw new Error('بديل التصحيح المالي غير صالح.');}
  const chain=new Set([row.id]);let link=row.replacesId;while(link){if(chain.has(link))throw new Error('دورة في التصحيح المالي.');chain.add(link);link=history.find(r=>r.id===link)?.replacesId;}
  const existing=await local.finance.get(row.id);
  if(existing){if(existing.scope!==scope||JSON.stringify(financeCommandSchema.parse(existing.command))!==JSON.stringify(c))throw new Error('عملية مالية موجودة ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
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
 const menuHistory=[...await local.menus.toArray(),...archive.menus??[]],salesProjection=projectMenu(recipeProjection,menuHistory.map(r=>({...r,status:'pending' as const})));
 // Historical mappings may have moved on; restore validates the stored pinned version.
 for(const row of archive.menus??[]){const c=row.command;if(row.scope!==scope||c.organizationId!==scope||row.id!==c.operationId)throw new Error('نطاق صنف البيع غير صالح.');reserve(row.id,`menu:${row.id}`);validateMenu(recipeProjection,c.record);const old=await local.menus.get(row.id);if(old){if(old.scope!==scope||JSON.stringify(menuCommandSchema.parse(old.command))!==JSON.stringify(c))throw new Error('صنف بيع موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;}
 for(const row of archive.sales??[]){const d=row.document;if(row.scope!==scope||d.organizationId!==scope||row.id!==d.operationId||!salesProjection.locations.some(l=>l.id===d.locationId))throw new Error('نطاق استيراد المبيعات غير صالح.');for(const id of salesIdentities(d))reserve(id,`sales:${row.id}`);
  for(const l of d.lines){const historical=menuHistory.find(m=>m.scope===scope&&m.command.record.id===l.menuItemId)?.command.record;if(!salesProjection.menuItems?.some(m=>m.id===l.menuItemId)&&historical)salesProjection.menuItems?.push({...historical,revision:l.mappingRevision});validateSale(salesProjection,d.source,l,false);}
  const history=[...await local.sales.toArray(),...archive.sales??[]],chain=new Set([row.id]);let link=row.replacesId;while(link){if(chain.has(link))throw new Error('دورة في تصحيح المبيعات.');chain.add(link);link=history.find(r=>r.id===link)?.replacesId;}
  if(row.replacesId){const old=history.find(r=>r.id===row.replacesId);if(!old||old.scope!==scope||old.status!=='superseded'||old.replacementId!==row.id||old.document.source!==d.source||old.document.locationId!==d.locationId)throw new Error('رابط تصحيح المبيعات غير صالح.');}
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل تصحيح المبيعات غير مكتمل.');if(row.replacementId){const next=history.find(r=>r.id===row.replacementId);if(!next||next.scope!==scope||next.replacesId!==row.id||next.document.source!==d.source||next.document.locationId!==d.locationId)throw new Error('بديل المبيعات غير صالح.');}
  const old=await local.sales.get(row.id);if(old){if(old.scope!==scope||JSON.stringify(salesImportSchema.parse(old.document))!==JSON.stringify(d))throw new Error('استيراد مبيعات موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const productionHistory=[...await local.productions.toArray(),...archive.productions??[]];
 for(const row of archive.productions??[]){const d=row.document;if(row.scope!==scope||d.organizationId!==scope||row.id!==d.operationId)throw new Error('نطاق مستند الإنتاج غير صالح.');for(const id of productionIdentities(d))reserve(id,`production:${row.id}`);
  validateProduction(recipeProjection,d,false);
  const chain=new Set([row.id]);let link=row.replacesId;while(link){if(chain.has(link))throw new Error('دورة في تصحيح الإنتاج.');chain.add(link);link=productionHistory.find(r=>r.id===link)?.replacesId;}
  if(row.replacesId){const old=productionHistory.find(r=>r.id===row.replacesId);if(!old||old.scope!==scope||old.status!=='superseded'||old.replacementId!==row.id||old.document.inputLocationId!==d.inputLocationId||old.document.outputLocationId!==d.outputLocationId)throw new Error('رابط تصحيح الإنتاج غير صالح.');}
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل تصحيح الإنتاج غير مكتمل.');
  if(row.replacementId){const next=productionHistory.find(r=>r.id===row.replacementId);if(!next||next.scope!==scope||next.replacesId!==row.id||next.document.inputLocationId!==d.inputLocationId||next.document.outputLocationId!==d.outputLocationId)throw new Error('بديل الإنتاج غير صالح.');}
  const existing=await local.productions.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(productionSchema.parse(existing.document))!==JSON.stringify(d))throw new Error('مستند إنتاج موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const receiptHistory=[...await local.receipts.toArray(),...archive.receipts??[]];
 for(const row of archive.receipts??[]){
  if(row.scope!==scope||row.document.organizationId!==scope||row.id!==row.document.operationId)throw new Error('نطاق مستند الاستلام غير صالح.');
  for(const id of [row.id,...row.document.lines.map(l=>l.lineId)])reserve(id,`receipt:${row.id}`);
  validateReceiptReferences(projected,row.document,false);
  const chain=new Set([row.id]);let link=row.replacesId;while(link){if(chain.has(link))throw new Error('دورة في روابط تصحيح الاستلام.');chain.add(link);link=receiptHistory.find(r=>r.id===link)?.replacesId;}
  if(row.replacesId){const old=receiptHistory.find(r=>r.id===row.replacesId);if(!old||old.scope!==scope||old.document.locationId!==row.document.locationId||old.status!=='superseded'||old.replacementId!==row.id)throw new Error('رابط تصحيح الاستلام غير صالح.');}
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل تصحيح الاستلام غير مكتمل.');
  if(row.replacementId){const next=receiptHistory.find(r=>r.id===row.replacementId);if(!next||next.scope!==scope||next.document.locationId!==row.document.locationId||next.replacesId!==row.id)throw new Error('بديل الاستلام غير صالح.');}
  const existing=await local.receipts.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(receiptDocumentSchema.parse(existing.document))!==JSON.stringify(row.document))throw new Error('مستند استلام موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 const kitchenHistory=[...await local.kitchenIssues.toArray(),...archive.kitchenIssues??[]];
 for(const row of archive.kitchenIssues??[]){
  if(row.scope!==scope||row.document.organizationId!==scope||row.id!==row.document.operationId)throw new Error('نطاق مستند الصرف المطبخ غير صالح.');
  for(const id of [row.id,...row.document.lines.map(l=>l.lineId)])reserve(id,`kitchen:${row.id}`);
  validateKitchenReferences(projected,row.document,false);
  const chain=new Set([row.id]);let link=row.replacesId;while(link){if(chain.has(link))throw new Error('دورة في روابط تصحيح الصرف المطبخ.');chain.add(link);link=kitchenHistory.find(r=>r.id===link)?.replacesId;}
  if(row.replacesId){const old=kitchenHistory.find(r=>r.id===row.replacesId);if(!old||old.scope!==scope||old.document.locationId!==row.document.locationId||old.status!=='superseded'||old.replacementId!==row.id)throw new Error('رابط تصحيح الصرف المطبخ غير صالح.');}
  if(row.status==='superseded'&&!row.replacementId)throw new Error('سجل تصحيح الصرف المطبخ غير مكتمل.');
  if(row.replacementId){const next=kitchenHistory.find(r=>r.id===row.replacementId);if(!next||next.scope!==scope||next.document.locationId!==row.document.locationId||next.replacesId!==row.id)throw new Error('بديل الصرف المطبخ غير صالح.');}
  const existing=await local.kitchenIssues.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(kitchenIssueSchema.parse(existing.document))!==JSON.stringify(row.document))throw new Error('مستند صرف المطبخ موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
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
 return {archive,newCount,duplicateCount,acceptedCount,legacyCount:[...archive.commands,...setupRows,...archive.openings??[],...archive.purchases??[],...archive.transfers??[],...archive.counts??[],...archive.receipts??[],...archive.recipes??[],...archive.productions??[],...archive.menus??[],...archive.sales??[],...archive.kitchenIssues??[],...archive.finance??[]].filter(r=>!r.sourceDeviceId).length};
}
export async function restoreRecovery(text:string,scope:DemoProfile){
 return local.transaction('rw',[local.commands,local.snapshots,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
  const preview=await previewRecovery(text,scope);const snapshot=requireGrant(await local.snapshots.get(scope));const accepted=new Set(snapshot.acceptedOperationIds);
  for(const row of preview.archive.finance??[]){if(await local.finance.get(row.id)||accepted.has(row.id))continue;await local.finance.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.setups??[]){if(await local.setups.get(row.id)||accepted.has(row.id))continue;await local.setups.add({...row,status:row.status==='cancelled'?'cancelled':row.status==='needsReview'?'needsReview':'pending'});}
  for(const row of preview.archive.menus??[]){if(await local.menus.get(row.id)||accepted.has(row.id))continue;await local.menus.add({...row,status:row.status==='cancelled'||row.status==='needsReview'?row.status:'pending'});}
  for(const row of preview.archive.sales??[]){if(await local.sales.get(row.id)||accepted.has(row.id))continue;await local.sales.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.productions??[]){if(await local.productions.get(row.id)||accepted.has(row.id))continue;await local.productions.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.recipes??[]){if(await local.recipes.get(row.id)||accepted.has(row.id))continue;await local.recipes.add({...row,status:row.status==='cancelled'||row.status==='needsReview'?row.status:'pending'});}
  for(const row of preview.archive.receipts??[]){if(await local.receipts.get(row.id)||accepted.has(row.id))continue;await local.receipts.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
  for(const row of preview.archive.kitchenIssues??[]){if(await local.kitchenIssues.get(row.id)||accepted.has(row.id))continue;await local.kitchenIssues.add({...row,status:row.status==='cancelled'||row.status==='needsReview'||row.status==='superseded'?row.status:'pending'});}
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
export async function recoveryArchive(scope:DemoProfile){return local.transaction('r',[local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance,local.snapshots],async()=>({version:18,generation:(await local.snapshots.get(scope))?.generation,exportedAt:new Date().toISOString(),organizationId:scope,finance:await local.finance.where('scope').equals(scope).toArray(),commands:await local.commands.where('scope').equals(scope).toArray(),setups:await local.setups.where('scope').equals(scope).toArray(),openings:await local.openings.where('scope').equals(scope).toArray(),purchases:await local.purchases.where('scope').equals(scope).toArray(),transfers:await local.transfers.where('scope').equals(scope).toArray(),menus:await local.menus.where('scope').equals(scope).toArray(),sales:await local.sales.where('scope').equals(scope).toArray(),productions:await local.productions.where('scope').equals(scope).toArray(),recipes:await local.recipes.where('scope').equals(scope).toArray(),receipts:await local.receipts.where('scope').equals(scope).toArray(),kitchenIssues:await local.kitchenIssues.where('scope').equals(scope).toArray(),counts:await local.counts.where('scope').equals(scope).toArray()}));}
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
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
 await local.transaction('rw',[local.snapshots,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const row=await local.transfers.get(id),snapshot=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة التحويلات المرفوضة فقط.');if(action==='retry')requireGrant(snapshot);await local.transfers.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
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
 if((await local.kitchenIssues.where('scope').equals(scope).toArray()).some(r=>(r.document.locationId===locationId||r.document.type==='kitchen.transfer'&&r.document.destinationLocationId===locationId)&&['pending','acceptedAwaiting','needsReview'].includes(r.status)))return true;
 const active=(r:{status:string})=>r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview';
 if((await local.receipts.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.document.locationId===locationId))return true;
 if((await local.commands.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.command.locationId===locationId)||(await local.openings.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.document.locationId===locationId))return true;
 const snapshot=(await local.snapshots.get(scope))!,purchases=await local.purchases.where('scope').equals(scope).toArray(),orders=projectPurchases(snapshot,purchases);
 if((await local.sales.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.document.locationId===locationId&&salesStockRequirements(snapshot,r.document.lines).length))return true;
 if(purchases.some(r=>active(r)&&(r.command.type==='purchase.receive'||r.command.type==='purchase.reverse'||r.command.type==='purchase.return')&&orders.find(o=>o.orderId===r.command.orderId)?.document.locationId===locationId))return true;
 if((await local.productions.where('scope').equals(scope).toArray()).some(r=>active(r)&&(r.document.inputLocationId===locationId||r.document.outputLocationId===locationId)))return true;
 const transfers=await local.transfers.where('scope').equals(scope).toArray();return transfers.some(r=>{if(!active(r)||r.command.type==='transfer.loss')return false;const d=r.command.type==='transfer.dispatch'?r.command:definitionForTransfer(snapshot,transfers,r.command.transferId);return d&&(r.command.type==='transfer.dispatch'?d.sourceId:d.destinationId)===locationId;});
}
function definitionForTransfer(snapshot:Snapshot,rows:LocalTransfer[],id:string){return snapshot.transfers?.find(t=>t.transferId===id)?.document??rows.find(r=>r.command.type==='transfer.dispatch'&&r.command.transferId===id)?.command as import('@saas/contracts').TransferDispatch|undefined;}
export async function saveCount(input:CountCommand,replacesId?:string){
 const c=countCommandSchema.parse(input);
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
 await local.transaction('rw',[local.snapshots,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const r=await local.counts.get(id),s=await local.snapshots.get(scope);if(!r||r.scope!==scope||r.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة إجراءات الجرد المرفوضة فقط.');if(action==='retry')requireGrant(s);await local.counts.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}

export async function saveBalanceEdit(input:CountDefinition){
 const d=countCommandSchema.parse(input);if(d.type!=='count.save'||d.entryMode!=='balance_edit')throw new Error('مستند تعديل الرصيد غير صالح.');
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(d.organizationId)),line=d.lines[0],rows=await local.counts.where('scope').equals(d.organizationId).toArray();
  if(!snapshot.items.some(i=>i.id===line.itemId&&i.active!==false))throw new Error('المادة غير متاحة أو غير نشطة.');
  if(decimal(line.expectedQuantity).eq(line.countedQuantity))throw new Error('أدخل رصيداً جديداً مختلفاً عن الرصيد الحالي.');
  if(decimal(line.countedQuantity).gt(line.expectedQuantity)&&line.surplusUnitCost===undefined)throw new Error('أدخل تكلفة الوحدة المضافة قبل حفظ الزيادة.');
  if(snapshot.reconciliation?.some(r=>r.locationId===d.locationId&&r.itemId===line.itemId&&!r.matches))throw new Error('الرصيد وحركاته غير متطابقة. راجع السجل قبل التعديل.');
  if(await hasUnresolvedStock(d.organizationId,d.locationId)||projectCounts(snapshot,rows).some(c=>c.document.locationId===d.locationId&&c.state==='draft')||rows.some(r=>['pending','acceptedAwaiting','needsReview'].includes(r.status)&&definitionForCount(snapshot,rows,r.command)?.locationId===d.locationId))throw new Error('زامن أو راجع عمليات الموقع والجرد السابقة قبل تعديل الرصيد.');
  // Both envelopes are durable together; failure cannot leave half a local edit.
  await saveCount(d);
  await saveCount({operationId:crypto.randomUUID(),organizationId:d.organizationId,generation:d.generation,countId:d.countId,expectedRevision:1,capturedAt:d.capturedAt,schemaVersion:1,type:'count.finalize',costPolicy:'explicit',lines:[{lineId:line.lineId,movementId:crypto.randomUUID()}]});
 });
}

export type LocalReceipt={id:string;scope:DemoProfile;document:ReceiptDocument;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
function validateReceiptReferences(snapshot:Snapshot,doc:ReceiptDocument,matchCurrentNames=true){
 if(!snapshot.locations.some(l=>l.id===doc.locationId))throw new Error('الموقع غير متاح.');
 if(doc.supplierId&&!snapshot.suppliers?.some(s=>s.id===doc.supplierId))throw new Error('المورد غير متاح.');
 for(const line of doc.lines){const item=snapshot.items.find(i=>i.id===line.itemId);if(!item||item.unitId!==line.unitId)throw new Error('المادة أو وحدة المخزون غير متاحة.');validateReceiptLineConversion(line,item,snapshot.units??[],matchCurrentNames);}
}
export async function saveReceipt(input:ReceiptDocument,replacesId?:string){
 const document=receiptDocumentSchema.parse(input);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(document.businessDate>today)throw new Error('تاريخ الاستلام لا يمكن أن يكون في المستقبل.');
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
 await local.transaction('rw',[local.snapshots,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const row=await local.receipts.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة الاستلام المرفوض فقط.');if(action==='retry')requireGrant(s);await local.receipts.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
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
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
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
 await local.transaction('rw',[local.snapshots,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const row=await local.recipes.get(id),snapshot=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة إجراءات الوصفة المرفوضة فقط.');if(action==='retry')requireGrant(snapshot);await local.recipes.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}

export type LocalMenu={id:string;scope:DemoProfile;command:MenuCommand;status:LocalRecipe['status'];createdAt:string;sourceDeviceId?:string;error?:string};
export type LocalSales={id:string;scope:DemoProfile;document:SalesImportDocument;status:LocalCommand['status'];createdAt:string;sourceDeviceId?:string;error?:string;replacesId?:string;replacementId?:string};
const salesIdentities=(d:SalesImportDocument)=>[d.operationId,...d.lines.map(l=>l.lineId)];
export function projectMenu(snapshot:Snapshot,rows:LocalMenu[]):Snapshot{
 const items=new Map((snapshot.menuItems??[]).map(m=>[m.id,m]));
 for(const row of rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id)).sort((a,b)=>a.command.expectedRevision-b.command.expectedRevision||a.createdAt.localeCompare(b.createdAt))){const c=row.command;if((items.get(c.record.id)?.revision??0)===c.expectedRevision)items.set(c.record.id,{...c.record,revision:c.expectedRevision+1});}
 return {...snapshot,menuItems:[...items.values()]};
}
export async function saveMenu(input:MenuCommand){const c=menuCommandSchema.parse(input);await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
 const snapshot=requireGrant(await local.snapshots.get(c.organizationId));bindGeneration(snapshot,c);const projected=projectMenu(projectRecipes(projectSetup(snapshot,await local.setups.where('scope').equals(c.organizationId).toArray()),await local.recipes.where('scope').equals(c.organizationId).toArray()),await local.menus.where('scope').equals(c.organizationId).toArray()),current=projected.menuItems?.find(m=>m.id===c.record.id);validateMenu(projected,c.record);
 if((current?.revision??0)!==c.expectedRevision)throw new Error('تغير صنف البيع؛ افتح أحدث تعريف.');if(current&&(current.source!==c.record.source||current.code!==c.record.code))throw new Error('مصدر وكود البيع ثابتان.');if(projected.menuItems?.some(m=>m.id!==c.record.id&&m.source===c.record.source&&m.code===c.record.code))throw new Error('كود البيع مستخدم لهذا المصدر.');if((await identityOwners()).has(c.operationId)||snapshot.acceptedOperationIds.includes(c.operationId))throw new Error('معرّف العملية مستخدم بالفعل.');await local.menus.add({id:c.operationId,scope:c.organizationId,command:c,status:'pending',createdAt:c.capturedAt,sourceDeviceId:snapshot.access.deviceId});
 });}
export async function resolveMenu(scope:DemoProfile,id:string,action:'retry'|'cancel'){await local.transaction('rw',[local.snapshots,local.menus],async()=>{const row=await local.menus.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة ربط مرفوض فقط.');if(action==='retry')requireGrant(s);await local.menus.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});}
export async function saveSales(input:SalesImportDocument,replacesId?:string){const d=salesImportSchema.parse(input);await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
 const snapshot=requireGrant(await local.snapshots.get(d.organizationId));bindGeneration(snapshot,d);const projected=projectMenu(projectRecipes(projectSetup(snapshot,await local.setups.where('scope').equals(d.organizationId).toArray()),await local.recipes.where('scope').equals(d.organizationId).toArray()),await local.menus.where('scope').equals(d.organizationId).toArray());
 if(!projected.locations.some(l=>l.id===d.locationId&&l.active!==false))throw new Error('اختر موقع بيع نشطاً.');const preview=previewSales(projected,d);if(preview.conflictCount)throw new Error('تفصيل بيع مقبول ببيانات مختلفة؛ راجع الملف.');resolveSalesRouting(projected,d,preview.newCount>0);for(const l of preview.lines)if(l.state==='new')validateSale(projected,d.source,l.line,true,d.kitchenId);
 const old=replacesId?await local.sales.get(replacesId):undefined;if(replacesId&&(!old||old.scope!==d.organizationId||old.status!=='needsReview'||snapshot.acceptedOperationIds.includes(old.id)||old.document.source!==d.source||old.document.locationId!==d.locationId))throw new Error('يمكن تصحيح استيراد مرفوض في المصدر والموقع نفسيهما فقط.');const owners=await identityOwners();if(salesIdentities(d).some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف المبيعات أو السطر مستخدم بالفعل.');await local.sales.add({id:d.operationId,scope:d.organizationId,document:d,status:'pending',createdAt:d.capturedAt,sourceDeviceId:snapshot.access.deviceId,replacesId});if(old)await local.sales.update(old.id,{status:'superseded',replacementId:d.operationId});
 });}
export async function resolveSales(scope:DemoProfile,id:string,action:'retry'|'cancel'){await local.transaction('rw',[local.snapshots,local.sales,local.kitchenIssues,local.finance],async()=>{const row=await local.sales.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة استيراد مرفوض فقط.');if(action==='retry')requireGrant(s);await local.sales.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});}

export type LocalProduction={id:string;scope:DemoProfile;document:ProductionDocument;status:LocalCommand['status'];createdAt:string;sourceDeviceId?:string;error?:string;replacesId?:string;replacementId?:string};
function productionIdentities(d:ProductionDocument){return [d.operationId,d.outputMovementId,...d.lines.map(l=>l.movementId)];}
export async function saveProduction(input:ProductionDocument,replacesId?:string){
 const document=productionSchema.parse(input);
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(document.organizationId));bindGeneration(snapshot,document);
  const projected=projectRecipes(projectSetup(snapshot,await local.setups.where('scope').equals(document.organizationId).toArray()),await local.recipes.where('scope').equals(document.organizationId).toArray());validateProduction(projected,document);
  const old=replacesId?await local.productions.get(replacesId):undefined;
  if(replacesId&&(!old||old.scope!==document.organizationId||old.status!=='needsReview'||snapshot.acceptedOperationIds.includes(old.id)||old.document.inputLocationId!==document.inputLocationId||old.document.outputLocationId!==document.outputLocationId))throw new Error('يمكن تصحيح دفعة مرفوضة في المواقع نفسها فقط.');
  const owners=await identityOwners();if(productionIdentities(document).some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف الإنتاج أو السطر مستخدم بالفعل.');
  await local.productions.add({id:document.operationId,scope:document.organizationId,document,status:'pending',createdAt:document.capturedAt,sourceDeviceId:snapshot.access.deviceId,replacesId});if(old)await local.productions.update(old.id,{status:'superseded',replacementId:document.operationId});
 });
}
export async function resolveProduction(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.snapshots,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const row=await local.productions.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة الإنتاج المرفوض فقط.');if(action==='retry')requireGrant(s);await local.productions.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}
export function projectedProductionCommands(snapshot:Snapshot,rows:LocalProduction[]):Command[]{
 return rows.filter(r=>r.scope===snapshot.organizationId&&(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id)).flatMap(r=>{const d=r.document,version=snapshot.recipeVersions?.find(v=>v.versionId===d.versionId);return [...d.lines.filter(l=>decimal(l.quantity).gt(0)).map(l=>({operationId:l.movementId,organizationId:d.organizationId,locationId:d.inputLocationId,type:'waste.post' as const,itemId:l.itemId,quantity:l.quantity,reason:d.reference,businessDate:d.businessDate,capturedAt:d.capturedAt,schemaVersion:1 as const})),...(version&&decimal(d.actualOutput).gt(0)?[{operationId:d.outputMovementId,organizationId:d.organizationId,locationId:d.outputLocationId,type:'receipt.post' as const,itemId:version.definition.outputItemId!,quantity:d.actualOutput,unitCost:'0',reason:d.reference,businessDate:d.businessDate,capturedAt:d.capturedAt,schemaVersion:1 as const}]:[])];});
}
async function unresolvedProductionFor(scope:DemoProfile,location:string,items:string[],cutoff:string,exclude?:string){
 const s=await local.snapshots.get(scope);return (await local.productions.where('scope').equals(scope).toArray()).some(r=>r.id!==exclude&&r.createdAt<=cutoff&&(r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview')&&!s?.acceptedOperationIds.includes(r.id)&&(r.document.inputLocationId===location&&r.document.lines.some(l=>items.includes(l.itemId))||r.document.outputLocationId===location&&items.includes(s?.recipeVersions?.find(v=>v.versionId===r.document.versionId)?.definition.outputItemId??'')));
}
async function productionBlocker(scope:DemoProfile,d:Pick<ProductionDocument,'inputLocationId'>&{lines:{itemId:string;quantity:string}[]},cutoff:string,id:string){
 const s=(await local.snapshots.get(scope))!,items=d.lines.filter(l=>decimal(l.quantity).gt(0)).map(l=>l.itemId),active=(r:{status:string;createdAt:string;id:string})=>r.id!==id&&r.createdAt<=cutoff&&['pending','acceptedAwaiting','needsReview'].includes(r.status)&&!s.acceptedOperationIds.includes(r.id);
 if(await unresolvedKitchenFor(scope,d.inputLocationId,items,cutoff,id))return 'صرف مطبخ سابق لم يقبل؛ راجع مستنده.';
 if(await unresolvedSalesFor(scope,d.inputLocationId,items,cutoff,id))return 'خصم مبيعات سابق لم يقبل؛ راجع ملف البيع أولاً.';
 if(await unresolvedProductionFor(scope,d.inputLocationId,items,cutoff,id))return 'دفعة إنتاج سابقة لم تقبل؛ راجعها أولاً.';
 if((await local.openings.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.document.locationId===d.inputLocationId&&r.document.lines.some(l=>items.includes(l.itemId))))return 'الرصيد الافتتاحي لم يقبل؛ راجع مستنده.';
 if((await local.receipts.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.document.locationId===d.inputLocationId&&r.document.lines.some(l=>items.includes(l.itemId))))return 'استلام مواد سابق لم يقبل؛ راجع مستنده.';
 if((await local.commands.where('scope').equals(scope).toArray()).some(r=>active(r)&&r.command.locationId===d.inputLocationId&&items.includes(r.command.itemId)))return 'حركة مادة سابقة لم تقبل؛ راجعها أولاً.';
 const transfers=await local.transfers.where('scope').equals(scope).toArray();if(transfers.some(r=>{if(!active(r)||r.command.type==='transfer.loss')return false;const dispatch=definitionForTransfer(s,transfers,r.command.transferId);return dispatch&&(r.command.type==='transfer.dispatch'?dispatch.sourceId:dispatch.destinationId)===d.inputLocationId&&dispatch.lines.some(l=>items.includes(l.itemId));}))return 'تحويل مواد سابق لم يقبل؛ راجع مستنده.';
 const purchases=await local.purchases.where('scope').equals(scope).toArray();if(purchases.some(r=>active(r)&&r.command.type==='purchase.receive'&&projectPurchases(s,purchases).find(o=>o.orderId===r.command.orderId)?.document.locationId===d.inputLocationId))return 'استلام شراء سابق لم يقبل؛ راجع مستنده.';
 return null;
}

async function unresolvedSalesFor(scope:DemoProfile,locationId:string,items:string[],cutoff:string,excludeId:string){
 const snapshot=(await local.snapshots.get(scope))!;
 return (await local.sales.where('scope').equals(scope).toArray()).some(r=>r.id!==excludeId&&r.createdAt<=cutoff&&r.document.locationId===locationId&&['pending','acceptedAwaiting','needsReview'].includes(r.status)&&!snapshot.acceptedOperationIds.includes(r.id)&&salesStockRequirements(snapshot,r.document.lines).some(l=>items.includes(l.itemId)));
}

export type LocalKitchenIssue=Omit<LocalReceipt,'document'>&{document:KitchenIssueDocument};
function validateKitchenReferences(s:Snapshot,d:KitchenIssueDocument,active=true){
 if(d.kitchenId){const k=s.kitchens?.find(k=>k.id===d.kitchenId);if(!k||active&&!k.active)throw new Error("اختر مطبخًا نشطًا في المؤسسة.");if(d.type==='kitchen.transfer'&&(!k.locationId||k.locationId!==d.destinationLocationId||k.locationId===d.locationId))throw new Error('اختر وجهة مطبخ مخزون مختلفة عن المصدر.');if(active&&d.type==='kitchen.issue'&&k.locationId)throw new Error('المطبخ يحتفظ بمخزون؛ افتح مستند تحويل جديد.');}
 if(!s.locations.some(l=>l.id===d.locationId&&(!active||l.active!==false)))throw new Error('المخزن غير نشط أو خارج المؤسسة.');
 for(const l of d.lines){const item=s.items.find(i=>i.id===l.itemId);if(!item||item.unitId!==l.unitId||active&&item.active===false)throw new Error('المادة أو وحدة الصرف غير متاحة.');}
}
export async function saveKitchenIssue(input:KitchenIssueDocument,replacesId?:string){
 const d=kitchenIssueSchema.parse(input),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(d.businessDate>today)throw new Error('تاريخ الصرف لا يمكن أن يكون في المستقبل.');
 await local.transaction('rw',[...local.tables],async()=>{
  const s=requireGrant(await local.snapshots.get(d.organizationId));bindGeneration(s,d);validateKitchenReferences(projectSetup(s,await local.setups.where('scope').equals(d.organizationId).toArray()),d);
  const old=replacesId?await local.kitchenIssues.get(replacesId):undefined;
  if(replacesId&&(!old||old.scope!==d.organizationId||old.document.locationId!==d.locationId||old.status!=='needsReview'||s.acceptedOperationIds.includes(old.id)))throw new Error('يمكن تصحيح صرف مرفوض فقط في المخزن نفسه.');
  const owners=await identityOwners();if([d.operationId,...d.lines.map(l=>l.lineId)].some(id=>owners.has(id)||s.acceptedOperationIds.includes(id)))throw new Error('معرّف المستند أو السطر مستخدم بالفعل.');
  await local.kitchenIssues.add({id:d.operationId,scope:d.organizationId,document:d,status:'pending',createdAt:d.capturedAt,sourceDeviceId:s.access.deviceId,replacesId});
  if(old)await local.kitchenIssues.update(old.id,{status:'superseded',replacementId:d.operationId});
 });
}
export async function resolveKitchenIssue(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',[local.snapshots,local.kitchenIssues,local.finance],async()=>{const row=await local.kitchenIssues.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة الصرف المرفوض فقط.');if(action==='retry')requireGrant(s);await local.kitchenIssues.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}
export function projectedKitchenCommands(s:Snapshot,rows:LocalKitchenIssue[]):Command[]{return rows.filter(r=>r.scope===s.organizationId&&['pending','acceptedAwaiting'].includes(r.status)&&!s.acceptedOperationIds.includes(r.id)).flatMap(r=>r.document.lines.flatMap(l=>{const out:Command={operationId:l.lineId,organizationId:r.scope,locationId:r.document.locationId,itemId:l.itemId,quantity:l.quantity,type:'waste.post',reason:r.document.reference,businessDate:r.document.businessDate,capturedAt:r.document.capturedAt,schemaVersion:1};return r.document.type==='kitchen.transfer'&&r.document.destinationLocationId?[out,{...out,operationId:r.id+':'+l.lineId,locationId:r.document.destinationLocationId,type:'receipt.post' as const,unitCost:s.balances.find(b=>b.locationId===r.document.locationId&&b.itemId===l.itemId)?.average??'0'}]:[out];}));}
async function unresolvedKitchenFor(scope:DemoProfile,locationId:string,items:string[],cutoff:string,excludeId:string){const s=(await local.snapshots.get(scope))!;return (await local.kitchenIssues.where('scope').equals(scope).toArray()).some(r=>r.id!==excludeId&&r.createdAt<=cutoff&&(r.document.locationId===locationId||r.document.type==='kitchen.transfer'&&r.document.destinationLocationId===locationId)&&['pending','acceptedAwaiting','needsReview'].includes(r.status)&&!s.acceptedOperationIds.includes(r.id)&&r.document.lines.some(l=>items.includes(l.itemId)));}
async function uploadKitchenIssue(row:LocalKitchenIssue){
 const s=await bootstrap(row.scope);if(s.acceptedOperationIds.includes(row.id))return;
 const blocker=await productionBlocker(row.scope,{inputLocationId:row.document.locationId,lines:row.document.lines},row.createdAt,row.id);
 if(blocker){await local.kitchenIssues.update(row.id,{status:'needsReview',error:blocker});return;}
 const response=await fetch('/api/v1/kitchen-issues',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':s.generation??''},body:JSON.stringify(row.document)});
 if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة صرف المطابخ. المستند محفوظ.');
 const result=await response.json() as CommandResult;await local.kitchenIssues.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع مستند الصرف'});if(response.ok)await bootstrap(row.scope);
}

export async function saveFinance(input:FinanceCommand,replacesId?:string){const command=financeCommandSchema.parse(input);await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts,local.receipts,local.recipes,local.productions,local.menus,local.sales,local.kitchenIssues,local.finance],async()=>{const s=requireGrant(await local.snapshots.get(command.organizationId));bindGeneration(s,command);if((await identityOwners()).has(command.operationId)||s.acceptedOperationIds.includes(command.operationId))throw new Error('معرّف العملية مستخدم بالفعل.');if(!s.locations.some(l=>l.id===command.locationId))throw new Error('الموقع غير متاح.');const old=replacesId?await local.finance.get(replacesId):undefined;if(replacesId&&(!old||old.scope!==command.organizationId||old.status!=='needsReview'||s.acceptedOperationIds.includes(old.id)||old.command.type!==command.type||old.command.locationId!==command.locationId))throw new Error('يمكن تصحيح عملية مرفوضة فقط من النوع والموقع نفسيهما.');if(command.replacesOperationId&&!replacesId)throw new Error('اختر العملية المرفوضة الأصلية للتصحيح.');if(replacesId)command.replacesOperationId=replacesId;await local.finance.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:s.access.deviceId,replacesId});if(old)await local.finance.update(old.id,{status:'superseded',replacementId:command.operationId});});}
export async function resolveFinance(scope:DemoProfile,id:string,action:'retry'|'cancel'){await local.transaction('rw',[local.snapshots,local.finance],async()=>{const r=await local.finance.get(id),s=await local.snapshots.get(scope);if(!r||r.scope!==scope||r.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة عملية مرفوضة فقط.');if(action==='retry')requireGrant(s);await local.finance.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});}
