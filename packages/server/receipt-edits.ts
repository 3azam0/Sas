import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,receiptDocumentSchema,type Access,type ReceiptDocument,type CommandResult,type PostedReceiptDocument} from '@saas/contracts';
import {receiptRevisionSchema} from '../contracts/document-corrections';
import {decimal} from '@saas/domain';
import {egyptDate} from '../domain/reporting';
import type {Database,QueryDatabase} from './database';
import {assertAveragePool,assertGeneration,rebalanceAverage} from './valuation';
import {assertInventoryDateOpen} from './inventory-permissions';
import {postReceiptLines,receiptTotal,validateReceiptDestination,validateReceiptLines} from './receipts';
import {reconcileStock} from './counts';

type Line=ReceiptDocument['lines'][number];
const numberKey=(value?:string)=>value===undefined?undefined:decimal(value).toString();
function lineKey({lineId,quantity,unitCost,enteredQuantity,receivingUnit,...rest}:Line){
 return JSON.stringify({...rest,quantity:numberKey(quantity),unitCost:numberKey(unitCost),enteredQuantity:numberKey(enteredQuantity),
  receivingUnit:receivingUnit&&{...receivingUnit,factor:numberKey(receivingUnit.factor)}});
}

export async function postReceiptRevision(db:Database,access:Access,input:unknown){
 const parsed=receiptRevisionSchema.safeParse(input);
 if(!parsed.success)throw new BusinessError('INVALID_CORRECTION','راجع سبب التعديل ومواد مستند الاستلام.',400);
 const command=parsed.data,{operationId,organizationId:org,sourceId,expectedRevision}=command;
 const draft=command.kind==='receipt_edit'?command.document:null;
 if(org!==access.organizationId||draft&&(draft.organizationId!==org||draft.generation!==command.generation))throw new BusinessError('FORBIDDEN','المستند يخص نطاقاً آخر.',403);
 if(draft&&draft.operationId!==sourceId)throw new BusinessError('INVALID_REFERENCE','يجب حفظ التعديل على نفس مستند الاستلام.',400);
 const hash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
  await assertGeneration(tx,org,command.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,operationId])).rows[0];
  if(prior){
   if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف التعديل مستخدم لبيانات مختلفة.');
   return prior.result;
  }
  if((await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=$2',[org,operationId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف التعديل مستخدم بالفعل.');
  const original=(await tx.query<{payload:ReceiptDocument}>('SELECT payload FROM receipt_documents WHERE organization_id=$1 AND operation_id=$2',[org,sourceId])).rows[0];
  if(!original)throw new BusinessError('SOURCE_NOT_FOUND','مستند الاستلام غير متاح.');
  if((await tx.query('SELECT 1 FROM document_corrections WHERE organization_id=$1 AND source_id=$2',[org,sourceId])).rows.length)throw new BusinessError('ALREADY_CORRECTED','تم تصحيح هذا المستند سابقاً. افتح المستند البديل.');
  const latest=(await tx.query<{revision:number;updated:ReceiptDocument|null}>('SELECT revision,updated_document AS updated FROM receipt_edits WHERE organization_id=$1 AND receipt_id=$2 ORDER BY revision DESC LIMIT 1',[org,sourceId])).rows[0];
  if((latest?.revision??0)!==expectedRevision)throw new BusinessError('STALE_REVISION','تغيّر المستند. زامن وأعد فتحه.');
  if(latest&&!latest.updated)throw new BusinessError('RECEIPT_VOIDED','مستند الاستلام ملغى بالفعل.');
  const previous=receiptDocumentSchema.parse(latest?.updated??original.payload);
  if(draft&&draft.locationId!==previous.locationId)throw new BusinessError('INVALID_LOCATION','التعديل يحتفظ بمخزن الاستلام.');
  if(draft&&draft.businessDate>egyptDate())throw new BusinessError('FUTURE_DATE','تاريخ الاستلام لا يمكن أن يكون في المستقبل.');
  const moved=draft&&(draft.businessDate!==previous.businessDate||draft.supplierId!==previous.supplierId);
  const oldByItem=new Map(previous.lines.map(line=>[line.itemId,line]));
  const lines=(draft?.lines??[]).map(line=>{
   const old=oldByItem.get(line.itemId);
   return !moved&&old&&lineKey(old)===lineKey(line)?old:{...line,lineId:randomUUID()};
  });
  const oldIds=new Set(previous.lines.map(line=>line.lineId)),nextIds=new Set(lines.map(line=>line.lineId));
  const removed=previous.lines.filter(line=>!nextIds.has(line.lineId));
  const added=lines.filter(line=>!oldIds.has(line.lineId));
  if(!removed.length&&!added.length&&draft?.reason===previous.reason)throw new BusinessError('NO_CHANGE','غيّر بيانات المستند أو المواد قبل الحفظ.');
  const updated=draft?{...previous,schemaVersion:draft.schemaVersion,businessDate:draft.businessDate,supplierId:draft.supplierId,reason:draft.reason,lines}:null;
  await assertInventoryDateOpen(tx,org,previous.locationId,previous.businessDate);
  if(updated){
   await assertInventoryDateOpen(tx,org,updated.locationId,updated.businessDate);
   if(added.length){await validateReceiptDestination(tx,updated);await validateReceiptLines(tx,updated,added);}
  }
  for(const line of removed)await reverseReceiptLine(tx,previous,line,command.reason);
  if(updated)await postReceiptLines(tx,updated,added);
  const touched=new Set([...removed,...added].map(line=>line.itemId));
  if(touched.size&&(await reconcileStock(tx,org)).some(row=>row.locationId===previous.locationId&&touched.has(row.itemId)&&!row.matches))throw new BusinessError('RECONCILIATION_MISMATCH','أرصدة التعديل لا تطابق سجل المخزون.');
  const amount=receiptTotal(lines);
  await tx.query(`INSERT INTO receipt_edits(organization_id,receipt_id,operation_id,revision,actor,reason,previous_document,updated_document,amount,replaced_line_ids)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid[])`,[org,sourceId,operationId,expectedRevision+1,access.userId,command.reason,JSON.stringify(previous),updated?JSON.stringify(updated):null,amount,removed.map(line=>line.lineId)]);
  const result:CommandResult={operationId,outcome:'accepted',amount};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,operationId,hash,JSON.stringify(result)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,operationId,updated?'receipt.edit':'receipt.void']);
  return result;
 });
}

async function reverseReceiptLine(tx:QueryDatabase,doc:ReceiptDocument,line:Line,reason:string){
 const {organizationId:org,locationId,businessDate}=doc,{itemId,lineId}=line;
 const movement=(await tx.query<{quantity:string;amount:string;sequence:string;remaining:string|null;lot:unknown}>(`SELECT e.quantity::text,e.amount::text,e.sequence::text,l.remaining::text,e.lot
  FROM stock_entries e LEFT JOIN cost_layers l ON l.organization_id=e.organization_id AND l.sequence=e.sequence
  WHERE e.organization_id=$1 AND e.receipt_document_id=$2 AND e.operation_id=$3 AND e.type='receipt.post'`,[org,doc.operationId,lineId])).rows[0];
 if(!movement||!decimal(movement.quantity).eq(line.quantity))throw new BusinessError('INVALID_REFERENCE','تعذرت مطابقة حركة الاستلام الأصلية.');
 await assertAveragePool(tx,org,locationId,itemId);
 if(movement.remaining===null||!decimal(movement.remaining).eq(movement.quantity))throw new BusinessError('SOURCE_ALREADY_USED','صُرف أو استُهلك جزء من هذه المادة. راجع الحركات التابعة أولاً.');
 const later=await tx.query(`SELECT 1 FROM stock_entries WHERE organization_id=$1 AND location_id=$2 AND item_id=$3
  AND sequence>$4 AND type<>'receipt.reverse' AND (quantity<0 OR amount<0 OR type='count.revalue') LIMIT 1`,[org,locationId,itemId,movement.sequence]);
 if(later.rows.length)throw new BusinessError('LATER_STOCK_ACTIVITY','توجد حركات صرف أو تقييم لاحقة لهذه المادة. راجع الحركات التابعة أولاً.');
 await tx.query(`INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,receipt_document_id,supplier_id,lot)
  VALUES($1,$2,$3,$4,-$5::numeric,-$6::numeric,'receipt.reverse',$7,$8,$9,$10,$11)`,[org,randomUUID(),locationId,itemId,movement.quantity,movement.amount,reason,businessDate,doc.operationId,doc.supplierId??null,movement.lot?JSON.stringify(movement.lot):null]);
 await tx.query('UPDATE cost_layers SET remaining=0,remaining_value=0 WHERE organization_id=$1 AND sequence=$2',[org,movement.sequence]);
 await tx.query('UPDATE stock_balances SET quantity=quantity-$4::numeric,value=value-$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,locationId,itemId,movement.quantity,movement.amount]);
 await rebalanceAverage(tx,org,locationId,itemId);
}

export async function receiptSnapshot(tx:QueryDatabase,org:string){
 return (await tx.query<PostedReceiptDocument>(`WITH recent AS (
   SELECT operation_id FROM receipt_documents WHERE organization_id=$1 ORDER BY posted_at DESC,operation_id LIMIT 100
  ), visible AS (
   SELECT operation_id FROM recent
   UNION SELECT receipt_id FROM receipt_edits WHERE organization_id=$1
  )
  SELECT COALESCE(e.updated,e.previous,d.payload) AS document,
  COALESCE(e.amount,d.amount)::text AS amount,d.posted_at::text AS "postedAt",COALESCE(e.history,'[]'::jsonb) AS edits
  FROM visible v JOIN receipt_documents d ON d.organization_id=$1 AND d.operation_id=v.operation_id
  LEFT JOIN LATERAL (
   SELECT (array_agg(updated_document ORDER BY revision DESC))[1] AS updated,
    (array_agg(previous_document ORDER BY revision DESC))[1] AS previous,
    (array_agg(amount ORDER BY revision DESC))[1] AS amount,max(posted_at) AS last_edit,
    jsonb_agg(jsonb_build_object('operationId',operation_id,'revision',revision,'reason',reason,'postedAt',posted_at,
      'previous',previous_document,'updated',updated_document) ORDER BY revision DESC) AS history
   FROM receipt_edits WHERE organization_id=d.organization_id AND receipt_id=d.operation_id
  ) e ON true ORDER BY COALESCE(e.last_edit,d.posted_at) DESC,d.operation_id`,[org])).rows;
}
