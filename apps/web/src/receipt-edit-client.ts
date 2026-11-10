import type {ReceiptDocument,Snapshot} from '@saas/contracts';
import {receiptRevisionSchema,type ReceiptRevisionCommand} from '../../../packages/contracts/document-corrections';
import {local} from './offline';

type ReceiptTarget={sourceId:string;expectedRevision:number;reason:string};
export const saveReceiptEdit=(snapshot:Snapshot,target:ReceiptTarget,document:ReceiptDocument)=>submit(snapshot,{...target,kind:'receipt_edit',document});
export const voidReceipt=(snapshot:Snapshot,target:ReceiptTarget)=>submit(snapshot,{...target,kind:'receipt_void'});

async function submit(snapshot:Snapshot,draft:ReceiptTarget&({kind:'receipt_edit';document:ReceiptDocument}|{kind:'receipt_void'})){
 if(!navigator.onLine)throw Error('تعديل أو إلغاء الاستلام المقبول يحتاج اتصالاً بالإنترنت.');
 const command=receiptRevisionSchema.parse({...draft,operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation});
 const key=`receipt-edit:${snapshot.organizationId}:${snapshot.generation}:${draft.sourceId}`;
 const saved=await local.preferences.get(key);
 const pending=saved?receiptRevisionSchema.parse(JSON.parse(saved.value)):undefined;
 const unconfirmed=pending&&!snapshot.acceptedOperationIds.includes(pending.operationId)?pending:undefined;
 const comparable=({operationId,...rest}:ReceiptRevisionCommand)=>JSON.stringify(rest.kind==='receipt_edit'?{
  ...rest,document:{...rest.document,lines:rest.document.lines.map(({lineId,...line})=>line).sort((a,b)=>a.itemId.localeCompare(b.itemId))},
 }:rest);
 if(unconfirmed&&comparable(unconfirmed)!==comparable(command))throw Error('يوجد تعديل لم يتأكد بعد. أعد نفس البيانات أو زامن للتحقق من قبوله.');
 const sending=unconfirmed??command;
 if(!unconfirmed)await local.preferences.put({key,value:JSON.stringify(sending)});
 const response=await fetch('/api/v1/document-corrections',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':sending.generation},body:JSON.stringify(sending),signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 if(!response.ok){
  if(response.status>=400&&response.status<500&&![401,408,429].includes(response.status))await local.preferences.delete(key);
  throw Error(result.message??'تعذر تأكيد تعديل مستند الاستلام.');
 }
 if(result.operationId!==sending.operationId||result.outcome!=='accepted')throw Error('تعذر تأكيد التعديل. أعد نفس البيانات لتأكيد الطلب المحفوظ.');
 await local.preferences.delete(key);
}
