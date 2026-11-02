import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,type Access,type OpeningDocument} from '@saas/contracts';
import {documentCorrectionSchema,type DocumentCorrectionCommand} from '../contracts/document-corrections';
import type {Database} from './database';
import {assertGeneration,rebalanceAverage} from './valuation';
import {assertInventoryDateOpen} from './inventory-permissions';
import {decimal} from '../domain';
import {addIncomingStock} from './incoming';
import {postOpening} from './opening';
import {postReceiptDocument} from './receipts';
import {postKitchenIssue} from './kitchen-issues';
import {reconcileStock} from './counts';
export const documentCorrectionTables=`CREATE TABLE IF NOT EXISTS document_corrections(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('opening','receipt','kitchen')),source_id uuid NOT NULL,replacement_id uuid NOT NULL,reason text NOT NULL,actor text NOT NULL,reversal_ids jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),UNIQUE(organization_id,source_id),UNIQUE(organization_id,replacement_id));`;
function reject(code:string,message:string):never{throw new BusinessError(code,message,409);}
export async function postDocumentCorrection(db:Database,access:Access,input:unknown){
 if(!['owner','manager'].includes(access.role??''))throw new BusinessError('FORBIDDEN','تصحيح المستندات المقبولة متاح للمالك والمدير.',403);
 if(!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('AUTH_REQUIRED','جدد جلسة الدخول.',401);
 const parsed=documentCorrectionSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_CORRECTION','راجع سبب التصحيح وبيانات المستند.',400);const c=parsed.data,d=c.replacement,org=c.organizationId;
 if(org!==access.organizationId||d.organizationId!==org||d.generation!==c.generation)throw new BusinessError('FORBIDDEN','المستند يخص نطاقاً آخر.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:unknown}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];if(prior){if(prior.payload_hash!==hash)reject('PAYLOAD_CONFLICT','معرف التصحيح مستخدم لبيانات مختلفة.');return prior.result;}
  const table={opening:'opening_documents',receipt:'receipt_documents',kitchen:'kitchen_issues'}[c.kind],link={opening:'opening_document_id',receipt:'receipt_document_id',kitchen:'kitchen_issue_id'}[c.kind];
  const source=(await tx.query<{payload:DocumentCorrectionCommand['replacement']}>(`SELECT payload FROM ${table} WHERE organization_id=$1 AND operation_id=$2`,[org,c.sourceId])).rows[0]?.payload;
  if(!source)reject('SOURCE_NOT_FOUND','المستند الأصلي غير متاح.');
  if((await tx.query('SELECT 1 FROM document_corrections WHERE organization_id=$1 AND source_id=$2',[org,c.sourceId])).rows.length)reject('ALREADY_CORRECTED','تم تصحيح هذا المستند؛ افتح المستند البديل.');
  const ids=[c.operationId,d.operationId,...d.lines.map(l=>l.lineId)];if(new Set(ids).size!==ids.length||ids.includes(c.sourceId))reject('PAYLOAD_CONFLICT','يجب استخدام معرفات جديدة للتصحيح والسطور.');
  if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[org,ids])).rows.length)reject('PAYLOAD_CONFLICT','أحد معرفات التصحيح مستخدم بالفعل.');
  if(source.locationId!==d.locationId)reject('INVALID_LOCATION','تصحيح المستند يحتفظ بمخزن المصدر؛ أنشئ تحويلاً مستقلاً لنقل المخزون.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date());if(c.businessDate>today||c.businessDate<source.businessDate||d.businessDate!==c.businessDate)reject('INVALID_DATE','تاريخ التصحيح يجب ألا يسبق المستند الأصلي أو يتجاوز اليوم، ويطابق تاريخ البديل.');
  const movements=(await tx.query<{operation_id:string;location_id:string;item_id:string;quantity:string;amount:string;sequence:string}>(`SELECT operation_id::text,location_id,item_id,quantity::text,amount::text,sequence::text FROM stock_entries WHERE organization_id=$1 AND ${link}=$2 AND type IN ('opening.post','receipt.post','kitchen.issue','kitchen.transfer.out','kitchen.transfer.in') ORDER BY sequence`,[org,c.sourceId])).rows;
  if(!movements.length)reject('SOURCE_NOT_FOUND','لا توجد حركات أصلية مرتبطة بالمستند.');
  for(const m of movements){await assertInventoryDateOpen(tx,org,m.location_id,source.businessDate);await assertInventoryDateOpen(tx,org,m.location_id,c.businessDate);
   if(decimal(m.quantity).gt(0)){
    const layer=(await tx.query<{remaining:string}>('SELECT remaining::text FROM cost_layers WHERE organization_id=$1 AND sequence=$2 FOR UPDATE',[org,m.sequence])).rows[0];
    if(!layer||!decimal(layer.remaining).eq(m.quantity))reject('SOURCE_ALREADY_USED','استُهلك أو صُرف جزء من هذا الاستلام. صحح الحركات التابعة أو أرجع المواد أولاً؛ لم يتغير المستند.');
    if((await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND sequence>$4 AND (quantity<0 OR amount<0 OR type=$5)',[org,m.location_id,m.item_id,m.sequence,'count.revalue'])).rows.length)reject('LATER_STOCK_ACTIVITY','توجد حركات تكلفة أو صرف لاحقة لهذه المادة. صحح الحركات التابعة أولاً.');
   }
  }
  const reversalIds:string[]=[];
  // Reverse incoming stock first, then restore outgoing source allocations.
  for(const m of movements.filter(m=>decimal(m.quantity).gt(0))){const id=randomUUID();reversalIds.push(id);const reverseType=c.kind==='opening'?'opening.reverse':c.kind==='receipt'?'receipt.reverse':'kitchen.transfer.reverse.in';
   await tx.query(`INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,${link}) VALUES($1,$2,$3,$4,$5,$6,$10,$7,$8,$9)`,[org,id,m.location_id,m.item_id,decimal(m.quantity).neg().toString(),decimal(m.amount).neg().toString(),c.reason,c.businessDate,c.sourceId,reverseType]);
   if(c.kind==='receipt')await tx.query('UPDATE stock_entries SET supplier_id=$3 WHERE organization_id=$1 AND operation_id=$2',[org,id,'supplierId' in source?source.supplierId??null:null]);
   await tx.query('UPDATE cost_layers SET remaining=0,remaining_value=0 WHERE organization_id=$1 AND sequence=$2',[org,m.sequence]);await tx.query('UPDATE stock_balances SET quantity=quantity-$4::numeric,value=value-$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,m.location_id,m.item_id,m.quantity,m.amount]);await rebalanceAverage(tx,org,m.location_id,m.item_id);
  }
  for(const m of movements.filter(m=>decimal(m.quantity).lt(0))){const allocations=(await tx.query<{quantity:string;amount:string;lot:import('../contracts/inventory-operations').StockLot|null}>('SELECT a.quantity::text,a.amount::text,l.lot FROM layer_allocations a JOIN cost_layers l ON l.organization_id=a.organization_id AND l.id=a.layer_id WHERE a.organization_id=$1 AND a.operation_id=$2',[org,m.operation_id])).rows;
   if(!allocations.length||!allocations.reduce((s,a)=>s.add(a.quantity),decimal('0')).eq(decimal(m.quantity).neg()))reject('INVALID_SOURCE','تعذر مطابقة مصادر الصرف الأصلية.');
   for(const a of allocations){const id=randomUUID();reversalIds.push(id);await addIncomingStock(tx,{organizationId:org,locationId:m.location_id,itemId:m.item_id,operationId:id,quantity:a.quantity,unitCost:decimal(a.amount).div(a.quantity).toFixed(6),amount:a.amount,type:source.type==='kitchen.transfer'?'kitchen.transfer.reverse.out':'kitchen.reverse',reason:c.reason,businessDate:c.businessDate,lot:a.lot??undefined});await tx.query(`UPDATE stock_entries SET ${link}=$3,reference_amount=$4 WHERE organization_id=$1 AND operation_id=$2`,[org,id,c.sourceId,'unitPrice' in source.lines.find(l=>l.itemId===m.item_id)!?decimal(a.quantity).mul((source.lines.find(l=>l.itemId===m.item_id) as {unitPrice?:string}).unitPrice??'0').toString():null]);}
  }
  const facade:Database={query:tx.query.bind(tx),transaction:run=>run(tx)};
  if(c.kind==='opening')await postOpening(facade,access,c.replacement,new Set(source.lines.map(l=>l.itemId)));
  else if(c.kind==='receipt')await postReceiptDocument(facade,access,c.replacement);
  else await postKitchenIssue(facade,access,c.replacement);
  if((await reconcileStock(tx,org)).some(r=>!r.matches))reject('RECONCILIATION_MISMATCH','لم تتطابق أرصدة التصحيح؛ لم يتغير أي مستند.');
  await tx.query('INSERT INTO document_corrections(organization_id,operation_id,kind,source_id,replacement_id,reason,actor,reversal_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,c.operationId,c.kind,c.sourceId,d.operationId,c.reason,access.userId,JSON.stringify(reversalIds)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,'document.correct']);const result={operationId:c.operationId,outcome:'accepted',replacementId:d.operationId};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(result)]);return result;
 });
}
