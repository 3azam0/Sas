import {local} from './offline';
import {workshopCommandSchema,type WorkshopCommand} from '../../../packages/contracts/butchery';
import type {DemoProfile} from '@saas/contracts';

export type WorkshopRow={id:string;scope:DemoProfile;command:WorkshopCommand;status:'pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled';error?:string;createdAt:string};
export async function saveWorkshop(command:WorkshopCommand){
 const c=workshopCommandSchema.parse(command),snapshot=await local.snapshots.get(c.organizationId);
 if(!snapshot||!Number.isFinite(Date.parse(snapshot.access.expiresAt))||Date.parse(snapshot.access.expiresAt)<=Date.now())throw new Error('جدد الجلسة أولاً؛ العمليات السابقة محفوظة');
 await local.workshop.add({id:c.operationId,scope:c.organizationId,command:c,status:'pending',createdAt:c.capturedAt});
}
export async function resolveWorkshop(scope:DemoProfile,id:string,action:'retry'|'cancel') {
 const row=await local.workshop.get(id),snapshot=await local.snapshots.get(scope);
 if(!row||row.scope!==scope||row.status!=='needsReview'||snapshot?.acceptedOperationIds.includes(id))throw new Error('يمكن معالجة العمليات المرفوضة فقط');
 if(action==='retry'&&(!snapshot||Date.parse(snapshot.access.expiresAt)<=Date.now()))throw new Error('جدد الجلسة أولاً');
 await local.workshop.update(id,{status:action==='retry'?'pending':'cancelled',error:undefined});
}
export async function syncWorkshop(scope:DemoProfile) {
 const rows=await local.workshop.where('scope').equals(scope).sortBy('createdAt');
 for(const row of rows.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting')) {
  const response=await fetch('/api/v1/workshop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row.command)});
  if(response.status===401||response.status===403)throw new Error('الجلسة أو الصلاحيات تغيرت؛ عمليات المطبخ المركزي محفوظة');
  if(response.status>=500||response.status===429)throw new Error('تعذرت مزامنة المطبخ المركزي؛ العمليات محفوظة');
  const result=await response.json();
  await local.workshop.update(row.id,response.ok&&result.outcome==='accepted'?{status:'acceptedAwaiting',error:undefined}:{status:'needsReview',error:result.message||'راجع العملية'});
 }
}
