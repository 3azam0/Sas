import {transferRevisionSchema,type Snapshot,type TransferEditCommand,type TransferRevisionCommand} from '@saas/contracts';
import {local} from './offline';

type TransferTarget=Pick<TransferEditCommand,'transferId'|'expectedRevision'|'reason'>;
type TransferChanges=TransferTarget&Pick<TransferEditCommand,'businessDate'|'reference'|'lines'>;
export const saveTransferEdit=(snapshot:Snapshot,edit:TransferChanges)=>submitTransferRevision(snapshot,{type:'transfer.edit',...edit});
export const voidTransfer=(snapshot:Snapshot,edit:TransferTarget)=>submitTransferRevision(snapshot,{type:'transfer.void',...edit});

async function submitTransferRevision(snapshot:Snapshot,edit:({type:'transfer.edit'}&TransferChanges)|({type:'transfer.void'}&TransferTarget)){
 if(!navigator.onLine)throw Error('تعديل أو إلغاء التحويل المقبول يحتاج اتصالاً بالإنترنت.');
 const draft=transferRevisionSchema.parse({organizationId:snapshot.organizationId,generation:snapshot.generation,operationId:crypto.randomUUID(),...edit});
 const key=`transfer-edit:${snapshot.organizationId}:${snapshot.generation}:${edit.transferId}`;
 const saved=await local.preferences.get(key);
 const pending=saved?transferRevisionSchema.parse(JSON.parse(saved.value)):undefined;
 const acknowledged=pending&&snapshot.acceptedOperationIds.includes(pending.operationId);
 const command=pending&&!acknowledged?pending:draft;
 const comparable=({operationId,...rest}:TransferRevisionCommand)=>JSON.stringify(rest.type==='transfer.edit'?{...rest,lines:[...rest.lines].sort((a,b)=>a.itemId.localeCompare(b.itemId))}:rest);
 if(pending&&!acknowledged&&comparable(command)!==comparable(draft))throw Error('يوجد تعديل لم يتأكد بعد. أعد نفس البيانات أو زامن للتحقق من قبوله.');
 if(command===draft)await local.preferences.put({key,value:JSON.stringify(command)});
 const response=await fetch('/api/v1/transfers',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':command.generation},body:JSON.stringify(command),signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 if(!response.ok){
  if(response.status>=400&&response.status<500&&![401,408,429].includes(response.status))await local.preferences.delete(key);
  throw Error(result.message??'تعذر تأكيد تعديل التحويل.');
 }
 if(result.operationId!==command.operationId||result.outcome!=='accepted')throw Error('تعذر تأكيد التعديل. أعد نفس البيانات لتأكيد الطلب المحفوظ.');
 await local.preferences.delete(key);
}
