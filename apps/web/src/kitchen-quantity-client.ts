'use client';

import type {Snapshot} from '@saas/contracts';
import {kitchenIssueRevisionSchema,type KitchenIssueRevisionCommand,type KitchenQuantityCorrection} from '../../../packages/contracts/document-corrections';
import {decimal} from '@saas/domain';
import {bootstrap,local} from './offline';

const correctionKey=(snapshot:Snapshot,sourceId:string)=>JSON.stringify([
 'kitchen-quantity-correction',snapshot.organizationId,snapshot.generation,snapshot.access.userId,sourceId
]);

export async function pendingKitchenRevision(snapshot:Snapshot,sourceId:string){
 const row=await local.preferences.get(correctionKey(snapshot,sourceId));
 return row?kitchenIssueRevisionSchema.parse(JSON.parse(row.value)):undefined;
}

export async function pendingKitchenQuantityCorrection(snapshot:Snapshot,sourceId:string){
 const pending=await pendingKitchenRevision(snapshot,sourceId);
 return pending?.kind==='kitchen_quantity'?pending:undefined;
}

export function confirmKitchenQuantityCorrection(snapshot:Snapshot,input:KitchenQuantityCorrection){
 return confirmKitchenRevision(snapshot,input);
}

function canRetry(saved:KitchenIssueRevisionCommand,requested:KitchenIssueRevisionCommand){
 if(saved.operationId===requested.operationId)return true;
 return saved.kind==='kitchen_quantity'&&requested.kind==='kitchen_quantity'
  &&saved.lineId===requested.lineId&&decimal(saved.quantity).eq(requested.quantity)&&saved.reason===requested.reason;
}

export async function confirmKitchenRevision(snapshot:Snapshot,input:KitchenIssueRevisionCommand){
 const command=kitchenIssueRevisionSchema.parse(input),key=correctionKey(snapshot,command.sourceId);
 if(command.organizationId!==snapshot.organizationId||command.generation!==snapshot.generation)throw Error('تغيرت مساحة العمل. افتح المستند مجدداً.');
 if(!navigator.onLine)throw Error('تأكيد تعديل المستند يحتاج اتصالاً بالإنترنت.');
 const sending=await local.transaction('rw',local.preferences,async()=>{
  const pending=await pendingKitchenRevision(snapshot,command.sourceId);
  if(pending){
   if(!canRetry(pending,command))throw Error('يوجد تعديل غير مؤكد. افتح تعديل المستند لإعادة تأكيد الطلب المحفوظ.');
   return pending;
  }
  await local.preferences.put({key,value:JSON.stringify(command)});
  return command;
 });
 const clear=()=>local.transaction('rw',local.preferences,async()=>{
  const pending=await pendingKitchenRevision(snapshot,command.sourceId);
  if(pending?.operationId===sending.operationId)await local.preferences.delete(key);
 });
 let response:Response;
 try{
  response=await fetch('/api/v1/document-corrections',{
   method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':sending.generation},
   body:JSON.stringify(sending),signal:AbortSignal.timeout(30000)
  });
 }catch{
  throw Error('لم يتأكد حفظ التصحيح. الطلب محفوظ لإعادة المحاولة.');
 }
 const result=await response.json().catch(()=>null);
 if(!response.ok){
  if(response.status>=400&&response.status<500&&![401,403,408,429].includes(response.status))await clear();
  throw Error(result?.message??'لم يتأكد حفظ التصحيح. أعد المحاولة.');
 }
 if(result?.operationId!==sending.operationId||result.outcome!=='accepted')throw Error('لم يتأكد حفظ التصحيح. أعد المحاولة.');
 await clear();
 return bootstrap(snapshot.organizationId).then(()=>true,()=>false);
}
