import {createHash} from 'node:crypto';
import {kitchenIssueSchema,BusinessError,type Access,type CommandResult,type PostedKitchenIssue} from '@saas/contracts';
import {decimal} from '@saas/domain';
import type {Database,QueryDatabase} from './database';
import {assertGeneration,planIssue,applyIssue,costingMethod} from './valuation';
import {reconcileStock} from './counts';

export async function postKitchenIssue(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=kitchenIssueSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_KITCHEN_ISSUE','راجع اسم المطبخ والمواد والكميات (٢٠٠ مادة كحد أقصى).',400);
 const d=parsed.data,org=d.organizationId;
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','ليس لديك صلاحية لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(d)).digest('hex');
 return db.transaction(async tx=>{
  if(!(await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org])).rows.length)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);
  await assertGeneration(tx,org,d.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,d.operationId])).rows[0];
  if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','المستند موجود ببيانات مختلفة.');return prior.result;}
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(d.businessDate>today)throw new BusinessError('FUTURE_DATE','تاريخ الصرف لا يمكن أن يكون في المستقبل.');
  let kitchen=d.kitchen;
  if(d.kitchenId){
   const recipient=(await tx.query<{name:string;active:boolean}>('SELECT name,active FROM kitchens WHERE organization_id=$1 AND id=$2',[org,d.kitchenId])).rows[0];
   if(!recipient)throw new BusinessError('INVALID_REFERENCE','المطبخ خارج نطاق المؤسسة أو لم تتم مزامنته.');
   if(!recipient.active)throw new BusinessError('INACTIVE_RECORD','المطبخ محذوف. اختر مطبخًا نشطًا.');
   kitchen=recipient.name;
  }
  const site=(await tx.query<{active:boolean}>('SELECT active FROM locations WHERE organization_id=$1 AND id=$2',[org,d.locationId])).rows[0];
  if(!site)throw new BusinessError('INVALID_REFERENCE','المخزن خارج نطاق المؤسسة.');if(!site.active)throw new BusinessError('INACTIVE_RECORD','المخزن غير نشط.');
  const ids=[d.operationId,...d.lines.map(l=>l.lineId)];
  if((await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[org,ids])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','أحد معرّفات السطور مستخدم بالفعل.');
  const affected=new Set(d.lines.map(l=>l.itemId));
  const check=async()=>{if((await reconcileStock(tx,org)).some(r=>r.locationId===d.locationId&&affected.has(r.itemId)&&!r.matches))throw new BusinessError('RECONCILIATION_MISMATCH','رصيد إحدى المواد لا يطابق دفتر المخزون؛ لم يُرحّل الصرف.');};await check();
  const lines:PostedKitchenIssue['lines']=[];let total=decimal('0');
  // Validate and plan every line before changing any stock. The transaction also
  // rolls back every line if a later write fails or availability has changed.
  const plans=[];
  for(const l of d.lines){
   const item=(await tx.query<{active:boolean;unit_id:string;name:string;sku:string;unit:string}>('SELECT active,unit_id,name,sku,unit FROM items WHERE organization_id=$1 AND id=$2',[org,l.itemId])).rows[0];
   if(!item)throw new BusinessError('INVALID_REFERENCE','إحدى المواد خارج نطاق المؤسسة.');if(!item.active)throw new BusinessError('INACTIVE_RECORD','إحدى المواد غير نشطة.');if(item.unit_id!==l.unitId)throw new BusinessError('INVALID_UNIT','وحدة الصرف لا تطابق وحدة مخزون المادة.');
   const plan=await planIssue(tx,org,d.locationId,l.itemId,l.quantity);plans.push({line:l,plan});total=total.add(plan.amount);
   lines.push({lineId:l.lineId,itemId:l.itemId,name:item.name,sku:item.sku,unit:item.unit,quantity:l.quantity,amount:plan.amount});
  }
  const amount=total.toFixed(12),method=await costingMethod(tx,org);
  await tx.query('INSERT INTO kitchen_issues(organization_id,operation_id,payload,amount,method,lines,actor,kitchen_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,d.operationId,JSON.stringify({...d,kitchen}),amount,method,JSON.stringify(lines),access.userId,d.kitchenId??null]);
  for(const {line:l,plan} of plans){
   await applyIssue(tx,org,d.locationId,l.itemId,l.lineId,l.quantity,plan);
   await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,kitchen_issue_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[org,l.lineId,d.locationId,l.itemId,decimal(l.quantity).neg().toFixed(6),decimal(plan.amount).neg().toFixed(12),'kitchen.issue',kitchen+' · '+d.reference,d.businessDate,d.operationId]);
   await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,l.lineId,createHash('sha256').update('kitchen:'+d.operationId+':'+l.lineId).digest('hex'),JSON.stringify({operationId:l.lineId,outcome:'accepted',amount:plan.amount})]);
  }
  await check();await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,d.operationId,d.type]);
  const result:CommandResult={operationId:d.operationId,outcome:'accepted',amount};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,d.operationId,hash,JSON.stringify(result)]);return result;
 });
}
export async function kitchenIssueSnapshot(tx:QueryDatabase,org:string){return {kitchenIssues:(await tx.query<PostedKitchenIssue>('SELECT payload AS document,amount::text,method,lines,actor,posted_at::text AS "postedAt" FROM kitchen_issues WHERE organization_id=$1 ORDER BY posted_at DESC LIMIT 100',[org])).rows};}
