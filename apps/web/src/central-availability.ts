import {decimal} from '@saas/domain';
import type {Command,Snapshot} from '@saas/contracts';

export const normalizeCentralQuantity=(value:string)=>value.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/٫/g,'.').trim();
export type MaterialAvailability={itemId:string;confirmed:string;pending:string;available:string;required:string;shortage:string;remaining:string;complete:boolean;lineCount:number};
type StockSnapshot=Pick<Snapshot,'organizationId'|'generation'|'balances'|'acceptedOperationIds'>;

// Pending incoming stock is not spendable until accepted. Repeated ingredient
// rows share one stock pool, so compare their combined demand with that pool.
export function centralMaterialAvailability(snapshot:StockSnapshot,commands:Command[],locationId:string,lines:ReadonlyArray<{itemId:string;quantity:string}>):MaterialAvailability[]{
 const accepted=new Set(snapshot.acceptedOperationIds),seen=new Set<string>(),reserved=new Map<string,ReturnType<typeof decimal>>();
 for(const c of commands){
  if(c.type!=='waste.post'||c.organizationId!==snapshot.organizationId||c.locationId!==locationId||accepted.has(c.operationId)||seen.has(c.operationId)||(c.generation&&snapshot.generation&&c.generation!==snapshot.generation))continue;
  seen.add(c.operationId);reserved.set(c.itemId,(reserved.get(c.itemId)??decimal('0')).add(c.quantity));
 }
 const groups=new Map<string,{required:ReturnType<typeof decimal>;complete:boolean;lineCount:number}>();
 for(const line of lines){
  if(!line.itemId)continue;
  const group=groups.get(line.itemId)??{required:decimal('0'),complete:true,lineCount:0},quantity=normalizeCentralQuantity(line.quantity);
  const valid=/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(quantity)&&decimal(quantity).gt(0);
  group.lineCount++;group.complete&&=valid;if(valid)group.required=group.required.add(quantity);groups.set(line.itemId,group);
 }
 return [...groups].map(([itemId,group])=>{
  const confirmed=decimal(snapshot.balances.find(b=>b.locationId===locationId&&b.itemId===itemId)?.quantity??'0'),pending=reserved.get(itemId)??decimal('0'),unclamped=confirmed.sub(pending),available=unclamped.gt(0)?unclamped:decimal('0'),difference=group.required.sub(available),remaining=available.sub(group.required);
  return {itemId,confirmed:confirmed.toFixed(6),pending:pending.toFixed(6),available:available.toFixed(6),required:group.required.toFixed(6),shortage:(difference.gt(0)?difference:decimal('0')).toFixed(6),remaining:(remaining.gt(0)?remaining:decimal('0')).toFixed(6),complete:group.complete,lineCount:group.lineCount};
 });
}
