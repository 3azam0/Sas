import {createHash} from 'node:crypto';
import {BusinessError,financeCommandSchema,type Access,type CommandResult,type FinanceCommand,type FinanceRecord,type SalesLine} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {egyptDate} from '../domain/reporting';
import type {Database} from './database';
import {assertGeneration} from './valuation';

export const financeTables=`
CREATE TABLE IF NOT EXISTS finance_entries(
 organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,
 location_id text NOT NULL,business_date date NOT NULL,type text NOT NULL CHECK(type IN ('sales.correct','expense.post','expense.reverse')),
 sale_line_id uuid,expense_id uuid,payload jsonb NOT NULL,amount numeric(18,6) NOT NULL CHECK(amount>=0),actor text NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id),
 FOREIGN KEY(organization_id,sale_line_id) REFERENCES sales_details(organization_id,line_id),
 FOREIGN KEY(organization_id,expense_id) REFERENCES finance_entries(organization_id,operation_id)
);
CREATE INDEX IF NOT EXISTS finance_location_date ON finance_entries(organization_id,location_id,business_date);
CREATE INDEX IF NOT EXISTS finance_sale ON finance_entries(organization_id,sale_line_id) WHERE sale_line_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS finance_expense_reversal ON finance_entries(organization_id,expense_id) WHERE expense_id IS NOT NULL;
`;
export async function financeSnapshot(tx:Pick<Database,'query'>,org:string){return {financeRecords:(await tx.query<{command:FinanceCommand;amount:string;actor:string;postedAt:string}>('SELECT payload AS command,amount::text,actor,posted_at::text AS "postedAt" FROM finance_entries WHERE organization_id=$1 ORDER BY posted_at DESC,operation_id',[org])).rows};}
export async function postFinance(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=financeCommandSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_FINANCE','راجع التاريخ والمبلغ والمرجع وسبب التصحيح.',400);
 const c=parsed.data,org=c.organizationId,digest=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بعمليات هذه المؤسسة.',403);
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];
  if(prior){if(prior.payload_hash!==digest)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior.result;}
  if(c.replacesOperationId&&(c.replacesOperationId===c.operationId||(await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.replacesOperationId])).rows.length))throw new BusinessError('INVALID_CORRECTION','لا يمكن استبدال عملية مالية مقبولة؛ استخدم عكساً مرتبطاً.');
  if(c.businessDate>egyptDate()||c.businessDate>egyptDate(new Date(c.capturedAt)))throw new BusinessError('FUTURE_DATE','لا يمكن تسجيل تاريخ مستقبلي.');
  if(!(await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2',[org,c.locationId])).rows.length)throw new BusinessError('INVALID_REFERENCE','الموقع غير متاح لهذه المؤسسة.');
  let amount='amount'in c?c.amount:'0';
  if(c.type==='sales.correct'){
   const sale=(await tx.query<{payload:SalesLine;business_date:string;location_id:string}>('SELECT payload,business_date::text,location_id FROM sales_details WHERE organization_id=$1 AND line_id=$2',[org,c.saleLineId])).rows[0];
   if(!sale||sale.location_id!==c.locationId)throw new BusinessError('INVALID_REFERENCE','اختر تفصيل بيع مقبولاً في الموقع نفسه.');
   if(c.businessDate<sale.business_date)throw new BusinessError('INVALID_DATE','تاريخ التصحيح لا يسبق البيع الأصلي.');
   const previous=(await tx.query<{quantity:string;amount:string}>("SELECT COALESCE(sum((payload->>'quantity')::numeric),0)::text AS quantity,COALESCE(sum(amount),0)::text AS amount FROM finance_entries WHERE organization_id=$1 AND sale_line_id=$2",[org,c.saleLineId])).rows[0];
   const qty=decimal(sale.payload.quantity).sub(previous.quantity),available=decimal(sale.payload.netAmount).sub(previous.amount);
   if(decimal(c.quantity).gt(qty)||decimal(c.amount).gt(available))throw new BusinessError('CORRECTION_EXCEEDS_SALE','كمية أو مبلغ التصحيح يتجاوز المتبقي من البيع.');
   if(c.kind==='void'&&(!decimal(c.quantity).eq(qty)||!decimal(c.amount).eq(available)))throw new BusinessError('INVALID_VOID','الإلغاء يعكس كامل الكمية والمبلغ المتبقيين؛ استخدم مرتجعاً للتصحيح الجزئي.');
   if(decimal(c.quantity).eq(qty)&&!decimal(c.amount).eq(available))throw new BusinessError('INVALID_FINAL_REFUND','التصحيح الأخير يجب أن يعكس المبلغ المتبقي كاملاً.');
  }else if(c.type==='expense.reverse'){
   const expense=(await tx.query<{payload:FinanceCommand;amount:string;business_date:string;location_id:string}>('SELECT payload,amount::text,business_date::text,location_id FROM finance_entries WHERE organization_id=$1 AND operation_id=$2',[org,c.expenseId])).rows[0];
   if(!expense||expense.payload.type!=='expense.post'||expense.location_id!==c.locationId)throw new BusinessError('INVALID_REFERENCE','اختر مصروفاً مقبولاً في الموقع نفسه.');
   if(c.businessDate<expense.business_date)throw new BusinessError('INVALID_DATE','تاريخ العكس لا يسبق المصروف الأصلي.');
   if((await tx.query('SELECT 1 FROM finance_entries WHERE organization_id=$1 AND expense_id=$2',[org,c.expenseId])).rows.length)throw new BusinessError('ALREADY_REVERSED','تم عكس هذا المصروف بالفعل.');
   amount=expense.amount;
  }else if(!(await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2 AND active',[org,c.locationId])).rows.length)throw new BusinessError('INACTIVE_RECORD','اختر موقعاً نشطاً لتسجيل المصروف.');
  await tx.query('INSERT INTO finance_entries(organization_id,operation_id,location_id,business_date,type,sale_line_id,expense_id,payload,amount,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[org,c.operationId,c.locationId,c.businessDate,c.type,c.type==='sales.correct'?c.saleLineId:null,c.type==='expense.reverse'?c.expenseId:null,JSON.stringify(c),amount,access.userId]);
  const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,digest,JSON.stringify(result)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);
  return result;
 });
}
