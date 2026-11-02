import {BusinessError} from '@saas/contracts';
import {decimal} from '@saas/domain';
import type {Database} from './database';
import {rebalanceAverage} from './valuation';

// Historical receipt payloads and allocation amounts remain fixed. Only the
// remaining quantities in each source are repriced, with their old basis saved.
export async function revalueCountStock(tx:Pick<Database,'query'>,c:{organizationId:string;locationId:string;itemId:string;unitCost:string;operationId:string;countId:string;lineId:string;reason:string;businessDate:string}){
 const b=(await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[c.organizationId,c.locationId,c.itemId])).rows[0];
 if(!b||decimal(b.quantity).lte(0))throw new BusinessError('NO_STOCK_TO_REVALUE','تعديل تكلفة الوحدة يحتاج رصيدًا جديدًا أكبر من صفر.');
 const layers=(await tx.query<{id:string;remaining:string;unitCost:string;remainingValue:string}>('SELECT id::text,remaining::text,unit_cost::text AS "unitCost",COALESCE(remaining_value,remaining*unit_cost)::text AS "remainingValue" FROM cost_layers WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining>0 ORDER BY sequence,id FOR UPDATE',[c.organizationId,c.locationId,c.itemId])).rows;
 if(!layers.reduce((n,l)=>n.add(l.remaining),decimal('0')).eq(b.quantity)||!layers.reduce((n,l)=>n.add(l.remainingValue),decimal('0')).eq(b.value))throw new BusinessError('RECONCILIATION_MISMATCH','راجع مصادر المخزون قبل تعديل التكلفة.');
 const value=decimal(b.quantity).mul(c.unitCost).toFixed(12),difference=decimal(value).sub(b.value).toFixed(12);
 await tx.query("INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,count_id,count_line_id) VALUES($1,$2,$3,$4,0,$5,'count.revalue',$6,$7,$8,$9)",[c.organizationId,c.operationId,c.locationId,c.itemId,difference,c.reason,c.businessDate,c.countId,c.lineId]);
 for(const l of layers)await tx.query('UPDATE cost_layers SET unit_cost=$3,remaining_value=CASE WHEN remaining_value IS NULL THEN NULL ELSE remaining*$3::numeric END WHERE organization_id=$1 AND id=$2',[c.organizationId,l.id,c.unitCost]);
 await tx.query('UPDATE stock_balances SET value=$4 WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[c.organizationId,c.locationId,c.itemId,value]);
 await rebalanceAverage(tx,c.organizationId,c.locationId,c.itemId);
 return {operationId:c.operationId,unitCost:c.unitCost,previousValue:b.value,value,difference,layers};
}
