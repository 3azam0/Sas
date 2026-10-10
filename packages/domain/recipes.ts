import {BusinessError,type RecipeDefinition,type RecipeVersion,type Snapshot} from '@saas/contracts';
import {decimal} from './index';

const knownUnits:Record<string,'g'|'kg'|'ml'|'l'>={'كجم':'kg','كيلوجرام':'kg','كيلو':'kg',kg:'kg','جم':'g','جرام':'g',g:'g','لتر':'l',l:'l','مل':'ml','ملليلتر':'ml',ml:'ml'};
export function recipeUnitOptions(baseName:string){const unit=knownUnits[baseName.trim().toLowerCase()];return unit==='g'||unit==='kg'?['base','g','kg'] as const:unit==='ml'||unit==='l'?['base','ml','l'] as const:['base'] as const;}
export function recipeConversion(baseName:string,inputUnit:string){
 if(inputUnit==='base')return '1';const unit=knownUnits[baseName.trim().toLowerCase()];
 if(!unit||!recipeUnitOptions(baseName).some(option=>option===inputUnit))throw new BusinessError('INVALID_UNIT','وحدة المكون لا تطابق بُعد وحدة المخزون.');
 if(unit===inputUnit)return '1';return unit==='g'||unit==='ml'?'1000':'0.001';
}
export function validateRecipe(snapshot:Pick<Snapshot,'items'|'units'|'recipeVersions'>,recipeId:string,d:RecipeDefinition,activeRequired=true){
 if(!snapshot.units?.some(u=>u.id===d.outputUnitId))throw new BusinessError('INVALID_UNIT','وحدة الناتج غير متاحة.');
 if(d.outputMode==='stocked'&&!snapshot.items.some(i=>i.id===d.outputItemId&&i.unitId===d.outputUnitId&&(!activeRequired||i.active!==false)))throw new BusinessError('INVALID_OUTPUT','مادة الناتج غير متاحة أو لا تطابق وحدة الناتج.');
 for(const line of d.lines){
  const child=line.kind==='recipe'?snapshot.recipeVersions?.find(v=>v.versionId===line.versionId):undefined;
  const item=line.kind==='material'?snapshot.items.find(i=>i.id===line.itemId):undefined;
  if(line.kind==='material'&&(!item||activeRequired&&item.active===false))throw new BusinessError('INVALID_REFERENCE','إحدى مواد الوصفة غير متاحة أو غير نشطة.');
  if(line.kind==='recipe'&&!child)throw new BusinessError('INVALID_REFERENCE','إصدار الوصفة الفرعية غير متاح.');
  if(child&&child.definition.effectiveDate>d.effectiveDate)throw new BusinessError('INVALID_EFFECTIVE_DATE','تاريخ الوصفة الفرعية يأتي بعد تاريخ الوصفة الأم.');
  if(line.unitId!==(item?.unitId??child?.definition.outputUnitId))throw new BusinessError('INVALID_UNIT','وحدة المكون لا تطابق وحدته الأساسية.');
  const name=snapshot.units?.find(u=>u.id===line.unitId)?.name;if(!name)throw new BusinessError('INVALID_UNIT','وحدة المكون غير متاحة.');
  const q=decimal(line.enteredQuantity).mul(recipeConversion(name,line.inputUnit));if(q.decimalPlaces()>6||!q.eq(line.quantity))throw new BusinessError('INVALID_CONVERSION','الكمية الأساسية لا تطابق كمية المكون المدخلة.');
  if(d.outputMode==='stocked'&&(item?.id===d.outputItemId||child?.definition.outputItemId===d.outputItemId))throw new BusinessError('RECIPE_CYCLE','الناتج لا يمكن أن يكون مكوناً لنفسه.');
 }
 validateRecipeGraph(recipeId,d,snapshot.recipeVersions??[]);
}
export function validateRecipeGraph(recipeId:string,definition:RecipeDefinition,versions:RecipeVersion[]){
 let nodes=0;const visit=(id:string,d:RecipeDefinition,path:Set<string>,depth:number)=>{
  if(path.has(id))throw new BusinessError('RECIPE_CYCLE','يوجد اعتماد دائري بين الوصفات.');if(depth>20||++nodes>1000)throw new BusinessError('RECIPE_TOO_COMPLEX','الوصفة تتجاوز حدود التداخل الآمنة (٢٠ مستوى / ١٠٠٠ عقدة).');
  const next=new Set(path).add(id);for(const line of d.lines)if(line.kind==='recipe'){const child=versions.find(v=>v.versionId===line.versionId);if(!child)throw new BusinessError('INVALID_REFERENCE','إصدار فرعي مفقود.');visit(child.recipeId,child.definition,next,depth+1);}
 };visit(recipeId,definition,new Set(),1);
}
export type RecipeRequirement={itemId:string;quantity:string;paths:string[]};
export function resolveRecipe(recipeId:string,definition:RecipeDefinition,versions:RecipeVersion[],expandStocked=false):RecipeRequirement[]{
 validateRecipeGraph(recipeId,definition,versions);const result=new Map<string,RecipeRequirement>();let nodes=0;
 const add=(itemId:string,q:string,path:string)=>{const old=result.get(itemId);const total=decimal(old?.quantity??'0').add(q);if(total.gt('1000000000000000'))throw new BusinessError('RECIPE_TOO_COMPLEX','كمية المكونات المحسوبة تتجاوز الحد الآمن.');result.set(itemId,{itemId,quantity:total.toString(),paths:[...old?.paths??[],path]});};
 const visit=(d:RecipeDefinition,factor:string,path:string)=>{if(++nodes>1000)throw new BusinessError('RECIPE_TOO_COMPLEX','التوسع في المكونات يتجاوز الحد الآمن.');for(const l of d.lines){const q=decimal(l.quantity).mul(factor);if(l.kind==='material')add(l.itemId,q.toString(),path);else{const child=versions.find(v=>v.versionId===l.versionId)!;const childPath=path+' ← '+child.definition.name+' (v'+child.versionNumber+')';if(child.definition.outputMode==='stocked'&&!expandStocked)add(child.definition.outputItemId!,q.toString(),childPath);else visit(child.definition,q.div(child.definition.outputQuantity).toString(),childPath);}}};
 visit(definition,'1',definition.name);return [...result.values()];
}
export function estimateRecipe(snapshot:Snapshot,recipeId:string,d:RecipeDefinition,locationId:string,policy:'stock_average'|'latest_receipt'='stock_average',expandStocked=false){
 const requirements=resolveRecipe(recipeId,d,snapshot.recipeVersions??[],expandStocked);
 const lines=requirements.map(r=>{const balance=snapshot.balances.find(b=>b.locationId===locationId&&b.itemId===r.itemId),price=snapshot.receiptPrices?.find(p=>p.locationId===locationId&&p.itemId===r.itemId);const unitCost=policy==='stock_average'?balance&&decimal(balance.quantity).gt(0)?decimal(balance.value).div(balance.quantity).toString():null:price?.unitCost??null;
  return {...r,unitCost,amount:unitCost===null?null:decimal(r.quantity).mul(unitCost).toString(),available:balance?.quantity??'0',shortage:decimal(balance?.quantity??'0').lt(r.quantity),source:policy==='stock_average'?'متوسط المخزون المتبقي':price?`آخر استلام · ${price.businessDate}`:'لا يوجد سعر استلام',sourceOperationId:policy==='latest_receipt'?price?.sourceOperationId:undefined};});
 const complete=!!locationId&&lines.every(l=>l.amount!==null),knownSubtotal=lines.reduce((s,l)=>s.add(l.amount??'0'),decimal('0')).toString();const batchCost=complete?knownSubtotal:null,unitCost=batchCost===null?null:decimal(batchCost).div(d.outputQuantity).toString();const positiveSale=d.salePrice!==undefined&&decimal(d.salePrice).gt(0);
 return {lines,complete,knownSubtotal,batchCost,unitCost,foodCostPercent:unitCost!==null&&positiveSale?decimal(unitCost).div(d.salePrice!).mul('100').toString():null,grossContribution:unitCost!==null&&positiveSale?decimal(d.salePrice!).sub(unitCost).toString():null};
}
