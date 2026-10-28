import type {Snapshot,PurchaseOrder} from '@saas/contracts';
import type {PreparationPlan} from '../contracts/preparation';
import {preparationRequirements,type PlanProduction} from './preparation';
import {decimal} from './index';
import Decimal from 'decimal.js';

export function purchaseSuggestions(snapshot:Snapshot,locationId:string,plans:PreparationPlan[]=[],productions:PlanProduction[]=[],orders:PurchaseOrder[]=snapshot.purchaseOrders??[]){
 const demand=new Map<string,Map<string,Decimal>>(),direct=new Map<string,Decimal>(),issues:string[]=[];
 for(const plan of plans.filter(p=>p.state==='draft'&&(p.sourceLocationId===locationId||snapshot.kitchens?.find(k=>k.id===p.kitchenId)?.locationId===locationId)&&p.organizationId===snapshot.organizationId&&p.generation===snapshot.generation)){
  try{const calculation=preparationRequirements(snapshot,plan,productions),key=calculation.kitchen.locationId!;if(key===locationId){for(const m of calculation.materials)direct.set(m.itemId,(direct.get(m.itemId)??decimal('0')).add(m.required));continue;}let group=demand.get(key);if(!group){group=new Map();demand.set(key,group);}for(const m of calculation.materials)group.set(m.itemId,(group.get(m.itemId)??decimal('0')).add(m.required));}
  catch{issues.push(plan.name+': تعذر حساب الاحتياج؛ راجع الخطة.');}
 }
 const planNeeds=new Map<string,Decimal>(direct);for(const [kitchen,materials] of demand)for(const [itemId,required] of materials){const available=snapshot.balances.find(b=>b.locationId===kitchen&&b.itemId===itemId)?.quantity??'0';planNeeds.set(itemId,(planNeeds.get(itemId)??decimal('0')).add(Decimal.max(required.sub(available),0)));}
 const rows=snapshot.items.filter(i=>i.active!==false&&i.unitId).map(item=>{
  const stock=snapshot.balances.find(b=>b.locationId===locationId&&b.itemId===item.id),onHand=decimal(stock?.quantity??'0'),minimum=decimal(item.minimum),planned=planNeeds.get(item.id)??decimal('0');let incoming=decimal('0'),draft=decimal('0');
  for(const order of orders.filter(o=>o.document.locationId===locationId))for(const line of order.document.lines.filter(l=>l.itemId===item.id)){const remaining=Decimal.max(decimal(line.quantity).sub(order.received[line.lineId]??'0'),0);if(['submitted','partiallyReceived'].includes(order.state))incoming=incoming.add(remaining);else if(order.state==='draft')draft=draft.add(remaining);}
  const transit=(snapshot.transfers??[]).filter(t=>t.document.destinationId===locationId).flatMap(t=>t.lines).filter(l=>l.itemId===item.id).reduce((sum,line)=>sum.add(line.remaining),decimal('0'));
  const target=minimum.add(planned),quantity=Decimal.max(target.sub(onHand).sub(incoming).sub(transit),0).toDecimalPlaces(6,2),price=snapshot.receiptPrices?.find(p=>p.locationId===locationId&&p.itemId===item.id)?.unitCost??(onHand.gt(0)?decimal(stock!.value).div(onHand).toFixed(6):null);
  return {itemId:item.id,name:item.name,sku:item.sku,unit:item.unit,unitId:item.unitId!,onHand:onHand.toString(),minimum:minimum.toString(),planned:planned.toString(),incoming:incoming.toString(),transit:transit.toString(),draft:draft.toString(),quantity:quantity.toString(),unitCost:price===null?null:decimal(price).toFixed(6)};
 }).filter(r=>decimal(r.quantity).gt(0));
 return {rows,issues};
}
export function transferFollowUp(snapshot:Snapshot,locationId:string,today:string,overdueDays=3){
 if(!Number.isInteger(overdueDays)||overdueDays<1||overdueDays>365)throw Error('اختر حداً من ١ إلى ٣٦٥ يوماً.');
 return (snapshot.transfers??[]).filter(t=>!locationId||t.document.sourceId===locationId||t.document.destinationId===locationId).flatMap(t=>{
  const age=Math.max(0,Math.floor((Date.parse(today)-Date.parse(t.document.businessDate))/86400000));
  return t.lines.map(line=>({transferId:t.transferId,operationId:t.document.operationId,dispatchDate:t.document.businessDate,reference:t.document.reason,sourceId:t.document.sourceId,destinationId:t.document.destinationId,sourceName:snapshot.locations.find(l=>l.id===t.document.sourceId)?.name??t.document.sourceId,destinationName:snapshot.locations.find(l=>l.id===t.document.destinationId)?.name??t.document.destinationId,itemId:line.itemId,name:snapshot.items.find(i=>i.id===line.itemId)?.name??line.itemId,unit:snapshot.units?.find(u=>u.id===line.unitId)?.name??'',quantity:line.quantity,received:line.received,lost:line.lost,remaining:line.remaining,remainingValue:line.remainingValue,state:t.state,age,overdue:decimal(line.remaining).gt(0)&&age>=overdueDays}));
 }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||b.age-a.age||a.transferId.localeCompare(b.transferId));
}
