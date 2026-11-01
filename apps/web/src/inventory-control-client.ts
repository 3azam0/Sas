import type {Snapshot} from '@saas/contracts';
import {inventoryControlSchema,type InventoryControlCommand} from '../../../packages/contracts/inventory-operations';
import {local,bootstrap} from './offline';
const key=(s:Snapshot)=>`inventory-control-request:v1:${s.organizationId}:${s.generation}`;
export type PendingInventoryControl={command:InventoryControlCommand;status:'uncertain'|'rejected';error?:string};
export async function pendingInventoryControl(snapshot:Snapshot):Promise<PendingInventoryControl|undefined>{const row=await local.preferences.get(key(snapshot));if(!row)return;const parsed=JSON.parse(row.value) as PendingInventoryControl;parsed.command=inventoryControlSchema.parse(parsed.command);if(parsed.command.organizationId!==snapshot.organizationId||parsed.command.generation!==snapshot.generation)throw Error('طلب المراجعة يخص نطاقاً آخر.');return parsed;}
export async function submitInventoryControl(snapshot:Snapshot,input:InventoryControlCommand){
 const command=inventoryControlSchema.parse(input);if(!navigator.onLine)throw Error('المراجعة والإقفال يحتاجان اتصالاً؛ لم يُنشأ طلب جديد.');
 await local.transaction('rw',[local.preferences,local.snapshots],async()=>{const s=await local.snapshots.get(snapshot.organizationId);if(s?.generation!==command.generation||command.organizationId!==s.organizationId||!s.capabilities?.inventoryControls||!Number.isFinite(Date.parse(s.access.expiresAt))||Date.parse(s.access.expiresAt)<=Date.now())throw Error('حدّث الجلسة ونسخة بيانات المؤسسة.');const old=await pendingInventoryControl(s);if(old&&JSON.stringify(old.command)!==JSON.stringify(command))throw Error('يوجد طلب سابق يحتاج التأكيد أو المراجعة أولاً.');await local.preferences.put({key:key(s),value:JSON.stringify({command,status:'uncertain'})});});
 const response=await fetch('/api/v1/inventory-operations',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':snapshot.generation!},body:JSON.stringify(command),signal:AbortSignal.timeout(20000)}),result=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500&&response.status!==401)await local.preferences.put({key:key(snapshot),value:JSON.stringify({command,status:'rejected',error:result.message})});throw Error(result.message??'تعذر قبول المراجعة؛ الطلب محفوظ للتأكيد.');}
 if(result.operationId!==command.operationId||result.outcome!=='accepted')throw Error('تعذر تأكيد هوية قبول الطلب؛ أعد التأكيد بنفس المعرف.');
 await local.preferences.delete(key(snapshot));await bootstrap(snapshot.organizationId);return result;
}
export async function resolveInventoryControl(snapshot:Snapshot,discard=false){
 const pending=await pendingInventoryControl(snapshot);if(!pending)return;
 const current=await bootstrap(snapshot.organizationId);if(current.generation!==pending.command.generation)throw Error('تغيرت نسخة البيانات. لا يمكن إعادة هذا الطلب.');
 if(current.acceptedOperationIds.includes(pending.command.operationId)){await local.preferences.delete(key(snapshot));return;}
 if(discard){if(pending.status!=='rejected')throw Error('الطلب غير مؤكد؛ أعد تأكيده أولاً.');await local.preferences.delete(key(snapshot));return;}
 await submitInventoryControl(current,pending.command);
}
export async function localWorkNeedingReview(snapshot:Snapshot){let total=0;for(const name of ['commands','setups','openings','purchases','transfers','counts','receipts','recipes','productions','menus','sales','kitchenIssues','finance','kitchenOrders','butchery']){const rows=await local.table(name).where('scope').equals(snapshot.organizationId).toArray();total+=rows.filter(r=>!snapshot.acceptedOperationIds.includes(r.id)&&['pending','acceptedAwaiting','needsReview'].includes(r.status)).length;}return total;}
