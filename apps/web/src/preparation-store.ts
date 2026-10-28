import {local} from './offline';
import {preparationPlanSchema,type PreparationPlan} from '../../../packages/contracts/preparation';
import {validatePreparationPlan} from '../../../packages/domain/preparation';
const prefix=(organizationId:string,generation:string)=>`preparation:v1:${organizationId}:${generation}:`;
export async function preparationPlans(organizationId:string,generation:string){
 const rows=await local.preferences.where('key').startsWith(prefix(organizationId,generation)).toArray();
 return rows.map(r=>preparationPlanSchema.parse(JSON.parse(r.value))).sort((a,b)=>b.businessDate.localeCompare(a.businessDate)||b.updatedAt.localeCompare(a.updatedAt));
}
/** Plans are device drafts; no stock/outbox writes and no implicit transfer posting. */
export async function savePreparationPlan(input:PreparationPlan,expectedRevision:number){
 const plan=preparationPlanSchema.parse(input);
 return local.transaction('rw',[local.snapshots,local.preferences],async()=>{
  const snapshot=await local.snapshots.get(plan.organizationId);
  if(!snapshot||!Number.isFinite(Date.parse(snapshot.access.expiresAt))||Date.parse(snapshot.access.expiresAt)<=Date.now())throw Error('جدد الجلسة لحفظ الخطة؛ مسودتك الحالية ما زالت مفتوحة.');
  validatePreparationPlan(snapshot,plan);
  const key=prefix(plan.organizationId,plan.generation)+plan.id,old=await local.preferences.get(key),previous=old?preparationPlanSchema.parse(JSON.parse(old.value)):undefined;
  if((previous?.revision??0)!==expectedRevision)throw Error('تغيرت الخطة في نافذة أخرى؛ أعد فتح النسخة المحفوظة.');
  if(previous?.links.some(link=>!plan.links.some(l=>l.operationId===link.operationId&&l.kind===link.kind&&l.lineId===link.lineId)))throw Error('لا يمكن إزالة روابط التنفيذ السابقة.');
  if(previous?.links.length&&(previous.kitchenId!==plan.kitchenId||previous.sourceLocationId!==plan.sourceLocationId||previous.businessDate!==plan.businessDate))throw Error('بعد بدء التنفيذ، أنشئ خطة جديدة لتغيير التاريخ أو المواقع.');
  if(previous?.lines.some(line=>previous.links.some(l=>l.lineId===line.id)&&!plan.lines.some(l=>l.id===line.id&&l.versionId===line.versionId&&l.quantity===line.quantity)))throw Error('لا يمكن تغيير هدف سطر مرتبط بالإنتاج؛ أضف خطة أخرى للزيادة.');
  const saved={...plan,revision:expectedRevision+1,updatedAt:new Date().toISOString()};await local.preferences.put({key,value:JSON.stringify(saved)});return saved;
 });
}
export function preparationBackup(plan:PreparationPlan){return JSON.stringify({format:'fodo-preparation-plan',version:1,plan:preparationPlanSchema.parse(plan)},null,2);}
export async function importPreparationBackup(text:string,organizationId:string,generation:string){
 if(text.length>2000000)throw Error('ملف الخطة كبير جداً.');const envelope=JSON.parse(text);
 if(envelope.format!=='fodo-preparation-plan'||envelope.version!==1)throw Error('ملف خطة غير صالح.');const plan=preparationPlanSchema.parse(envelope.plan);
 if(plan.organizationId!==organizationId||plan.generation!==generation)throw Error('الخطة تخص مؤسسة أو نسخة بيانات أخرى.');
 const old=await local.preferences.get(prefix(organizationId,generation)+plan.id);
 if(old){const saved=preparationPlanSchema.parse(JSON.parse(old.value)),content=(p:PreparationPlan)=>JSON.stringify({...p,revision:0,updatedAt:''});if(content(saved)!==content(plan))throw Error('توجد نسخة مختلفة من الخطة على هذا الجهاز؛ لم تُستبدل.');return saved;}
 return savePreparationPlan({...plan,revision:0},0);
}
