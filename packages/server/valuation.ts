import type {Database} from './database';
import {BusinessError,type CostingMethod,type Layer} from '@saas/contracts';
import {allocateFIFO,decimal} from '@saas/domain';
type Tx=Pick<Database,'query'>;
export async function assertAveragePool(tx:Tx,org:string,location:string,item:string){
 if(await costingMethod(tx,org)!=='moving_average')return;
 const b=(await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[org,location,item])).rows[0]??{quantity:'0',value:'0'};
 const sources=(await tx.query<{quantity:string;value:string}>('SELECT COALESCE(SUM(remaining),0)::text AS quantity,COALESCE(SUM(remaining_value),0)::text AS value FROM cost_layers WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,location,item])).rows[0];
 const ledger=(await tx.query<{quantity:string;value:string}>('SELECT COALESCE(SUM(quantity),0)::text AS quantity,COALESCE(SUM(amount),0)::text AS value FROM stock_entries WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,location,item])).rows[0];
 if(![sources,ledger].every(s=>decimal(s.quantity).eq(b.quantity)&&decimal(s.value).eq(b.value)))throw new BusinessError('RECONCILIATION_MISMATCH','الرصيد والدفتر وقيم مصادر المخزون غير متطابقة.');
}
export async function costingMethod(tx:Tx,org:string):Promise<CostingMethod>{return (await tx.query<{method:CostingMethod}>('SELECT costing_method AS method FROM organizations WHERE id=$1',[org])).rows[0].method;}
export async function assertGeneration(tx:Tx,org:string,generation?:string){if(generation&&(await tx.query<{generation:string}>('SELECT generation::text FROM organizations WHERE id=$1',[org])).rows[0]?.generation!==generation)throw new BusinessError('STALE_GENERATION','تمت إعادة بيانات التطوير. زامن النسخة الجديدة؛ لا ترسل عمليات النسخة السابقة.');}
export async function rebalanceAverage(tx:Tx,org:string,location:string,item:string){
 if(await costingMethod(tx,org)!=='moving_average')return;
 const b=(await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,location,item])).rows[0];if(!b)return;
 const layers=(await tx.query<{id:string;remaining:string}>('SELECT id,remaining::text FROM cost_layers WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining>0 ORDER BY sequence,id FOR UPDATE',[org,location,item])).rows;
 if(!layers.reduce((q,l)=>q.add(l.remaining),decimal('0')).eq(b.quantity)||decimal(b.quantity).isZero()&&!decimal(b.value).isZero())throw new BusinessError('RECONCILIATION_MISMATCH','كمية المصادر لا تطابق رصيد المخزون.');
 await tx.query('UPDATE cost_layers SET remaining_value=0 WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining=0',[org,location,item]);
 let left=decimal(b.value);for(const [i,l] of layers.entries()){const v=i===layers.length-1?left:decimal(b.value).mul(l.remaining).div(b.quantity).toDecimalPlaces(12,1);left=left.sub(v);await tx.query('UPDATE cost_layers SET remaining_value=$3 WHERE organization_id=$1 AND id=$2',[org,l.id,v.toFixed(12)]);}
}
// FIFO quantity tracing identifies source availability under either valuation policy.
// Moving average values the issue from the whole material/location pool, not purchase prices.
export async function planIssue(tx:Tx,org:string,location:string,item:string,quantity:string,sourceIds?:string[]){
 const method=await costingMethod(tx,org);
 await assertAveragePool(tx,org,location,item);
 const layers=(await tx.query<Layer>('SELECT id,location_id AS "locationId",item_id AS "itemId",remaining::text,unit_cost::text AS "unitCost",COALESCE(remaining_value,remaining*unit_cost)::text AS "remainingValue",sequence FROM cost_layers WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining>0 ORDER BY sequence,id FOR UPDATE',[org,location,item])).rows;
 const selected=sourceIds?layers.filter(l=>sourceIds.includes(l.id)):layers;
 const plan=allocateFIFO(selected,quantity);if(method==='fifo')return {...plan,method};
 const b=(await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[org,location,item])).rows[0];
 if(!b||!layers.reduce((n,l)=>n.add(l.remaining),decimal('0')).eq(b.quantity)||!layers.reduce((n,l)=>n.add(l.remainingValue!),decimal('0')).eq(b.value))throw new BusinessError('RECONCILIATION_MISMATCH','الرصيد وقيم مصادر المخزون غير متطابقة.');
 const amount=decimal(quantity).eq(b.quantity)?b.value:decimal(b.value).mul(quantity).div(b.quantity).toFixed(12);let left=decimal(amount);
 const allocations=plan.allocations.map((p,i)=>{const value=i===plan.allocations.length-1?left:decimal(amount).mul(p.quantity).div(quantity).toDecimalPlaces(12,1);left=left.sub(value);return {...p,amount:value.toFixed(12)};});return {method,amount:decimal(amount).toFixed(12),allocations};
}
export async function applyIssue(tx:Tx,org:string,location:string,item:string,operationId:string,quantity:string,plan:Awaited<ReturnType<typeof planIssue>>){
 for(const p of plan.allocations){await tx.query('UPDATE cost_layers SET remaining=remaining-$3::numeric WHERE organization_id=$1 AND id=$2',[org,p.layerId,p.quantity]);await tx.query('INSERT INTO layer_allocations VALUES($1,$2,$3,$4,$5)',[org,operationId,p.layerId,p.quantity,p.amount]);}
 await tx.query('UPDATE stock_balances SET quantity=quantity-$4::numeric,value=value-$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,location,item,quantity,plan.amount]);await rebalanceAverage(tx,org,location,item);
}
