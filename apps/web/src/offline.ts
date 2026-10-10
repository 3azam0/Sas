import {decimal} from '@saas/domain';
import Dexie,{type Table} from 'dexie';
import {z} from 'zod';
import {commandSchema,setupCommandSchema,openingSchema,purchaseCommandSchema,type PurchaseCommand,type PurchaseOrder,type OpeningDocument,type SetupCommand,type Command,type DemoProfile,type Snapshot,type CommandResult} from '@saas/contracts';
export type LocalCommand={id:string;scope:DemoProfile;command:Command;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled'|'superseded';error?:string;createdAt:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string;resolvedAt?:string;resolution?:string};
export type LocalSetup={id:string;scope:DemoProfile;command:SetupCommand;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled';createdAt:string;error?:string;sourceDeviceId?:string};
export type LocalOpening={id:string;scope:DemoProfile;document:OpeningDocument;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string};
class LocalDatabase extends Dexie {
 snapshots!:Table<Snapshot,DemoProfile>;commands!:Table<LocalCommand,string>;preferences!:Table<{key:string;value:string},string>;
 setups!:Table<LocalSetup,string>;
 openings!:Table<LocalOpening,string>;purchases!:Table<LocalPurchase,string>;
 constructor(name='restaurant-saas-v1'){super(name);this.version(1).stores({snapshots:'organizationId',commands:'id,scope,status,createdAt',preferences:'key'});this.version(2).stores({setups:'id,scope,status,createdAt'});this.version(3).stores({openings:'id,scope,status,createdAt'});this.version(4).stores({purchases:'id,scope,status,createdAt'});}
}
export const local=new LocalDatabase();
function requireGrant(snapshot:Snapshot|undefined){if(!snapshot||!Number.isFinite(Date.parse(snapshot.access.expiresAt))||Date.parse(snapshot.access.expiresAt)<=Date.now())throw new Error('انتهت صلاحية العمل دون اتصال. جدد الجلسة عبر الإنترنت؛ عملياتك محفوظة.');return snapshot;}
export async function saveCommand(command:Command){commandSchema.parse(command);await local.transaction('rw',local.snapshots,local.commands,local.setups,local.openings,local.purchases,async()=>{const snapshot=requireGrant(await local.snapshots.get(command.organizationId));if((await identityOwners()).has(command.operationId)||await local.setups.get(command.operationId)||(await local.openings.toArray()).some(o=>o.id===command.operationId||o.document.lines.some(l=>l.lineId===command.operationId)))throw new Error('معرّف العملية مستخدم بالفعل.');await local.commands.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot.access.deviceId});});}
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
 await local.transaction('rw',local.setups,local.snapshots,local.commands,local.openings,local.purchases,async()=>{
  requireGrant(await local.snapshots.get(command.organizationId));
  const rows=await local.setups.where('scope').equals(command.organizationId).toArray();
  if(rows.some(r=>r.command.type===command.type&&r.command.record.id===command.record.id&&(r.status==='pending'||r.status==='acceptedAwaiting')))throw new Error('يوجد تعديل محفوظ لهذا السجل. زامنه أولاً قبل تعديل جديد.');
  if((await identityOwners()).has(command.operationId)||await local.commands.get(command.operationId)||(await local.openings.toArray()).some(o=>o.id===command.operationId||o.document.lines.some(l=>l.lineId===command.operationId)))throw new Error('معرّف العملية مستخدم بالفعل.');
  await local.setups.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:(await local.snapshots.get(command.organizationId))!.access.deviceId});
 });
}
export async function resolveSetup(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',local.setups,local.snapshots,async()=>{
  const row=await local.setups.get(id);if(!row||row.scope!==scope||row.status!=='needsReview')throw new Error('يمكن معالجة التعديلات المرفوضة فقط.');
  if(action==='retry')requireGrant(await local.snapshots.get(scope));
  await local.setups.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});
 });
}
export async function acceptSnapshot(snapshot:Snapshot){await local.transaction('rw',local.snapshots,local.commands,local.setups,local.openings,local.purchases,async()=>{await local.snapshots.put(snapshot);const accepted=new Set(snapshot.acceptedOperationIds);const rows=await local.commands.where('scope').equals(snapshot.organizationId).toArray();for(const row of rows)if(accepted.has(row.id))await local.commands.update(row.id,{status:'accepted',error:undefined});const setups=await local.setups.where('scope').equals(snapshot.organizationId).toArray();for(const row of setups)if(accepted.has(row.id))await local.setups.update(row.id,{status:'accepted',error:undefined});for(const row of await local.purchases.where('scope').equals(snapshot.organizationId).toArray())if(accepted.has(row.id))await local.purchases.update(row.id,{status:'accepted',error:undefined});for(const row of await local.openings.where('scope').equals(snapshot.organizationId).toArray())if(accepted.has(row.id))await local.openings.update(row.id,{status:'accepted',error:undefined});});}
export async function bootstrap(expectedScope?:DemoProfile){const response=await fetch('/api/v1/bootstrap',{cache:'no-store'});if(!response.ok)throw new Error(response.status===401?'انتهت الجلسة. جدد الجلسة للمزامنة.':'تعذر تنزيل البيانات');const snapshot=await response.json() as Snapshot;if(expectedScope&&snapshot.organizationId!==expectedScope)throw new Error('الجلسة تخص مؤسسة أخرى. أعد الدخول للمؤسسة الصحيحة.');await acceptSnapshot(snapshot);return snapshot;}
async function identityOwners(){
 const owners=new Map<string,string>();
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
 await local.transaction('rw',local.snapshots,local.commands,local.setups,local.openings,local.purchases,async()=>{
  const snapshot=requireGrant(await local.snapshots.get(document.organizationId));
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
 await local.transaction('rw',local.snapshots,local.openings,local.purchases,async()=>{
  const row=await local.openings.get(id),snapshot=await local.snapshots.get(scope);
  if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة المستندات المرفوضة فقط.');
  if(action==='retry')requireGrant(snapshot);
  await local.openings.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});
 });
}
export async function sync(scope:DemoProfile){
 const run=async()=>{
  const setups=await local.setups.where('scope').equals(scope).sortBy('createdAt');
  const priority={'unit.save':0,'location.save':1,'supplier.save':1,'item.save':2};
  for(const row of setups.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>priority[a.command.type]-priority[b.command.type]||a.createdAt.localeCompare(b.createdAt))){
   const response=await fetch('/api/v1/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row.command)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الإعدادات. التعديلات محفوظة؛ جدد الجلسة أو أعد المحاولة.');
   const result=await response.json() as CommandResult;
   await local.setups.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع الإعدادات'});
  }
  let confirmed=setups.some(r=>r.status==='pending'||r.status==='acceptedAwaiting')?await bootstrap(scope):null;
  const openings=await local.openings.where('scope').equals(scope).sortBy('createdAt');
  for(const row of openings.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting')){
   const response=await fetch('/api/v1/openings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row.document)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة الرصيد الافتتاحي. المستندات محفوظة؛ جدد الجلسة أو أعد المحاولة.');
   const result=await response.json() as CommandResult;
   await local.openings.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع الرصيد الافتتاحي'});
  }
  if(openings.some(r=>r.status==='pending'||r.status==='acceptedAwaiting'))confirmed=await bootstrap(scope);
  const purchaseRows=await local.purchases.where('scope').equals(scope).toArray();
  for(const row of purchaseRows.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting').sort((a,b)=>a.command.expectedRevision-b.command.expectedRevision||a.createdAt.localeCompare(b.createdAt))){
   const serverOrder=(await local.snapshots.get(scope))?.purchaseOrders?.find(o=>o.orderId===row.command.orderId);
   if(row.command.expectedRevision>(serverOrder?.revision??0)){await local.purchases.update(row.id,{status:'needsReview',error:'الإصدار السابق لم يقبل. راجع أمر الشراء.'});continue;}
   const response=await fetch('/api/v1/purchases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row.command)});
   if(response.status===401||response.status===403||response.status>=500||response.status===429)throw new Error('تعذرت مزامنة المشتريات. المستندات محفوظة.');
   const result=await response.json() as CommandResult;
   await local.purchases.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message??'راجع المشتريات'});
   if(response.ok)confirmed=await bootstrap(scope);
  }
  const blockers=(await local.openings.where('scope').equals(scope).toArray()).filter(r=>r.status==='needsReview'||r.status==='pending'||r.status==='acceptedAwaiting');
  const purchaseSnapshot=await local.snapshots.get(scope);
  const purchaseBlockers=(await local.purchases.where('scope').equals(scope).toArray()).filter(r=>r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview');
  const rows=await local.commands.where('scope').equals(scope).sortBy('createdAt');
  for(const row of rows.filter(x=>x.status==='pending'||x.status==='acceptedAwaiting')) {
   if(purchaseBlockers.some(r=>(r.status==='pending'||r.status==='acceptedAwaiting'||r.status==='needsReview')&&r.command.type==='purchase.receive'&&projectPurchases(purchaseSnapshot!,purchaseRows).find(o=>o.orderId===r.command.orderId)?.document.locationId===row.command.locationId)){await local.commands.update(row.id,{status:'needsReview',error:'استلام الشراء لم يقبل بعد. راجع مستنده.'});continue;}
   if(blockers.some(o=>o.document.locationId===row.command.locationId&&o.document.lines.some(l=>l.itemId===row.command.itemId))){await local.commands.update(row.id,{status:'needsReview',error:'الرصيد الافتتاحي لم يقبل بعد. راجع مستنده ثم أعد محاولة العملية.'});continue;}
   if(confirmed&&(!confirmed.items.some(i=>i.id===row.command.itemId)||!confirmed.locations.some(l=>l.id===row.command.locationId))){
    await local.commands.update(row.id,{status:'needsReview',error:'المادة أو الموقع لم تتم مزامنته. راجع الإعدادات ثم أعد المحاولة.'});continue;
   }
   const response=await fetch('/api/v1/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row.command)});
   if(response.status===401)throw new Error('انتهت الجلسة. جدد الجلسة؛ العمليات محفوظة.');
   if(response.status===403)throw new Error('الجلسة أو الصلاحيات تغيرت. العمليات محفوظة؛ أعد الدخول للمؤسسة الصحيحة.');
   if(response.status>=500||response.status===429)throw new Error('المزامنة غير متاحة الآن. العمليات محفوظة.');
   const result=await response.json() as CommandResult & {message?:string};
   if(response.ok&&result.outcome==='accepted')await local.commands.update(row.id,{status:'acceptedAwaiting',error:undefined});
   else await local.commands.update(row.id,{status:'needsReview',error:result.message||'راجع العملية'});
  }
  return bootstrap(scope);
 };
 if(navigator.locks)return navigator.locks.request(`saas-sync-${scope}`,run);
 return run();
}
export async function resolveReview(scope:DemoProfile,id:string,action:'retry'|'cancel'|'correct',replacement?:Command){
 await local.transaction('rw',local.commands,local.snapshots,local.setups,local.openings,local.purchases,async()=>{
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
const purchaseRowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:purchaseCommandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),error:z.string().max(500).optional(),sourceDeviceId:z.uuid().optional()});
const archiveSchema=z.object({version:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]),exportedAt:z.iso.datetime(),organizationId:z.enum(['grills','bistro']),commands:z.array(rowSchema).max(5000),setups:z.array(setupRowSchema).max(5000).optional(),openings:z.array(openingRowSchema).max(5000).optional(),purchases:z.array(purchaseRowSchema).max(5000).optional()}).superRefine((v,ctx)=>{if((v.version<3&&v.setups?.length)||(v.version<4&&v.openings?.length)||(v.version<5&&v.purchases?.length))ctx.addIssue({code:'custom',message:'إصدار ملف المستندات غير صالح'});});
export type RecoveryPreview={archive:z.infer<typeof archiveSchema>;newCount:number;duplicateCount:number;acceptedCount:number;legacyCount:number};
export async function previewRecovery(text:string,scope:DemoProfile):Promise<RecoveryPreview>{
 if(new TextEncoder().encode(text).length>10*1024*1024)throw new Error('الملف يتجاوز الحد المسموح: ١٠ ميجابايت.');
 let archive:z.infer<typeof archiveSchema>;try{archive=archiveSchema.parse(JSON.parse(text));}catch{throw new Error('ملف الاسترداد غير صالح أو إصداره غير مدعوم.');}
 if(archive.organizationId!==scope)throw new Error('ملف الاسترداد يخص مؤسسة أخرى.');
 const snapshot=requireGrant(await local.snapshots.get(scope));const accepted=new Set(snapshot.acceptedOperationIds);const seen=new Set<string>();let newCount=0,duplicateCount=0,acceptedCount=0;
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
 for(const row of archive.purchases??[]){
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId)throw new Error('نطاق مستند الشراء غير صالح.');for(const id of purchaseIdentities(row.command))reserve(id,`purchase:${row.id}`);
  const c=row.command;if(c.type!=='purchase.save'&&!snapshot.purchaseOrders?.some(o=>o.orderId===c.orderId)&&!(archive.purchases??[]).some(r=>r.command.type==='purchase.save'&&r.command.orderId===c.orderId)&&!(await local.purchases.toArray()).some(r=>r.command.type==='purchase.save'&&r.command.orderId===c.orderId))throw new Error('أمر الشراء غير متاح في المؤسسة أو الملف.');if(c.type==='purchase.save'&&(!projected.locations.some(l=>l.id===c.locationId)||!projected.suppliers?.some(x=>x.id===c.supplierId)||c.lines.some(l=>!projected.items.some(i=>i.id===l.itemId))))throw new Error('يحتوي أمر الشراء مراجع غير متاحة في المؤسسة.');
  const existing=await local.purchases.get(row.id);if(existing){if(existing.scope!==scope||JSON.stringify(purchaseCommandSchema.parse(existing.command))!==JSON.stringify(row.command))throw new Error('مستند شراء موجود ببيانات مختلفة.');duplicateCount++;}else if(accepted.has(row.id))acceptedCount++;else newCount++;
 }
 for(const row of archive.commands){
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId)throw new Error('هوية أو نطاق عملية غير صالح داخل الملف.');reserve(row.id,`command:${row.id}`);
  if(!projected.items.some(i=>i.id===row.command.itemId)||!projected.locations.some(l=>l.id===row.command.locationId))throw new Error('يحتوي الملف مادة أو موقعاً غير متاح في المؤسسة الحالية.');
  const existing=await local.commands.get(row.id);
  if(existing){if(existing.scope!==scope||JSON.stringify(commandSchema.parse(existing.command))!==JSON.stringify(row.command))throw new Error('يوجد معرّف عملية بنفس الرقم وبيانات مختلفة. لم يُستورد أي شيء.');duplicateCount++;}
  else if(accepted.has(row.id))acceptedCount++;
  else newCount++;
 }
 return {archive,newCount,duplicateCount,acceptedCount,legacyCount:[...archive.commands,...setupRows,...archive.openings??[],...archive.purchases??[]].filter(r=>!r.sourceDeviceId).length};
}
export async function restoreRecovery(text:string,scope:DemoProfile){
 return local.transaction('rw',local.commands,local.snapshots,local.setups,local.openings,local.purchases,async()=>{
  const preview=await previewRecovery(text,scope);const snapshot=requireGrant(await local.snapshots.get(scope));const accepted=new Set(snapshot.acceptedOperationIds);
  for(const row of preview.archive.setups??[]){if(await local.setups.get(row.id)||accepted.has(row.id))continue;await local.setups.add({...row,status:row.status==='cancelled'?'cancelled':row.status==='needsReview'?'needsReview':'pending'});}
  for(const row of preview.archive.openings??[]){if(await local.openings.get(row.id)||accepted.has(row.id))continue;await local.openings.add({...row,status:row.status==='cancelled'||row.status==='superseded'?row.status:row.status==='needsReview'?'needsReview':'pending'});}
  for(const row of preview.archive.purchases??[]){if(await local.purchases.get(row.id)||accepted.has(row.id))continue;await local.purchases.add({...row,status:row.status==='cancelled'||row.status==='needsReview'?row.status:'pending'});}
  for(const row of preview.archive.commands){
   if(await local.commands.get(row.id)||accepted.has(row.id))continue;
   // A file cannot prove server acceptance. Same-ID delivery safely reconciles it.
   const status=row.status==='cancelled'||row.status==='superseded'?row.status:row.status==='needsReview'?'needsReview':'pending';
   await local.commands.add({...row,status});
  }
  return preview;
 });
}
export async function recoveryArchive(scope:DemoProfile){return local.transaction('r',local.commands,local.setups,local.openings,local.purchases,async()=>({version:5,exportedAt:new Date().toISOString(),organizationId:scope,commands:await local.commands.where('scope').equals(scope).toArray(),setups:await local.setups.where('scope').equals(scope).toArray(),openings:await local.openings.where('scope').equals(scope).toArray(),purchases:await local.purchases.where('scope').equals(scope).toArray()}));}
export async function downloadRecovery(scope:DemoProfile){const blob=new Blob([JSON.stringify(await recoveryArchive(scope),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`fodo-recovery-${scope}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export type LocalPurchase={id:string;scope:DemoProfile;command:PurchaseCommand;status:LocalCommand['status'];createdAt:string;error?:string;sourceDeviceId?:string};
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
 return commands;
}
function purchaseIdentities(c:PurchaseCommand){return [c.operationId,...c.type==='purchase.receive'?c.lines.map(l=>l.movementId):[]];}
export async function savePurchase(input:PurchaseCommand){
 const command=purchaseCommandSchema.parse(input);
 await local.transaction('rw',[local.snapshots,local.commands,local.setups,local.openings,local.purchases],async()=>{
  const snapshot=requireGrant(await local.snapshots.get(command.organizationId)),rows=await local.purchases.where('scope').equals(command.organizationId).toArray();const owners=await identityOwners();
  if(purchaseIdentities(command).some(id=>owners.has(id)||snapshot.acceptedOperationIds.includes(id)))throw new Error('معرّف العملية مستخدم بالفعل.');
  const current=projectPurchases(snapshot,rows).find(o=>o.orderId===command.orderId);if((current?.revision??0)!==command.expectedRevision)throw new Error('تغير إصدار أمر الشراء. راجع آخر نسخة.');
  if(rows.some(r=>r.command.orderId===command.orderId&&r.status==='needsReview'))throw new Error('راجع العمليات المرفوضة للأمر أولاً.');
  await local.purchases.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot.access.deviceId});
 });
}
export async function resolvePurchase(scope:DemoProfile,id:string,action:'retry'|'cancel'){
 await local.transaction('rw',local.purchases,local.snapshots,async()=>{const row=await local.purchases.get(id),s=await local.snapshots.get(scope);if(!row||row.scope!==scope||row.status!=='needsReview'||s?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة العمليات المرفوضة فقط.');if(action==='retry')requireGrant(s);await local.purchases.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});});
}
