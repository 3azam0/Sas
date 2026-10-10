import {assertGeneration} from './valuation';
import type {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
import {receiptDocumentSchema,BusinessError,type Access,type CommandResult} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {addIncomingStock} from './incoming';

export async function postReceiptDocument(db:PGlite,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=receiptDocumentSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_RECEIPT','تحقق من سطور الاستلام (٢٠٠ سطر كحد أقصى).',400);
 const doc=parsed.data;
 if(doc.organizationId!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','ليس لديك صلاحية لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(doc)).digest('hex');
 return db.transaction(async tx=>{
  const tenant=await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[doc.organizationId]);
 await assertGeneration(tx,doc.organizationId,doc.generation);
  if(!tenant.rows.length)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[doc.organizationId,doc.operationId])).rows[0];
  if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف المستند مستخدم لبيانات مختلفة.');return prior.result;}
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(doc.businessDate>today)throw new BusinessError('FUTURE_DATE','تاريخ الاستلام لا يمكن أن يكون في المستقبل.');
  const site=(await tx.query<{active:boolean}>('SELECT active FROM locations WHERE organization_id=$1 AND id=$2',[doc.organizationId,doc.locationId])).rows[0];
  if(!site)throw new BusinessError('INVALID_REFERENCE','الموقع خارج نطاق المؤسسة أو لم تتم مزامنته.');
  if(!site.active)throw new BusinessError('INACTIVE_RECORD','الموقع غير نشط.');
  if(doc.supplierId&&!(await tx.query('SELECT 1 FROM suppliers WHERE organization_id=$1 AND id=$2 AND active',[doc.organizationId,doc.supplierId])).rows.length)throw new BusinessError('INVALID_SUPPLIER','المورد غير نشط أو غير متاح في المؤسسة.');
  const ids=[doc.operationId,...doc.lines.map(l=>l.lineId)];
  const collision=await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[doc.organizationId,ids]);
  if(collision.rows.length)throw new BusinessError('PAYLOAD_CONFLICT','أحد معرّفات السطور مستخدم بالفعل.');
  let total=decimal('0');
  for(const line of doc.lines){
   const item=(await tx.query<{active:boolean;unit_id:string;purchase_units: import('@saas/contracts').PurchaseUnit[]}>('SELECT active,unit_id,purchase_units FROM items WHERE organization_id=$1 AND id=$2',[doc.organizationId,line.itemId])).rows[0];
   if(!item)throw new BusinessError('INVALID_REFERENCE','إحدى المواد خارج نطاق المؤسسة أو لم تتم مزامنتها.');
   if(!item.active)throw new BusinessError('INACTIVE_RECORD','إحدى المواد غير نشطة.');
   if(item.unit_id!==line.unitId)throw new BusinessError('INVALID_UNIT','وحدة أحد السطور لا تطابق وحدة المخزون الأساسية.');
   if(line.purchaseUnitId){const pack=item.purchase_units.find(p=>p.id===line.purchaseUnitId),converted=pack?decimal(line.enteredQuantity!).mul(pack.factor):null;if(!converted||converted.decimalPlaces()>6||!converted.eq(line.quantity))throw new BusinessError('INVALID_CONVERSION','كمية وحدة الشراء لا تطابق كمية المخزون.');}
   total=total.add(decimal(line.quantity).mul(line.unitCost));
  }
  const amount=total.toFixed(12);
  await tx.query('INSERT INTO receipt_documents(organization_id,operation_id,payload,amount) VALUES($1,$2,$3,$4)',[doc.organizationId,doc.operationId,JSON.stringify(doc),amount]);
  for(const line of doc.lines){
   const lineAmount=await addIncomingStock(tx,{...doc,operationId:line.lineId,itemId:line.itemId,quantity:line.quantity,unitCost:line.unitCost,type:'receipt.post',receiptDocumentId:doc.operationId});
   await tx.query('UPDATE stock_entries SET supplier_id=$3,purchase_unit_id=$4,entered_quantity=$5 WHERE organization_id=$1 AND operation_id=$2',[doc.organizationId,line.lineId,doc.supplierId??null,line.purchaseUnitId??null,line.enteredQuantity??null]);
   const lineHash=createHash('sha256').update(JSON.stringify({receiptDocumentId:doc.operationId,...line})).digest('hex');
   await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[doc.organizationId,line.lineId,lineHash,JSON.stringify({operationId:line.lineId,outcome:'accepted',amount:lineAmount})]);
  }
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[doc.organizationId,access.userId,doc.operationId,doc.type]);
  const result:CommandResult={operationId:doc.operationId,outcome:'accepted',amount};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[doc.organizationId,doc.operationId,hash,JSON.stringify(result)]);
  return result;
 });
}
