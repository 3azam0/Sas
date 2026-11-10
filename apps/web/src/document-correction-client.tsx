'use client';
import type {Snapshot,OpeningDocument,ReceiptDocument,KitchenIssueDocument} from '@saas/contracts';
import {documentCorrectionSchema,documentReplacementSchema,kitchenVoidSchema,type DocumentCorrectionCommand,type DocumentReplacementCommand} from '../../../packages/contracts/document-corrections';
import {bootstrap,local} from './offline';
export function CorrectionReason({reason,setReason}:{reason:string;setReason:(s:string)=>void}){return <label className="accepted-correction-reason">سبب تصحيح المستند المقبول<input aria-label="سبب تصحيح المستند" required minLength={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/><small>يمكنك إضافة مادة أو تعديل سطر أو حذفه من القائمة، ثم حفظ المستند كاملًا. يُحفظ الأصل مع عكس مرتبط ومستند بديل. إذا استُخدم المخزون أو أُقفلت الفترة، يلزم تصحيح الحركات التابعة أولاً.</small></label>;}
export function CorrectionLink({snapshot,id}:{snapshot:Snapshot;id:string}){const c=snapshot.documentCorrections?.find(c=>c.sourceId===id);const parent=snapshot.documentCorrections?.find(c=>c.replacementId===id);return <>{c&&<p className="notice">{c.replacementId===c.operationId?'أُلغي هذا المستند.':<>صُحح هذا المستند. المستند البديل: <bdi>{c.replacementId}</bdi></>} · {c.reason}</p>}{parent&&<p>تصحيح للمستند: <bdi>{parent.sourceId}</bdi> · {parent.reason}</p>}</>;}
export const canCorrectDocument=(s:Snapshot,id:string)=>['owner','manager'].includes(s.access.role??'')&&!s.documentCorrections?.some(c=>c.sourceId===id);
const correctionKey=(snapshot:Snapshot,sourceId:string)=>`document-correction:${snapshot.organizationId}:${snapshot.generation}:${sourceId}`;
export async function correctAcceptedDocument(snapshot:Snapshot,sourceId:string,kind:'opening'|'receipt'|'kitchen',replacement:OpeningDocument|ReceiptDocument|KitchenIssueDocument,reason:string){
 if(reason.trim().length<2||reason.trim().length>500)throw Error('أدخل سبب التصحيح من حرفين إلى ٥٠٠ حرف.');
 if(!navigator.onLine)throw Error('تصحيح المستندات المقبولة يحتاج اتصالاً بالإنترنت.');
 const key=correctionKey(snapshot,sourceId),saved=await local.preferences.get(key);
 const comparable=(doc:typeof replacement)=>{const {operationId,capturedAt,...rest}=doc;return JSON.stringify({...rest,lines:doc.lines.map(({lineId,...l})=>l).sort((a,b)=>a.itemId.localeCompare(b.itemId))});};
 let command:DocumentReplacementCommand;
 if(saved){const pending=documentCorrectionSchema.parse(JSON.parse(saved.value));if(pending.kind!==kind||comparable(pending.replacement)!==comparable(replacement)||pending.reason!==reason.trim())throw Error('يوجد طلب تصحيح غير مؤكد ببيانات مختلفة. أعد نفس البيانات لتأكيده أو حدّث مساحة العمل للتحقق من المستند البديل أولاً.');command=pending;}
 else{command=documentReplacementSchema.parse({operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,sourceId,kind,reason,businessDate:replacement.businessDate,replacement});await local.preferences.put({key,value:JSON.stringify(command)});}
 return sendDocumentCorrection(snapshot,sourceId,key,command);
}

export async function voidKitchenDocument(snapshot:Snapshot,sourceId:string,reason:string){
 if(!navigator.onLine)throw Error('إلغاء المستندات المقبولة يحتاج اتصالاً بالإنترنت.');
 const key=correctionKey(snapshot,sourceId),saved=await local.preferences.get(key);
 const businessDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const command=saved?documentCorrectionSchema.parse(JSON.parse(saved.value)):kitchenVoidSchema.parse({operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,sourceId,kind:'kitchen_void',reason,businessDate});
 if(command.kind!=='kitchen_void'||command.reason!==reason.trim())throw Error('يوجد طلب غير مؤكد لهذا المستند. أعد نفس البيانات أو زامن للتحقق من حالته.');
 if(!saved)await local.preferences.put({key,value:JSON.stringify(command)});
 await sendDocumentCorrection(snapshot,sourceId,key,command);
}

async function sendDocumentCorrection(snapshot:Snapshot,sourceId:string,key:string,command:DocumentCorrectionCommand){
 if(command.sourceId!==sourceId||command.organizationId!==snapshot.organizationId||command.generation!==snapshot.generation)throw Error('طلب التصحيح المحفوظ يخص نطاقاً آخر.');
 const response=await fetch('/api/v1/document-corrections',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':snapshot.generation??''},body:JSON.stringify(command),signal:AbortSignal.timeout(30000)}),result=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500&&![401,408,429].includes(response.status))await local.preferences.delete(key);throw Error(result.message??'تعذر تأكيد التصحيح. الطلب محفوظ لإعادة التأكيد.');}
 if(result.operationId!==command.operationId||result.outcome!=='accepted')throw Error('لم تتأكد هوية التصحيح. أعد المحاولة لتأكيد الطلب المحفوظ.');
 await local.preferences.delete(key);await bootstrap(snapshot.organizationId).catch(()=>undefined);return result.replacementId as string;
}
