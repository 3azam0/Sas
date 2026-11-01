import Decimal from 'decimal.js';
import { BusinessError, type Layer, type Command, type Snapshot } from '@saas/contracts';
Decimal.set({precision:40,rounding:Decimal.ROUND_HALF_UP});
export const decimal = (value:string) => new Decimal(value);
export function averageIssue(layers:Layer[],quantity:string){const q=decimal(quantity),total=layers.reduce((n,l)=>n.add(l.remaining),decimal('0')),value=layers.reduce((n,l)=>n.add(l.remainingValue??decimal(l.remaining).mul(l.unitCost).toFixed(12)),decimal('0'));if(q.lte(0)||q.gt(total))throw new BusinessError('INSUFFICIENT_STOCK','الرصيد المتاح لا يكفي');return {amount:q.eq(total)?value.toFixed(12):value.mul(q).div(total).toFixed(12)};}
export function allocateFIFO(layers:Layer[], quantity:string) {
  let needed=decimal(quantity); let total=decimal('0');
  const allocations:{layerId:string;quantity:string;amount:string}[]=[];
  for(const layer of [...layers].sort((a,b)=>a.sequence-b.sequence || a.id.localeCompare(b.id))) {
    if(needed.lte(0)) break;
    const take=Decimal.min(needed,decimal(layer.remaining)); if(take.lte(0)) continue;
    const amount=layer.remainingValue!==undefined?(take.eq(layer.remaining)?decimal(layer.remainingValue):decimal(layer.remainingValue).mul(take).div(layer.remaining).toDecimalPlaces(12)):take.mul(layer.unitCost); total=total.add(amount); needed=needed.sub(take);
    allocations.push({layerId:layer.id,quantity:take.toFixed(6),amount:amount.toFixed(12)});
  }
  if(needed.gt(0)) throw new BusinessError('INSUFFICIENT_STOCK','الرصيد المتاح لا يكفي');
  return {allocations,amount:total.toFixed(12)};
}
export function projectedQuantity(snapshot:Snapshot, commands:Command[], locationId:string,itemId:string) {
  let value=decimal(snapshot.balances.find(b=>b.locationId===locationId&&b.itemId===itemId)?.quantity || '0');
  const accepted=new Set(snapshot.acceptedOperationIds);
  for(const c of commands) if(c.locationId===locationId&&c.itemId===itemId&&!accepted.has(c.operationId)) value=value.add(decimal(c.quantity).mul(c.type==='receipt.post'?1:-1));
  return value.toFixed(6);
}
