import {posOrderCommandSchema,type POSOrderCommand,type Snapshot,type CommandResult} from '@saas/contracts';
import {local,bootstrap} from './offline';
const pendingKey=(s:Snapshot)=>JSON.stringify(['pos-order-pending',s.organizationId,s.generation,s.access.deviceId,s.access.userId]);
export async function pendingPOSOrder(snapshot:Snapshot):Promise<POSOrderCommand|undefined>{const row=await local.preferences.get(pendingKey(snapshot));return row?posOrderCommandSchema.parse(JSON.parse(row.value)):undefined;}
export async function sendPOSOrder(snapshot:Snapshot,command:POSOrderCommand):Promise<Snapshot>{
 const c=posOrderCommandSchema.parse(command);if(c.organizationId!==snapshot.organizationId||c.generation!==snapshot.generation)throw new Error('نسخة الطلب لا تطابق الجلسة.');
 const key=pendingKey(snapshot);
 await local.transaction('rw',local.preferences,async()=>{const prior=await local.preferences.get(key);if(prior&&prior.value!==JSON.stringify(c))throw new Error('توجد عملية لم يتأكد قبولها. أعد محاولتها أولاً.');await local.preferences.put({key,value:JSON.stringify(c)});});
 const response=await fetch('/api/v1/pos-orders',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':c.generation},body:JSON.stringify(c),signal:AbortSignal.timeout(25000)});
 const result=await response.json() as CommandResult;
 if(!response.ok||result.outcome!=='accepted'){
  if(response.status>=400&&response.status<500&&![401,403,408,429].includes(response.status))await local.preferences.delete(key);
  throw new Error(result.message??'تعذر تأكيد الطلب. العملية محفوظة لإعادة المحاولة.');
 }
 const fresh=await bootstrap(snapshot.organizationId);await local.preferences.delete(key);return fresh;
}
