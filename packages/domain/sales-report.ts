import type {Snapshot} from '@saas/contracts';
import {decimal} from './index';
import {resolveRecipe} from './recipes';
import {saleKey} from './sales';

/** Read-only estimates: accepted, unique sales and their immutable recipe pins. */
export function salesReport(snapshot:Snapshot,locationId:string,from='',to='',basis:'stock_average'|'latest_receipt'='stock_average'){
 const seen=new Set<string>(), totals=new Map<string,{itemId:string;quantity:string}>(), issues:string[]=[];
 let net=decimal('0'),saleQuantity=decimal('0'),count=0;
 for(const imported of snapshot.salesImports??[]){
  if(imported.document.locationId!==locationId)continue;
  for(const sale of imported.document.lines){
   if(!imported.acceptedLineIds.includes(sale.lineId)||(from&&sale.businessDate<from)||(to&&sale.businessDate>to))continue;
   const key=saleKey(imported.document.source,locationId,sale,imported.document.posId,imported.document.checkout?.channel);if(seen.has(key))continue;seen.add(key);
   count++;net=net.add(sale.netAmount);saleQuantity=saleQuantity.add(sale.quantity);
   const version=snapshot.recipeVersions?.find(v=>v.versionId===sale.versionId);
   if(!version){issues.push(`إصدار وصفة مفقود: ${sale.menuName}`);continue;}
   try{
    const d=version.definition,output=decimal(sale.quantity).mul(sale.outputPerSale);
    const requirements=d.outputMode==='stocked'?[{itemId:d.outputItemId!,quantity:output.toString()}]:resolveRecipe(version.recipeId,d,snapshot.recipeVersions??[]).map(r=>({...r,quantity:decimal(r.quantity).mul(output).div(d.outputQuantity).toString()}));
    for(const r of requirements){const old=totals.get(r.itemId);totals.set(r.itemId,{itemId:r.itemId,quantity:decimal(old?.quantity??'0').add(r.quantity).toString()});}
   }catch{issues.push(`تعذر حساب مكونات ${sale.menuName}`);}
  }
 }
 for(const r of snapshot.financeRecords??[]){const c=r.command;if(c.type==='sales.correct'&&c.locationId===locationId&&(!from||c.businessDate>=from)&&(!to||c.businessDate<=to))net=net.sub(r.amount);}
 const lines=[...totals.values()].map(r=>{
  const item=snapshot.items.find(i=>i.id===r.itemId),balance=snapshot.balances.find(b=>b.locationId===locationId&&b.itemId===r.itemId),price=snapshot.receiptPrices?.find(p=>p.locationId===locationId&&p.itemId===r.itemId);
  const unitCost=basis==='stock_average'?(balance&&decimal(balance.quantity).gt(0)?decimal(balance.value).div(balance.quantity).toString():null):price?.unitCost??null;
  if(!item)issues.push(`مادة غير متاحة: ${r.itemId}`);
  return {...r,name:item?.name??r.itemId,unit:item?.unit??'',unitCost,amount:unitCost===null?null:decimal(r.quantity).mul(unitCost).toString(),priceDate:basis==='latest_receipt'?price?.businessDate:snapshot.fetchedAt.slice(0,10)};
 });
 const knownSubtotal=lines.reduce((sum,l)=>sum.add(l.amount??'0'),decimal('0')).toString();
 const complete=!!count&&!issues.length&&lines.every(l=>l.amount!==null),estimatedCost=complete?knownSubtotal:null;
 return {lines,issues,complete,count,netAmount:net.toString(),saleQuantity:saleQuantity.toString(),knownSubtotal,estimatedCost,foodCostPercent:estimatedCost!==null&&net.gt(0)?decimal(estimatedCost).div(net).mul(100).toString():null};
}
