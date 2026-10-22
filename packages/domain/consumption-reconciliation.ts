import type {ConsumptionComparison,CountDefinition,RecipeVersion,SalesLine} from '@saas/contracts';
import {decimal} from './index';
import {resolveRecipe} from './recipes';
import {egyptDate} from './reporting';

export type ReconciliationEntry={sequence:string;operationId:string;itemId:string;locationId:string;quantity:string;amount:string;type:string;businessDate:string;countId:string|null};
export type ReconciliationCount={countId:string;document:CountDefinition;changes:{itemId:string;counted:string;expected:string;amount:string;movementId:string}[]};
export type ReconciliationSale=Pick<SalesLine,'versionId'|'outputPerSale'|'quantity'|'businessDate'>&{locationId:string};
const knownConsumption=new Set(['sales.issue','kitchen.issue']);
const knownOther=new Set(['opening','opening.post','receipt.post','purchase.receive','purchase.reverse','purchase.return','waste.post','production.input','production.output','transfer.dispatch','transfer.receive','kitchen.transfer.in','kitchen.transfer.out','count.adjust']);

/** Resolve every recipe ingredient once at its stocked boundary, including unchecked ingredients. */
export function theoreticalConsumption(sales:ReconciliationSale[],versions:RecipeVersion[]){
 const quantities=new Map<string,string>(),issues=new Map<string,string[]>();
 for(const sale of sales){
  try{
   const version=versions.find(v=>v.versionId===sale.versionId);if(!version)throw new Error('missing version');
   const d=version.definition,output=decimal(sale.quantity).mul(sale.outputPerSale);
   const requirements=d.outputMode==='stocked'?[{itemId:d.outputItemId!,quantity:output.toString()}]:resolveRecipe(version.recipeId,d,versions).map(r=>({itemId:r.itemId,quantity:decimal(r.quantity).mul(output).div(d.outputQuantity).toString()}));
   for(const r of requirements){const key=JSON.stringify([sale.locationId,r.itemId]);quantities.set(key,decimal(quantities.get(key)??'0').add(r.quantity).toString());}
  }catch{issues.set(sale.locationId,[...(issues.get(sale.locationId)??[]),'تعذر حل إصدار وصفة لمبيعات هذه الفترة.']);}
 }
 return {quantities,issues};
}

/** Count evidence is usable only at the exact period boundaries and at a consistent posting checkpoint. */
export function compareConsumption(input:{from:string;to:string;itemId:string;locationId:string;entries:ReconciliationEntry[];counts:ReconciliationCount[];theoretical:string;selectedRequired:string;shortage:string;recipeIssues:string[];ledgerMatches:boolean}):ConsumptionComparison&{unitCost:string|null}{
 const {from,to,itemId,locationId}=input,entries=input.entries.filter(e=>e.itemId===itemId&&e.locationId===locationId);
 const counts=input.counts.filter(c=>c.document.locationId===locationId&&c.document.entryMode!=='balance_edit'&&c.changes.some(l=>l.itemId===itemId));
 const previousDay=new Date(Date.parse(from)-86400000).toISOString().slice(0,10);
 function checkpoint(c:ReconciliationCount){return entries.filter(e=>e.countId===c.countId).reduce((n,e)=>BigInt(e.sequence)>n?BigInt(e.sequence):n,BigInt(c.document.stockSequence));}
 const boundary=(day:string)=>counts.filter(c=>c.document.businessDate===day&&egyptDate(new Date(c.document.cutoffAt))===day).sort((a,b)=>checkpoint(a)>checkpoint(b)?-1:checkpoint(a)<checkpoint(b)?1:b.document.cutoffAt.localeCompare(a.document.cutoffAt))[0];
 const openingCount=boundary(previousDay),closingCount=boundary(to),opening=openingCount?.changes.find(l=>l.itemId===itemId)?.counted??null,closing=closingCount?.changes.find(l=>l.itemId===itemId)?.counted??null;
 const issues=[...new Set(input.recipeIssues)];
 if(!openingCount)issues.push('يلزم جرد فعلي معتمد في اليوم السابق لبداية الفترة.');
 if(!closingCount)issues.push('يلزم جرد فعلي معتمد في آخر يوم من الفترة.');
 if(!input.ledgerMatches)issues.push('الرصيد والحركات وطبقات التكلفة غير متطابقة.');
 const period=entries.filter(e=>e.businessDate>=from&&e.businessDate<=to);
 const sum=(rows:ReconciliationEntry[],field:'quantity'|'amount')=>rows.reduce((n,e)=>n.add(e[field]),decimal('0'));
 const recorded=period.filter(e=>knownConsumption.has(e.type)),waste=period.filter(e=>e.type==='waste.post'),production=period.filter(e=>e.type==='production.input');
 const physicalAdjustments=period.filter(e=>e.type==='count.adjust'&&!input.counts.some(c=>c.countId===e.countId&&c.document.entryMode==='balance_edit'));
 const supplies=period.filter(e=>['kitchen.transfer.in','kitchen.transfer.out','transfer.dispatch','transfer.receive'].includes(e.type));
 if(period.some(e=>e.type==='count.adjust'&&(!e.countId||!input.counts.some(c=>c.countId===e.countId)||input.counts.some(c=>c.countId===e.countId&&c.document.entryMode==='balance_edit'))))issues.push('توجد تسوية رصيد يدوية أو تسوية بلا جرد فعلي في الفترة.');
 if(period.some(e=>!knownConsumption.has(e.type)&&!knownOther.has(e.type)))issues.push('توجد حركة غير مصنفة؛ لا يمكن اعتماد الاستهلاك.');
 let actual:string|null=null,unitCost:string|null=null;
 if(openingCount&&closingCount){
  const start=checkpoint(openingCount),end=checkpoint(closingCount);
  if(end<start||period.some(e=>BigInt(e.sequence)<=start||BigInt(e.sequence)>end)||entries.some(e=>BigInt(e.sequence)>start&&BigInt(e.sequence)<=end&&(e.businessDate<from||e.businessDate>to)))issues.push('توقيت الجرد لا يغطي كل حركات الفترة؛ توجد حركة متأخرة أو خارج حدود الجرد.');
  // Late backdated stock also invalidates the opening/closing physical checkpoint.
  if(entries.some(e=>e.businessDate<from&&BigInt(e.sequence)>start&&e.countId!==openingCount.countId))issues.push('أضيفت حركة مؤرخة قبل الفترة بعد الجرد الافتتاحي.');
  for(const c of [openingCount,closingCount]){
   const change=c.changes.find(l=>l.itemId===itemId)!;
   const baseline=sum(entries.filter(e=>BigInt(e.sequence)<=BigInt(c.document.stockSequence)),'quantity');
   const atCount=sum(entries.filter(e=>BigInt(e.sequence)<=checkpoint(c)),'quantity');
   if(!baseline.eq(change.expected)||!atCount.eq(change.counted))issues.push('أساس الجرد لا يطابق سجل المخزون.');
  }
  const endEntries=entries.filter(e=>BigInt(e.sequence)<=end),endQuantity=sum(endEntries,'quantity');
  if(endQuantity.gt(0))unitCost=sum(endEntries,'amount').div(endQuantity).toString();
  // Independent mass balance: exclude transfers, purchasing, waste and preparation conversion.
  const other=period.filter(e=>!knownConsumption.has(e.type)&&e.type!=='count.adjust');
  const physical=decimal(opening!).add(sum(other,'quantity')).sub(closing!);
  const fromRecorded=sum(recorded,'quantity').neg().sub(sum(physicalAdjustments,'quantity'));
  if(!physical.eq(fromRecorded))issues.push('فشل التحقق المستقل من معادلة الاستهلاك.');
  if(!issues.length)actual=physical.toString();
 }
 const variance=actual===null?null:decimal(actual).sub(input.theoretical).toString();
 return {opening,closing,openingCountId:openingCount?.countId??null,closingCountId:closingCount?.countId??null,theoretical:input.theoretical,selectedRequired:input.selectedRequired,recorded:sum(recorded,'quantity').neg().toString(),shortage:input.shortage,waste:sum(waste,'quantity').neg().toString(),productionInput:sum(production,'quantity').neg().toString(),netSupply:sum(supplies,'quantity').toString(),countDifference:sum(physicalAdjustments,'quantity').toString(),actual,variance,variancePercent:variance!==null&&decimal(input.theoretical).gt(0)?decimal(variance).div(input.theoretical).mul(100).toString():null,unitCost,varianceCost:variance===null||unitCost===null?null:decimal(variance).mul(unitCost).toString(),theoreticalCost:unitCost===null?null:decimal(input.theoretical).mul(unitCost).toString(),actualCost:actual===null||unitCost===null?null:decimal(actual).mul(unitCost).toString(),recordedCost:sum(recorded,'amount').neg().toString(),wasteCost:sum(waste,'amount').neg().toString(),status:actual===null?'incomplete':'complete',issues:[...new Set(issues)]};
}
