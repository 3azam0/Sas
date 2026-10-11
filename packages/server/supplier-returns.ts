import {planIssue,applyIssue} from './valuation';
import type {Database} from './database';
import {createHash} from 'node:crypto';
import {BusinessError,type SupplierReturn,type CommandResult,type PostedSupplierReturn,type ReturnSource} from '@saas/contracts';
import {decimal} from '@saas/domain';

export const returnTables=`
CREATE TABLE IF NOT EXISTS supplier_returns(organization_id text NOT NULL,operation_id uuid NOT NULL,receipt_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL CHECK(amount>=0),posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,receipt_id) REFERENCES purchase_receipts(organization_id,operation_id));
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS inventory_amount numeric(38,12);
CREATE TABLE IF NOT EXISTS supplier_return_lines(organization_id text NOT NULL,return_id uuid NOT NULL,movement_id uuid NOT NULL,source_movement_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),amount numeric(30,12) NOT NULL CHECK(amount>=0),PRIMARY KEY(organization_id,movement_id),FOREIGN KEY(organization_id,return_id) REFERENCES supplier_returns(organization_id,operation_id),FOREIGN KEY(organization_id,source_movement_id) REFERENCES stock_entries(organization_id,operation_id),FOREIGN KEY(organization_id,movement_id) REFERENCES stock_entries(organization_id,operation_id));
CREATE INDEX IF NOT EXISTS supplier_return_receipt_lookup ON supplier_returns(organization_id,receipt_id);
CREATE INDEX IF NOT EXISTS supplier_return_document_lookup ON supplier_return_lines(organization_id,return_id);
CREATE INDEX IF NOT EXISTS supplier_return_source_lookup ON supplier_return_lines(organization_id,source_movement_id);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS supplier_return_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_return_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_return_scope FOREIGN KEY(organization_id,supplier_return_id) REFERENCES supplier_returns(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_return_lookup ON stock_entries(organization_id,supplier_return_id);
`;
type SourceRow={receiptId:string;orderId:string;supplierId:string;locationId:string;reference:string;sourceMovementId:string;itemId:string;unitId:string;unitName:string;quantity:string;available:string;returned:string;unitCost:string};
export async function returnSnapshot(tx:Pick<Database,'query'>,org:string){
 const docs=await tx.query<PostedSupplierReturn>('SELECT payload AS document,amount::text,COALESCE(inventory_amount,amount)::text AS "inventoryAmount",(COALESCE(inventory_amount,amount)-amount)::text AS "valuationDifference",posted_at::text AS "postedAt" FROM supplier_returns WHERE organization_id=$1 ORDER BY posted_at',[org]);
 const sources=await tx.query<SourceRow>(`SELECT r.operation_id AS "receiptId",r.order_id AS "orderId",e.supplier_id AS "supplierId",e.location_id AS "locationId",e.reason AS reference,e.operation_id AS "sourceMovementId",e.item_id AS "itemId",i.unit_id AS "unitId",i.unit AS "unitName",e.quantity::text,l.remaining::text AS available,l.unit_cost::text AS "unitCost",COALESCE((SELECT sum(x.quantity) FROM supplier_return_lines x WHERE x.organization_id=e.organization_id AND x.source_movement_id=e.operation_id),0)::text AS returned FROM purchase_receipts r JOIN stock_entries e ON e.organization_id=r.organization_id AND e.purchase_receipt_id=r.operation_id AND e.type='purchase.receive' JOIN cost_layers l ON l.organization_id=e.organization_id AND l.sequence=e.sequence JOIN items i ON i.organization_id=e.organization_id AND i.id=e.item_id WHERE r.organization_id=$1 AND NOT r.reversed ORDER BY r.posted_at,e.sequence`,[org]);
 const grouped=new Map<string,ReturnSource>();for(const row of sources.rows){let source=grouped.get(row.receiptId);if(!source){source={receiptId:row.receiptId,orderId:row.orderId,supplierId:row.supplierId,locationId:row.locationId,reference:row.reference,lines:[]};grouped.set(row.receiptId,source);}source.lines.push({sourceMovementId:row.sourceMovementId,itemId:row.itemId,unitId:row.unitId,unitName:row.unitName,quantity:row.quantity,available:row.available,returned:row.returned,unitCost:row.unitCost});}
 return {supplierReturns:docs.rows,returnSources:[...grouped.values()]};
}
// Caller holds the tenant and order locks. Only original receipt layers qualify;
// aggregate branch stock and other receipts must never satisfy a source return.
export async function postReturnLines(tx:Pick<Database,'query'>,c:SupplierReturn):Promise<string>{
 const receipt=(await tx.query<{reversed:boolean}>('SELECT reversed FROM purchase_receipts WHERE organization_id=$1 AND operation_id=$2 AND order_id=$3 FOR UPDATE',[c.organizationId,c.receiptId,c.orderId])).rows[0];if(!receipt||receipt.reversed)throw new BusinessError('INVALID_REFERENCE','الاستلام الأصلي غير متاح أو تم عكسه.');
 const ids=[c.operationId,...c.lines.map(l=>l.movementId)];if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[c.organizationId,ids])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف المستند أو سطر المرتجع مستخدم بالفعل.');
 const prepared=[];let total=decimal('0'),inventory=decimal('0');
 for(const line of c.lines){
  const source=(await tx.query<{item_id:string;location_id:string;supplier_id:string;quantity:string;layer_id:string;remaining:string;unit_cost:string}>('SELECT e.item_id,e.location_id,e.supplier_id,e.quantity::text,l.id AS layer_id,l.remaining::text,l.unit_cost::text FROM stock_entries e JOIN cost_layers l ON l.organization_id=e.organization_id AND l.sequence=e.sequence WHERE e.organization_id=$1 AND e.operation_id=$2 AND e.purchase_receipt_id=$3 AND e.type=$4 FOR UPDATE OF l',[c.organizationId,line.sourceMovementId,c.receiptId,'purchase.receive'])).rows[0];
  if(!source||source.location_id!==c.locationId||source.supplier_id!==c.supplierId)throw new BusinessError('INVALID_REFERENCE','المورد أو الموقع أو سطر الاستلام لا يطابق المصدر.');
  const returned=(await tx.query<{quantity:string}>('SELECT COALESCE(sum(quantity),0)::text AS quantity FROM supplier_return_lines WHERE organization_id=$1 AND source_movement_id=$2',[c.organizationId,line.sourceMovementId])).rows[0].quantity;
  if(decimal(returned).add(line.quantity).gt(source.quantity))throw new BusinessError('EXCESS_RETURN','كمية المرتجع تتجاوز الكمية الأصلية بعد المرتجعات السابقة.');
  if(decimal(line.quantity).gt(source.remaining))throw new BusinessError('SOURCE_UNAVAILABLE','الرصيد المتاح من الاستلام الأصلي لا يكفي. قد تم استهلاكه أو إرجاعه؛ لا يمكن استخدام استلام آخر.');
  const amount=decimal(line.quantity).mul(source.unit_cost).toFixed(12);total=total.add(amount);await planIssue(tx,c.organizationId,c.locationId,source.item_id,line.quantity,[source.layer_id]);prepared.push({line,source,amount});
 }
 const amount=total.toFixed(12);await tx.query('INSERT INTO supplier_returns(organization_id,operation_id,receipt_id,payload,amount,inventory_amount) VALUES($1,$2,$3,$4,$5,$6)',[c.organizationId,c.operationId,c.receiptId,JSON.stringify(c),amount,inventory.toFixed(12)]);
 for(const {line,source,amount} of prepared){
  const plan=await planIssue(tx,c.organizationId,c.locationId,source.item_id,line.quantity,[source.layer_id]);inventory=inventory.add(plan.amount);
  await applyIssue(tx,c.organizationId,c.locationId,source.item_id,line.movementId,line.quantity,plan);
  await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,supplier_id,purchase_receipt_id,supplier_return_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[c.organizationId,line.movementId,c.locationId,source.item_id,decimal(line.quantity).neg().toString(),decimal(plan.amount).neg().toString(),c.type,c.reason,c.businessDate,c.supplierId,c.receiptId,c.operationId]);
  await tx.query('UPDATE stock_entries SET reference_amount=$3 WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,line.movementId,decimal(amount).neg().toString()]);
  await tx.query('INSERT INTO supplier_return_lines VALUES($1,$2,$3,$4,$5,$6)',[c.organizationId,c.operationId,line.movementId,line.sourceMovementId,line.quantity,amount]);
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,line.movementId,createHash('sha256').update(JSON.stringify({returnId:c.operationId,line})).digest('hex'),JSON.stringify({operationId:line.movementId,outcome:'accepted',amount:decimal(plan.amount).neg().toString()} satisfies CommandResult)]);
 }
 await tx.query('UPDATE supplier_returns SET inventory_amount=$3 WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId,inventory.toFixed(12)]);
 return inventory.neg().toFixed(12);
}
