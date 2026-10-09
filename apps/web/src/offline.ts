import Dexie,{type Table} from 'dexie';
import {z} from 'zod';
import {commandSchema,type Command,type DemoProfile,type Snapshot,type CommandResult} from '@saas/contracts';
export type LocalCommand={id:string;scope:DemoProfile;command:Command;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled'|'superseded';error?:string;createdAt:string;sourceDeviceId?:string;replacesId?:string;replacementId?:string;resolvedAt?:string;resolution?:string};
class LocalDatabase extends Dexie {
 snapshots!:Table<Snapshot,DemoProfile>;commands!:Table<LocalCommand,string>;preferences!:Table<{key:string;value:string},string>;
 constructor(name='restaurant-saas-v1'){super(name);this.version(1).stores({snapshots:'organizationId',commands:'id,scope,status,createdAt',preferences:'key'});}
}
export const local=new LocalDatabase();
function requireGrant(snapshot:Snapshot|undefined){if(!snapshot||!Number.isFinite(Date.parse(snapshot.access.expiresAt))||Date.parse(snapshot.access.expiresAt)<=Date.now())throw new Error('انتهت صلاحية العمل دون اتصال. جدد الجلسة عبر الإنترنت؛ عملياتك محفوظة.');return snapshot;}
export async function saveCommand(command:Command){commandSchema.parse(command);const snapshot=requireGrant(await local.snapshots.get(command.organizationId));await local.commands.add({id:command.operationId,scope:command.organizationId,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot.access.deviceId});}
export async function acceptSnapshot(snapshot:Snapshot){await local.transaction('rw',local.snapshots,local.commands,async()=>{await local.snapshots.put(snapshot);const accepted=new Set(snapshot.acceptedOperationIds);const rows=await local.commands.where('scope').equals(snapshot.organizationId).toArray();for(const row of rows)if(accepted.has(row.id))await local.commands.update(row.id,{status:'accepted',error:undefined});});}
export async function bootstrap(expectedScope?:DemoProfile){const response=await fetch('/api/v1/bootstrap',{cache:'no-store'});if(!response.ok)throw new Error(response.status===401?'انتهت الجلسة. جدد الجلسة للمزامنة.':'تعذر تنزيل البيانات');const snapshot=await response.json() as Snapshot;if(expectedScope&&snapshot.organizationId!==expectedScope)throw new Error('الجلسة تخص مؤسسة أخرى. أعد الدخول للمؤسسة الصحيحة.');await acceptSnapshot(snapshot);return snapshot;}
export async function sync(scope:DemoProfile){
 const run=async()=>{
  const rows=await local.commands.where('scope').equals(scope).sortBy('createdAt');
  for(const row of rows.filter(x=>x.status==='pending'||x.status==='acceptedAwaiting')) {
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
 await local.transaction('rw',local.commands,local.snapshots,async()=>{
  const row=await local.commands.get(id);const snapshot=await local.snapshots.get(scope);
  if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة العمليات المرفوضة فقط. حدّث البيانات أولاً.');
  if(action!=='cancel')requireGrant(snapshot);
  const resolvedAt=new Date().toISOString();
  if(action==='retry'){await local.commands.update(id,{status:'pending',error:undefined,resolvedAt,resolution:'إعادة إرسال البيانات الأصلية'});return;}
  if(action==='cancel'){await local.commands.update(id,{status:'cancelled',resolvedAt,resolution:'ألغى المستخدم العملية المرفوضة؛ لم تُرحّل للمخزون'});return;}
  const command=commandSchema.parse(replacement);
  if(command.organizationId!==scope||command.operationId===id)throw new Error('التصحيح يحتاج معرّف عملية جديداً ضمن المؤسسة الحالية.');
  await local.commands.add({id:command.operationId,scope,command,status:'pending',createdAt:command.capturedAt,sourceDeviceId:snapshot!.access.deviceId,replacesId:id});
  await local.commands.update(id,{status:'superseded',replacementId:command.operationId,resolvedAt,resolution:'تم إنشاء عملية مصححة مرتبطة'});
 });
}
const rowSchema=z.object({id:z.uuid(),scope:z.enum(['grills','bistro']),command:commandSchema,status:z.enum(['pending','acceptedAwaiting','accepted','needsReview','cancelled','superseded']),createdAt:z.iso.datetime(),sourceDeviceId:z.uuid().optional(),replacesId:z.uuid().optional(),replacementId:z.uuid().optional(),resolvedAt:z.iso.datetime().optional(),resolution:z.string().max(300).optional(),error:z.string().max(500).optional()});
const archiveSchema=z.object({version:z.union([z.literal(1),z.literal(2)]),exportedAt:z.iso.datetime(),organizationId:z.enum(['grills','bistro']),commands:z.array(rowSchema).max(5000)});
export type RecoveryPreview={archive:z.infer<typeof archiveSchema>;newCount:number;duplicateCount:number;acceptedCount:number;legacyCount:number};
export async function previewRecovery(text:string,scope:DemoProfile):Promise<RecoveryPreview>{
 if(new TextEncoder().encode(text).length>10*1024*1024)throw new Error('الملف يتجاوز الحد المسموح: ١٠ ميجابايت.');
 let archive:z.infer<typeof archiveSchema>;try{archive=archiveSchema.parse(JSON.parse(text));}catch{throw new Error('ملف الاسترداد غير صالح أو إصداره غير مدعوم.');}
 if(archive.organizationId!==scope)throw new Error('ملف الاسترداد يخص مؤسسة أخرى.');
 const snapshot=requireGrant(await local.snapshots.get(scope));const accepted=new Set(snapshot.acceptedOperationIds);const seen=new Set<string>();let newCount=0,duplicateCount=0,acceptedCount=0;
 for(const row of archive.commands){
  if(row.scope!==scope||row.command.organizationId!==scope||row.id!==row.command.operationId||seen.has(row.id))throw new Error('هوية أو نطاق عملية غير صالح داخل الملف.');seen.add(row.id);
  if(!snapshot.items.some(i=>i.id===row.command.itemId)||!snapshot.locations.some(l=>l.id===row.command.locationId))throw new Error('يحتوي الملف مادة أو موقعاً غير متاح في المؤسسة الحالية.');
  const existing=await local.commands.get(row.id);
  if(existing){if(existing.scope!==scope||JSON.stringify(commandSchema.parse(existing.command))!==JSON.stringify(row.command))throw new Error('يوجد معرّف عملية بنفس الرقم وبيانات مختلفة. لم يُستورد أي شيء.');duplicateCount++;}
  else if(accepted.has(row.id))acceptedCount++;
  else newCount++;
 }
 return {archive,newCount,duplicateCount,acceptedCount,legacyCount:archive.commands.filter(r=>!r.sourceDeviceId).length};
}
export async function restoreRecovery(text:string,scope:DemoProfile){
 return local.transaction('rw',local.commands,local.snapshots,async()=>{
  const preview=await previewRecovery(text,scope);const snapshot=requireGrant(await local.snapshots.get(scope));const accepted=new Set(snapshot.acceptedOperationIds);
  for(const row of preview.archive.commands){
   if(await local.commands.get(row.id)||accepted.has(row.id))continue;
   // A file cannot prove server acceptance. Same-ID delivery safely reconciles it.
   const status=row.status==='cancelled'||row.status==='superseded'?row.status:row.status==='needsReview'?'needsReview':'pending';
   await local.commands.add({...row,status});
  }
  return preview;
 });
}
export async function downloadRecovery(scope:DemoProfile){const rows=await local.commands.where('scope').equals(scope).toArray();const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),organizationId:scope,commands:rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`fodo-recovery-${scope}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
