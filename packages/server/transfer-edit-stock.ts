import {randomUUID} from 'node:crypto';
import {BusinessError} from '@saas/contracts';
import {decimal} from '@saas/domain';
import type {QueryDatabase} from './database';
import {assertInventoryDateOpen} from './inventory-permissions';
import {assertAveragePool,rebalanceAverage} from './valuation';

type Movement={id:string;locationId:string;itemId:string;lineId:string;date:string;sequence:string;quantity:string;amount:string};

export async function reverseTransferLines(tx:QueryDatabase,org:string,transferId:string,lineIds:string[],date:string,reason:string){
 const movements=(await tx.query<Movement>(`SELECT operation_id::text AS id,location_id AS "locationId",item_id AS "itemId",
  transfer_line_id::text AS "lineId",business_date::text AS date,sequence::text,quantity::text,amount::text
  FROM stock_entries WHERE organization_id=$1 AND transfer_id=$2 AND transfer_line_id=ANY($3::uuid[])
  AND type IN ('transfer.dispatch','transfer.receive') ORDER BY sequence`,[org,transferId,lineIds])).rows;
 if(movements.filter(row=>decimal(row.quantity).lt(0)).length!==lineIds.length)throw new BusinessError('INVALID_REFERENCE','تعذر مطابقة حركات التحويل الأصلية.');
 const reversals:string[]=[];
 for(const movement of movements){
  const {locationId,itemId,quantity,amount,sequence}=movement;
  await assertInventoryDateOpen(tx,org,locationId,movement.date);
  await assertInventoryDateOpen(tx,org,locationId,date);
  await assertAveragePool(tx,org,locationId,itemId);
  const incoming=decimal(quantity).gt(0);
  if(incoming){
   const layer=(await tx.query<{remaining:string}>('SELECT remaining::text FROM cost_layers WHERE organization_id=$1 AND sequence=$2 FOR UPDATE',[org,sequence])).rows[0];
   const later=await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND sequence>$4 AND (quantity<0 OR amount<0 OR type=$5) AND operation_id<>ALL($6::uuid[]) LIMIT 1',[org,locationId,itemId,sequence,'count.revalue',reversals]);
   if(!layer||!decimal(layer.remaining).eq(quantity)||later.rows.length)throw new BusinessError('SOURCE_ALREADY_USED','استُخدم مخزون الاستلام أو تغير تقييمه. راجع الحركات التابعة قبل تعديل هذه المادة.');
   await tx.query('UPDATE cost_layers SET remaining=0,remaining_value=0 WHERE organization_id=$1 AND sequence=$2',[org,sequence]);
  }else{
   const allocations=(await tx.query<{layerId:string;quantity:string;amount:string}>('SELECT layer_id AS "layerId",quantity::text,amount::text FROM layer_allocations WHERE organization_id=$1 AND operation_id=$2',[org,movement.id])).rows;
   if(!allocations.reduce((sum,row)=>sum.add(row.quantity),decimal('0')).eq(decimal(quantity).neg())||!allocations.reduce((sum,row)=>sum.add(row.amount),decimal('0')).eq(decimal(amount).neg()))throw new BusinessError('INVALID_REFERENCE','تعذر مطابقة تكلفة صرف التحويل الأصلية.');
   for(const allocation of allocations)await tx.query('UPDATE cost_layers SET remaining=remaining+$3::numeric WHERE organization_id=$1 AND id=$2',[org,allocation.layerId,allocation.quantity]);
  }
  const id=randomUUID();
  await tx.query(`INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,transfer_id,transfer_line_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[org,id,locationId,itemId,decimal(quantity).neg().toString(),decimal(amount).neg().toString(),incoming?'transfer.receive.reverse':'transfer.dispatch.reverse',reason,date,transferId,movement.lineId]);
  await tx.query('UPDATE stock_balances SET quantity=quantity-$4::numeric,value=value-$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,locationId,itemId,quantity,amount]);
  await rebalanceAverage(tx,org,locationId,itemId);
  reversals.push(id);
 }
 return reversals;
}
