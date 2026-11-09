import {BusinessError,type ImportedSales,type POSOrder,type SalesImportDocument,type SalesLine,type PointOfSale,type Kitchen} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {posLineAmount} from '../domain/pos';
import {salesSourceKey} from '../domain/sales';
import type {QueryDatabase} from './database';

// Reporting projection only. Inventory and payments are owned by postPOSOrder.
export async function projectPOSOrder(tx:QueryDatabase,org:string,order:POSOrder,pos:PointOfSale,kitchen:Kitchen,generation:string,adopting=false){
 const prior=(await tx.query<{result:ImportedSales}>('SELECT result FROM sales_imports WHERE organization_id=$1 AND operation_id=$2',[org,order.draft.id])).rows[0]?.result;
 if(prior&&!prior.posOrderId&&!adopting)throw new BusinessError('SALE_ALREADY_EXISTS','معرّف الطلب مستخدم لفاتورة سابقة.');
 const lines:SalesLine[]=order.draft.lines.map(l=>({...l,transactionId:order.reference,lineKey:l.lineId,businessDate:order.businessDate,netAmount:posLineAmount(l.unitPrice,l.quantity)}));
 // A refunded invoice retains its last printable document; accepted IDs and sales details are empty.
 const document:SalesImportDocument={operationId:order.draft.id,generation,organizationId:org,type:'sales.import',source:pos.source,locationId:order.locationId,posId:pos.id,posRevision:pos.revision,kitchenId:kitchen.id,currency:'EGP',reference:order.reference,completedSalesOnly:true,capturedAt:order.paidAt!,schemaVersion:1,
  lines:lines.length?lines:prior?.document.lines??[],checkout:{channel:'foodo',service:order.draft.service,cashReceived:'0.00',note:order.draft.note,lines:(lines.length?order.draft.lines:prior?.document.checkout?.lines??[]).map(l=>({lineId:l.lineId,unitPrice:l.unitPrice,note:l.note}))}};
 const result:ImportedSales={posOrderId:order.draft.id,document,routing:{posId:pos.id,posName:pos.name,posRevision:pos.revision,kitchenId:kitchen.id,kitchenName:kitchen.name,locationId:order.locationId},acceptedLineIds:lines.map(l=>l.lineId),duplicateLineIds:[],netAmount:order.total,postedAt:order.paidAt!,stockDeductionAmount:order.stock.reduce((v,s)=>v.add(s.amount),decimal('0')).toFixed(12),stockDeductions:order.stock.filter(s=>decimal(s.deducted).gt(0)).map(s=>({movementId:order.draft.id,itemId:s.itemId,businessDate:order.businessDate,quantity:s.deducted,amount:s.amount})),stockShortages:order.stock.filter(s=>decimal(s.required).gt(s.deducted)).map(s=>({itemId:s.itemId,businessDate:order.businessDate,requiredQuantity:s.required,deductedQuantity:s.deducted,shortageQuantity:decimal(s.required).sub(s.deducted).toFixed(6)}))};
 await tx.query('INSERT INTO sales_imports(organization_id,operation_id,location_id,result) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,operation_id) DO UPDATE SET result=$4',[org,order.draft.id,order.locationId,JSON.stringify(result)]);
 await tx.query('DELETE FROM sales_details WHERE organization_id=$1 AND import_id=$2',[org,order.draft.id]);
 for(const line of lines)await tx.query('INSERT INTO sales_details VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[org,salesSourceKey(pos.source,pos.id,'foodo'),order.locationId,line.businessDate,line.transactionId,line.lineKey,line.lineId,order.draft.id,line.menuItemId,line.versionId,JSON.stringify(line)]);
}
