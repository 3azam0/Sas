import {BusinessError,type Snapshot,type ProductionDocument,type KitchenIssueDocument} from '@saas/contracts';
import type {PreparationPlan} from '../contracts/preparation';
import {decimal} from './index';
import {resolveRecipe,validateRecipe} from './recipes';
import {productionRequirements} from './production';
import Decimal from 'decimal.js';

export type PlanProduction={id:string;document:ProductionDocument;status:string;replacementId?:string};
export type PlanSupply={id:string;document:KitchenIssueDocument;status:string};
export function validatePreparationPlan(snapshot:Snapshot,p:PreparationPlan){
 if(p.organizationId!==snapshot.organizationId||p.generation!==snapshot.generation)throw new BusinessError('STALE_GENERATION','الخطة تخص مؤسسة أو نسخة بيانات أخرى.');
 const kitchen=snapshot.kitchens?.find(k=>k.id===p.kitchenId&&k.active),source=snapshot.locations.find(l=>l.id===p.sourceLocationId&&l.active!==false);
 if(!kitchen?.locationId||!snapshot.locations.some(l=>l.id===kitchen.locationId&&l.active!==false)||!source||source.id===kitchen.locationId)throw new BusinessError('INVALID_REFERENCE','اختر مطبخاً ومصدراً نشطين ومختلفين.');
 for(const line of p.lines){
  const version=snapshot.recipeVersions?.find(v=>v.versionId===line.versionId);if(!version)throw new BusinessError('INVALID_RECIPE','إصدار الوصفة غير متاح في البيانات المقبولة.');
  if(version.definition.effectiveDate>p.businessDate)throw new BusinessError('INVALID_EFFECTIVE_DATE','إصدار الوصفة لا يسري في تاريخ الخطة.');
  validateRecipe(snapshot,version.recipeId,version.definition);
  if(version.definition.outputMode==='stocked'&&(line.completed!=='0'||line.discarded!=='0'))throw new BusinessError('INVALID_ACTUAL','التحضير المخزني يأخذ الناتج والهالك من دفعة الإنتاج.');
 }
 return kitchen;
}
/** Only explicitly linked, accepted production contributes actual output. */
export function preparationProgress(snapshot:Snapshot,p:PreparationPlan,productions:PlanProduction[]=[]){
 return p.lines.map(line=>{
  const version=snapshot.recipeVersions?.find(v=>v.versionId===line.versionId),stocked=version?.definition.outputMode==='stocked';
  let actual=decimal(stocked?'0':line.completed),wasteValue=decimal('0'),pending=0,review=0,unknown=0;const documents:PlanProduction[]=[],seen=new Set<string>();
  for(const link of p.links.filter(l=>l.kind==='production'&&l.lineId===line.id)){
   const inScope=(r:PlanProduction)=>r.document.generation===p.generation&&r.document.organizationId===p.organizationId;
   let operationId=link.operationId,local=productions.find(r=>r.id===operationId&&inScope(r));const chain=new Set<string>();
   while(local?.status==='superseded'&&local.replacementId&&!chain.has(operationId)&&chain.size<20){chain.add(operationId);operationId=local.replacementId;local=productions.find(r=>r.id===operationId&&inScope(r));}
   if(chain.has(operationId)||chain.size>=20){unknown++;continue;}
   if(seen.has(operationId))continue;seen.add(operationId);
   const posted=snapshot.productions?.find(r=>r.document.operationId===operationId),accepted=!!posted||snapshot.acceptedOperationIds.includes(operationId)||local?.status==='accepted';
   const doc=posted?.document??local?.document;
   if(!doc){if(accepted||chain.size)unknown++;continue;}
   const kitchen=snapshot.kitchens?.find(k=>k.id===p.kitchenId);
   if(doc.versionId!==line.versionId||doc.inputLocationId!==kitchen?.locationId||doc.outputLocationId!==kitchen?.locationId||doc.businessDate!==p.businessDate){unknown++;continue;}
   documents.push({id:doc.operationId,document:doc,status:accepted?'accepted':local?.status??'unknown'});
   if(accepted){actual=actual.add(doc.actualOutput);if(posted)wasteValue=wasteValue.add(posted.wasteAmount);}
   else if(local?.status==='pending'||local?.status==='acceptedAwaiting')pending++;
   else if(local?.status==='needsReview')review++;
  }
  return {line,version,stocked,actual:actual.toString(),remaining:Decimal.max(decimal(line.quantity).sub(actual),0).toString(),variance:actual.sub(line.quantity).toString(),discarded:stocked?null:line.discarded,wasteValue:wasteValue.toString(),pending,review,unknown,documents};
 });
}
export function preparationRequirements(snapshot:Snapshot,p:PreparationPlan,productions:PlanProduction[]=[]){
 const kitchen=validatePreparationPlan(snapshot,p),progress=preparationProgress(snapshot,p,productions),requirements=new Map<string,ReturnType<typeof decimal>>();
 if(progress.some(r=>r.unknown))throw new BusinessError('INCOMPLETE_HISTORY','بعض دفعات التنفيذ غير متاحة؛ زامن البيانات أو راجع سجل الإنتاج قبل حساب المتبقي.');
 for(const row of progress){
  if(decimal(row.remaining).isZero())continue;const version=row.version!;
  const inputs=row.stocked?productionRequirements(snapshot,version.versionId,row.remaining).lines:resolveRecipe(version.recipeId,version.definition,snapshot.recipeVersions??[]).map(l=>({...l,quantity:decimal(l.quantity).mul(row.remaining).div(version.definition.outputQuantity).toString()}));
  for(const input of inputs)requirements.set(input.itemId,(requirements.get(input.itemId)??decimal('0')).add(input.quantity));
 }
 if(requirements.size>200)throw new BusinessError('PLAN_TOO_LARGE','قسّم الخطة؛ الحد ٢٠٠ مادة.');
 const materials=[...requirements].map(([itemId,value])=>{
  const item=snapshot.items.find(i=>i.id===itemId&&i.active!==false&&i.unitId);if(!item)throw new BusinessError('INVALID_REFERENCE','إحدى مواد الخطة غير نشطة أو وحدتها مفقودة.');
  const required=value.toDecimalPlaces(6,2);if(required.gt('999999999.999999'))throw new BusinessError('PLAN_TOO_LARGE','قسّم الخطة؛ كمية المادة تتجاوز الحد.');
  const available=Decimal.max(snapshot.balances.find(b=>b.locationId===kitchen.locationId&&b.itemId===itemId)?.quantity??'0',0),source=Decimal.max(snapshot.balances.find(b=>b.locationId===p.sourceLocationId&&b.itemId===itemId)?.quantity??'0',0),shortage=Decimal.max(required.sub(available),0),suggested=Decimal.min(shortage,source);
  return {itemId,name:item.name,sku:item.sku,unit:item.unit,unitId:item.unitId!,required:required.toString(),available:available.toString(),shortage:shortage.toString(),source:source.toString(),suggested:suggested.toString(),uncovered:shortage.sub(suggested).toString()};
 }).filter(r=>decimal(r.required).gt(0)).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
 return {kitchen,progress,materials};
}
export function preparationSupplyPending(snapshot:Snapshot,p:PreparationPlan,supplies:PlanSupply[]){
 return p.links.some(link=>link.kind==='supply'&&!snapshot.acceptedOperationIds.includes(link.operationId)&&supplies.some(r=>r.id===link.operationId&&r.document.organizationId===p.organizationId&&r.document.generation===p.generation&&['pending','acceptedAwaiting','needsReview'].includes(r.status)));
}
