import {returnSnapshot,postReturnLines} from './supplier-returns';
import type {PGlite} from '@electric-sql/pglite';
import {createHash,randomUUID} from 'node:crypto';
import {purchaseCommandSchema,BusinessError,type Access,type CommandResult,type PurchaseOrder,type PurchaseDefinition,type PurchaseReceipt,type Item} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {addIncomingStock} from './incoming';

export const purchaseTables=`
CREATE TABLE IF NOT EXISTS purchase_orders(organization_id text NOT NULL REFERENCES organizations(id),order_id uuid NOT NULL,revision integer NOT NULL,state text NOT NULL,payload jsonb NOT NULL,received jsonb NOT NULL DEFAULT '{}',PRIMARY KEY(organization_id,order_id));
CREATE TABLE IF NOT EXISTS purchase_revisions(organization_id text NOT NULL,order_id uuid NOT NULL,revision integer NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(organization_id,order_id,revision),FOREIGN KEY(organization_id,order_id) REFERENCES purchase_orders(organization_id,order_id));
CREATE TABLE IF NOT EXISTS purchase_receipts(organization_id text NOT NULL,operation_id uuid NOT NULL,order_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),reversed boolean NOT NULL DEFAULT false,PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,order_id) REFERENCES purchase_orders(organization_id,order_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS purchase_receipt_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS purchase_order_line_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_purchase_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_purchase_scope FOREIGN KEY(organization_id,purchase_receipt_id) REFERENCES purchase_receipts(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS purchase_receipts_order_lookup ON purchase_receipts(organization_id,order_id);
CREATE INDEX IF NOT EXISTS stock_purchase_receipt_lookup ON stock_entries(organization_id,purchase_receipt_id);
CREATE INDEX IF NOT EXISTS cost_layer_origin_lookup ON cost_layers(organization_id,sequence);
`;
export async function purchaseSnapshot(tx:Pick<PGlite,'query'>,org:string){
 const orders=await tx.query<PurchaseOrder>('SELECT order_id AS "orderId",revision,state,payload AS document,received FROM purchase_orders WHERE organization_id=$1 ORDER BY order_id',[org]);
 const receipts=await tx.query<PurchaseReceipt>('SELECT payload AS document,amount::text,posted_at::text AS "postedAt",reversed FROM purchase_receipts WHERE organization_id=$1 ORDER BY posted_at',[org]);
 const revisions=await tx.query<{orderId:string;revision:number;record:{state:string;payload:PurchaseDefinition}}>('SELECT order_id AS "orderId",revision,payload AS record FROM purchase_revisions WHERE organization_id=$1 ORDER BY order_id,revision',[org]);
 return {purchaseOrders:orders.rows,purchaseReceipts:receipts.rows,purchaseRevisions:revisions.rows,...await returnSnapshot(tx,org)};
}
export async function postPurchase(db:PGlite,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=purchaseCommandSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_PURCHASE','تحقق من بيانات مستند الشراء.',400);const c=parsed.data;
 if(c.organizationId!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','ليس لديك صلاحية لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  if(!(await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[c.organizationId])).rows.length)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows[0];
  if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior.result;}
  if((await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لحركة مخزون.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if('businessDate'in c&&c.businessDate>today)throw new BusinessError('FUTURE_DATE','التاريخ لا يمكن أن يكون في المستقبل.');
  const current=(await tx.query<PurchaseOrder>('SELECT order_id AS "orderId",revision,state,payload AS document,received FROM purchase_orders WHERE organization_id=$1 AND order_id=$2 FOR UPDATE',[c.organizationId,c.orderId])).rows[0];
  if((current?.revision??0)!==c.expectedRevision)throw new BusinessError('STALE_REVISION','تغير أمر الشراء. زامن وراجع الإصدار قبل المحاولة.');
  const revision=c.expectedRevision+1;let amount:string|undefined;
  const ensureActive=async(d:PurchaseDefinition)=>{
   if(!(await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2 AND active',[c.organizationId,d.locationId])).rows.length||!(await tx.query('SELECT 1 FROM suppliers WHERE organization_id=$1 AND id=$2 AND active',[c.organizationId,d.supplierId])).rows.length)throw new BusinessError('INVALID_REFERENCE','المورد أو الموقع غير نشط أو لم تتم مزامنته.');
   for(const line of d.lines){const item=(await tx.query<Item>('SELECT active,unit_id AS "unitId",unit,purchase_units AS "purchaseUnits" FROM items WHERE organization_id=$1 AND id=$2',[c.organizationId,line.itemId])).rows[0];const pack=item?.purchaseUnits?.find(p=>p.id===line.purchaseUnitId);
    if(!item||!item.active||item.unitId!==line.unitId)throw new BusinessError('INVALID_REFERENCE','المادة أو الوحدة غير متاحة.');
    if(line.purchaseUnitId?(!pack||pack.factor!==line.factor||pack.name!==line.unitName):(line.factor!=='1'||line.unitName!==item.unit))throw new BusinessError('INVALID_CONVERSION','تعريف وحدة الشراء لا يطابق المادة.');
    const q=decimal(line.enteredQuantity).mul(line.factor);if(q.decimalPlaces()>6||!q.eq(line.quantity)||q.gt('999999999.999999'))throw new BusinessError('INVALID_CONVERSION','كمية المخزون لا تطابق وحدة الشراء.');
   }
  };
  if(c.type==='purchase.save'){
   if(current&&current.state!=='draft'&&current.state!=='submitted')throw new BusinessError('ORDER_LOCKED','لا يمكن تعديل أمر تم استلامه أو إلغاؤه.');
   await ensureActive(c);
   const state='draft';await tx.query('INSERT INTO purchase_orders(organization_id,order_id,revision,state,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,order_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state,payload=EXCLUDED.payload',[c.organizationId,c.orderId,revision,state,JSON.stringify(c)]);
  }else{
   if(!current)throw new BusinessError('INVALID_REFERENCE','أمر الشراء لم تتم مزامنته.');const d=current.document;
   if(c.type==='purchase.submit'){
    if(current.state!=='draft')throw new BusinessError('ORDER_LOCKED','يمكن إرسال المسودة فقط.');await ensureActive(d);await tx.query("UPDATE purchase_orders SET revision=$3,state='submitted' WHERE organization_id=$1 AND order_id=$2",[c.organizationId,c.orderId,revision]);
   }
   if(c.type==='purchase.cancel'){
    if(current.state==='cancelled'||current.state==='fullyReceived')throw new BusinessError('ORDER_LOCKED','لا توجد كميات متبقية للإلغاء.');await tx.query("UPDATE purchase_orders SET revision=$3,state='cancelled' WHERE organization_id=$1 AND order_id=$2",[c.organizationId,c.orderId,revision]);
   }
   if(c.type==='purchase.receive'){
    if(c.replacesReceiptId){const source=(await tx.query<{reversed:boolean}>('SELECT reversed FROM purchase_receipts WHERE organization_id=$1 AND order_id=$2 AND operation_id=$3',[c.organizationId,c.orderId,c.replacesReceiptId])).rows[0];if(!source?.reversed||(await tx.query("SELECT 1 FROM purchase_receipts WHERE organization_id=$1 AND payload->>'replacesReceiptId'=$2",[c.organizationId,c.replacesReceiptId])).rows.length)throw new BusinessError('INVALID_REFERENCE','الاستلام الأصلي يجب أن يكون معكوساً ولم يستبدل من قبل.');}
    if(current.state!=='submitted'&&current.state!=='partiallyReceived')throw new BusinessError('ORDER_LOCKED','أرسل أمر الشراء قبل الاستلام.');await ensureActive(d);const received={...current.received};let total=decimal('0');
    const movements=c.lines.map(l=>{const line=d.lines.find(x=>x.lineId===l.orderLineId);if(!line)throw new BusinessError('INVALID_REFERENCE','سطر أمر الشراء غير متاح.');const q=decimal(l.enteredQuantity).mul(line.factor);if(q.decimalPlaces()>6||q.gt('999999999.999999'))throw new BusinessError('INVALID_CONVERSION','كمية الاستلام تتجاوز الدقة أو الحد المسموح.');const sum=decimal(received[line.lineId]??'0').add(q);if(sum.gt(line.quantity))throw new BusinessError('OVER_RECEIVING','كمية الاستلام تتجاوز المتبقي من الأمر.');received[line.lineId]=sum.toString();total=total.add(q.mul(line.unitCost));return {line,l,q};});
    const ids=[c.operationId,...c.lines.map(l=>l.movementId)];if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[c.organizationId,ids])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف مستند أو سطر مستخدم بالفعل.');
    amount=total.toFixed(12);await tx.query('INSERT INTO purchase_receipts(organization_id,operation_id,order_id,payload,amount) VALUES($1,$2,$3,$4,$5)',[c.organizationId,c.operationId,c.orderId,JSON.stringify(c),amount]);
    for(const {line,l,q} of movements){const value=await addIncomingStock(tx,{organizationId:c.organizationId,operationId:l.movementId,locationId:d.locationId,itemId:line.itemId,quantity:q.toString(),unitCost:line.unitCost,type:'purchase.receive',reason:c.reference,businessDate:c.businessDate});await tx.query('UPDATE stock_entries SET supplier_id=$3,purchase_unit_id=$4,entered_quantity=$5,purchase_receipt_id=$6,purchase_order_line_id=$7 WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,l.movementId,d.supplierId,line.purchaseUnitId??null,l.enteredQuantity,c.operationId,line.lineId]);await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,l.movementId,createHash('sha256').update(JSON.stringify({receiptId:c.operationId,line:l})).digest('hex'),JSON.stringify({operationId:l.movementId,outcome:'accepted',amount:value})]);}
    const state=d.lines.every(l=>decimal(received[l.lineId]??'0').eq(l.quantity))?'fullyReceived':'partiallyReceived';await tx.query('UPDATE purchase_orders SET revision=$3,state=$4,received=$5 WHERE organization_id=$1 AND order_id=$2',[c.organizationId,c.orderId,revision,state,JSON.stringify(received)]);
   }
   if(c.type==='purchase.return'){amount=await postReturnLines(tx,c);await tx.query('UPDATE purchase_orders SET revision=$3 WHERE organization_id=$1 AND order_id=$2',[c.organizationId,c.orderId,revision]);}
   if(c.type==='purchase.reverse'){
    const receipt=(await tx.query<{payload:Extract<import('@saas/contracts').PurchaseCommand,{type:'purchase.receive'}>;reversed:boolean;amount:string}>('SELECT payload,reversed,amount::text FROM purchase_receipts WHERE organization_id=$1 AND operation_id=$2 AND order_id=$3 FOR UPDATE',[c.organizationId,c.receiptId,c.orderId])).rows[0];
    if(!receipt||receipt.reversed)throw new BusinessError('INVALID_REFERENCE','الاستلام غير متاح أو سبق عكسه.');
    const entries=(await tx.query<{sequence:string;item_id:string;quantity:string}>("SELECT sequence,item_id,quantity::text FROM stock_entries WHERE organization_id=$1 AND purchase_receipt_id=$2 AND type='purchase.receive'",[c.organizationId,c.receiptId])).rows;const received={...current.received};
    for(const entry of entries){const layers=await tx.query<{id:string;remaining:string;unit_cost:string}>('SELECT id,remaining::text,unit_cost::text FROM cost_layers WHERE organization_id=$1 AND sequence=$2 FOR UPDATE',[c.organizationId,entry.sequence]);const layer=layers.rows[0];if(!layer||!decimal(layer.remaining).eq(entry.quantity))throw new BusinessError('SOURCE_UNAVAILABLE','تعذر العكس: تم استهلاك أو نقل جزء من مخزون الاستلام الأصلي.');const id=randomUUID(),value=decimal(entry.quantity).mul(layer.unit_cost).toFixed(12);await tx.query('UPDATE cost_layers SET remaining=0 WHERE organization_id=$1 AND id=$2',[c.organizationId,layer.id]);await tx.query('INSERT INTO layer_allocations VALUES($1,$2,$3,$4,$5)',[c.organizationId,id,layer.id,entry.quantity,value]);await tx.query('UPDATE stock_balances SET quantity=quantity-$4::numeric,value=value-$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[c.organizationId,d.locationId,entry.item_id,entry.quantity,value]);await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,purchase_receipt_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[c.organizationId,id,d.locationId,entry.item_id,decimal(entry.quantity).neg().toString(),decimal(value).neg().toString(),'purchase.reverse',c.reason,c.businessDate,c.receiptId]);}
    for(const line of receipt.payload.lines){const definition=d.lines.find(l=>l.lineId===line.orderLineId)!;received[line.orderLineId]=decimal(received[line.orderLineId]).sub(decimal(line.enteredQuantity).mul(definition.factor)).toString();}
    await tx.query('UPDATE purchase_receipts SET reversed=true WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.receiptId]);await tx.query('UPDATE purchase_orders SET revision=$3,state=$4,received=$5 WHERE organization_id=$1 AND order_id=$2',[c.organizationId,c.orderId,revision,current.state==='cancelled'?'cancelled':Object.values(received).some(q=>decimal(q).gt(0))?'partiallyReceived':'submitted',JSON.stringify(received)]);amount=decimal(receipt.amount).neg().toFixed(12);
   }
  }
  const updated=(await tx.query<{payload:unknown;received:unknown;state:string}>('SELECT payload,received,state FROM purchase_orders WHERE organization_id=$1 AND order_id=$2',[c.organizationId,c.orderId])).rows[0];await tx.query('INSERT INTO purchase_revisions VALUES($1,$2,$3,$4)',[c.organizationId,c.orderId,revision,JSON.stringify({...updated,command:c})]);
  const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);return result;
 });
}
