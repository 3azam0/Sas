import Decimal from 'decimal.js';
import { BusinessError, type Layer, type Command, type Snapshot } from '@saas/contracts';
Decimal.set({precision:40,rounding:Decimal.ROUND_HALF_UP});
export const decimal = (value:string) => new Decimal(value);
export function allocateFIFO(layers:Layer[], quantity:string) {
  let needed=decimal(quantity); let total=decimal('0');
  const allocations:{layerId:string;quantity:string;amount:string}[]=[];
  for(const layer of [...layers].sort((a,b)=>a.sequence-b.sequence || a.id.localeCompare(b.id))) {
    if(needed.lte(0)) break;
    const take=Decimal.min(needed,decimal(layer.remaining)); if(take.lte(0)) continue;
    const amount=take.mul(layer.unitCost); total=total.add(amount); needed=needed.sub(take);
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
