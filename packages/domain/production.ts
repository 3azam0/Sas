import {BusinessError,type Snapshot,type ProductionDocument} from '@saas/contracts';
import {decimal,allocateFIFO} from './index';
import {resolveRecipe} from './recipes';

export function productionRequirements(snapshot:Pick<Snapshot,'recipeVersions'>,versionId:string,plannedOutput:string){
 const version=snapshot.recipeVersions?.find(v=>v.versionId===versionId);
 if(!version||version.definition.outputMode!=='stocked')throw new BusinessError('INVALID_RECIPE','اختر إصدار تحضير مخزني منشور.');
 const factor=decimal(plannedOutput).div(version.definition.outputQuantity);
 const lines=resolveRecipe(version.recipeId,version.definition,snapshot.recipeVersions??[]).map(l=>({...l,quantity:decimal(l.quantity).mul(factor).toDecimalPlaces(6).toString()}));
 if(lines.length>200||lines.some(l=>decimal(l.quantity).gt('999999999.999999')))throw new BusinessError('RECIPE_TOO_COMPLEX','قسّم خطة الإنتاج إلى دفعات أصغر (٢٠٠ مادة وحدود الكمية).');
 if(lines.some(l=>l.itemId===version.definition.outputItemId))throw new BusinessError('RECIPE_CYCLE','مادة الناتج لا يمكن استخدامها كمدخل في هذه الدفعة.');
 return {version,lines};
}
export function validateProduction(snapshot:Pick<Snapshot,'recipeVersions'|'items'|'locations'>,doc:ProductionDocument,active=true){
 const plan=productionRequirements(snapshot,doc.versionId,doc.plannedOutput),d=plan.version.definition;
 if(d.effectiveDate>doc.businessDate)throw new BusinessError('INVALID_EFFECTIVE_DATE','إصدار الوصفة لا يسري في تاريخ الإنتاج.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(doc.businessDate>today)throw new BusinessError('FUTURE_DATE','تاريخ الإنتاج لا يمكن أن يكون في المستقبل.');
 if([doc.inputLocationId,doc.outputLocationId].some(id=>!snapshot.locations.some(l=>l.id===id&&(!active||l.active!==false))))throw new BusinessError('INVALID_REFERENCE','مواقع الإنتاج غير متاحة أو غير نشطة.');
 if(!snapshot.items.some(i=>i.id===d.outputItemId&&i.unitId===d.outputUnitId&&(!active||i.active!==false)))throw new BusinessError('INVALID_OUTPUT','مادة الناتج أو وحدتها غير متاحة.');
 if(doc.lines.length!==plan.lines.length||doc.lines.some(l=>!plan.lines.some(r=>r.itemId===l.itemId)||!snapshot.items.some(i=>i.id===l.itemId&&i.unitId===l.unitId&&(!active||i.active!==false))))throw new BusinessError('INVALID_INPUT','مدخلات الإنتاج يجب أن تطابق مواد الإصدار ووحداتها.');
 if(doc.lines.some(l=>decimal(l.abnormalWaste).gt(l.quantity)))throw new BusinessError('INVALID_WASTE','الهالك لا يتجاوز الكمية المستخدمة.');
 return plan;
}
// Two adjacent six-place prices conserve any twelve-place amount at six-place quantity.
export function exactOutputLayers(quantity:string,amount:string){
 const n=decimal(quantity).mul('1000000'),a=decimal(amount).mul('1000000000000');
 if(n.lte(0)||!n.isInteger()||a.lt(0)||!a.isInteger())throw new BusinessError('INVALID_OUTPUT','كمية الناتج وقيمته غير صالحتين.');
 const low=a.div(n).floor(),extra=a.sub(low.mul(n));
 const parts=[{quantity:n.sub(extra).div('1000000').toFixed(6),unitCost:low.div('1000000').toFixed(6)},...(extra.gt(0)?[{quantity:extra.div('1000000').toFixed(6),unitCost:low.add(1).div('1000000').toFixed(6)}]:[])].filter(p=>decimal(p.quantity).gt(0));
 if(parts.some(p=>decimal(p.unitCost).gt('999999999999.999999')))throw new BusinessError('COST_TOO_LARGE','تكلفة وحدة الناتج تتجاوز الحد؛ راجع الكميات.');
 return parts;
}
export function productionWasteValue(amount:string,quantity:string,waste:string,failed:boolean){return failed?decimal(amount).toFixed(12):decimal(quantity).gt(0)?decimal(amount).mul(waste).div(quantity).toFixed(12):'0';}
export function previewProduction(snapshot:Snapshot,doc:ProductionDocument){
 const failed=decimal(doc.actualOutput).isZero();let total=decimal('0'),waste=decimal('0');
 const lines=doc.lines.map(l=>{const balance=snapshot.balances.find(b=>b.locationId===doc.inputLocationId&&b.itemId===l.itemId),shortage=decimal(balance?.quantity??'0').lt(l.quantity);let amount:string|null=null;
  if(decimal(l.quantity).isZero())amount='0';else if(!shortage){if(snapshot.costing?.method==='fifo')amount=allocateFIFO(snapshot.layers.filter(p=>p.locationId===doc.inputLocationId&&p.itemId===l.itemId),l.quantity).amount;else if(balance&&decimal(balance.quantity).gt(0))amount=decimal(balance.value).mul(l.quantity).div(balance.quantity).toFixed(12);}
  const wasteAmount=amount===null?null:productionWasteValue(amount,l.quantity,l.abnormalWaste,failed);total=total.add(amount??'0');waste=waste.add(wasteAmount??'0');return {...l,amount,wasteAmount,shortage};
 });
 const complete=lines.every(l=>l.amount!==null),outputAmount=complete?total.sub(waste).toFixed(12):null;
 return {lines,complete,inputAmount:complete?total.toFixed(12):null,wasteAmount:complete?waste.toFixed(12):null,outputAmount,unitCost:failed||outputAmount===null?null:decimal(outputAmount).div(doc.actualOutput).toFixed(6),attainment:decimal(doc.actualOutput).div(doc.plannedOutput).mul(100).toString()};
}
