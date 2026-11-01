import {createHash} from 'node:crypto';
import {BusinessError,type Access,type CommandResult} from '@saas/contracts';
import {inventoryControlSchema,type InventoryRole,type InventoryOperationsSnapshot} from '../contracts/inventory-operations';
import type {Database,QueryDatabase} from './database';
import {assertGeneration} from './valuation';
import {reconcileStock} from './counts';
import {consumptionReconciliation} from './consumption-reconciliation';
import {reportQuerySchema} from '../contracts/reports';

async function effectiveRole(tx:QueryDatabase,access:Access):Promise<InventoryRole>{
 const actor=(await tx.query<{actor:string|null}>("SELECT current_setting('fodo.user',true) AS actor")).rows[0]?.actor;
 if(!actor)return access.role??'owner';
 const row=(await tx.query<{role:InventoryRole}>('SELECT role FROM user_access WHERE user_id::text=$1 AND organization_id=$2 AND active',[access.userId,access.organizationId])).rows[0];
 if(!row)throw new BusinessError('FORBIDDEN','الحساب غير مفعل.',403);return row.role;
}
export async function inventoryOperationsSnapshot(tx:QueryDatabase,org:string,access:Access):Promise<InventoryOperationsSnapshot>{
 const closures=(await tx.query<InventoryOperationsSnapshot['closures'][number]>('SELECT location_id AS "locationId",closed_through::text AS through,revision,actor,reason,updated_at::text AS "updatedAt" FROM day_closures WHERE organization_id=$1',[org])).rows;
 const explanations=(await tx.query<InventoryOperationsSnapshot['explanations'][number]>(`SELECT operation_id::text AS "operationId",payload->>'locationId' AS "locationId",payload->>'itemId' AS "itemId",payload->>'from' AS "from",payload->>'to' AS "to",payload->>'checkpoint' AS checkpoint,payload->>'reason' AS reason,(payload->>'reviewed')::boolean AS reviewed,actor,created_at::text AS "createdAt" FROM inventory_control_events WHERE organization_id=$1 AND payload->>'type'='variance.explain' ORDER BY created_at DESC`,[org])).rows;
 const members=(access.role??'owner')==='owner'?(await tx.query<InventoryOperationsSnapshot['members'][number]>('SELECT user_id::text AS "userId",role,display_name AS "displayName",active FROM user_access WHERE organization_id=$1 ORDER BY user_id',[org])).rows:[];
 return {closures,explanations,members};
}
export async function postInventoryControl(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=inventoryControlSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_CONTROL','راجع التاريخ والمرجع وبيانات المراجعة.',400);const c=parsed.data,org=c.organizationId;
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','جدد جلسة المؤسسة الصحيحة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرف المراجعة مستخدم ببيانات مختلفة.');return prior.result;}
  const role=await effectiveRole(tx,access),manager=role==='manager'||role==='owner';if(role==='viewer')throw new BusinessError('FORBIDDEN','الحساب للعرض فقط.',403);
  let detail:unknown={};
  if(c.type==='access.role'){
   if(role!=='owner')throw new BusinessError('FORBIDDEN','تغيير الصلاحيات للمالك فقط.',403);
   if(c.userId===access.userId&&c.role!=='owner')throw new BusinessError('FORBIDDEN','لا تغيّر صلاحيتك الحالية؛ اطلب من مالك آخر مراجعتها.',403);
   const member=(await tx.query<{role:InventoryRole;active:boolean}>('SELECT role,active FROM user_access WHERE organization_id=$1 AND user_id::text=$2 FOR UPDATE',[org,c.userId])).rows[0];if(!member)throw new BusinessError('FORBIDDEN','المستخدم خارج المؤسسة.',403);
   if(member.active&&member.role==='owner'&&c.role!=='owner'&&Number((await tx.query<{count:string}>("SELECT count(*)::text AS count FROM user_access WHERE organization_id=$1 AND active AND role='owner'",[org])).rows[0].count)<=1)throw new BusinessError('LAST_OWNER','يجب الاحتفاظ بمالك نشط واحد على الأقل.');
   await tx.query('UPDATE user_access SET role=$3,display_name=$4 WHERE organization_id=$1 AND user_id::text=$2',[org,c.userId,c.role,c.displayName]);detail={previousRole:member.role,role:c.role};
  }else{
   if(!(await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2',[org,c.locationId])).rows.length)throw new BusinessError('FORBIDDEN','الموقع خارج المؤسسة.',403);
   if(c.type==='variance.explain'){
    if(c.reviewed&&!manager)throw new BusinessError('APPROVAL_REQUIRED','اعتماد التفسير يحتاج مديراً.',403);
    const checkpoint=(await tx.query<{value:string}>(`SELECT (SELECT COALESCE(max(sequence),0)::text FROM stock_entries WHERE organization_id=$1)||':'||(SELECT COALESCE(max(id),0)::text FROM audit_events WHERE organization_id=$1) AS value`,[org])).rows[0].value;
    if(checkpoint!==c.checkpoint)throw new BusinessError('STALE_REVIEW','تغير دفتر المخزون؛ حدّث تقرير الرقابة.');
    const query=reportQuerySchema.parse({kind:'reconciliation',organizationId:org,generation:c.generation,from:c.from,to:c.to,locationId:c.locationId,itemId:c.itemId,pageSize:100});
    const comparison=await consumptionReconciliation(tx,query);if(!comparison.rows.length)throw new BusinessError('INVALID_REFERENCE','المادة غير موجودة في نتيجة الفترة.');detail={comparison:comparison.rows[0].comparison};
   }else{
    if(!manager||c.type==='day.reopen'&&role!=='owner')throw new BusinessError('APPROVAL_REQUIRED',c.type==='day.reopen'?'إعادة فتح الفترة للمالك فقط.':'إقفال اليوم يحتاج مديراً.',403);
    const old=(await tx.query<{revision:number;through:string|null}>('SELECT revision,closed_through::text AS through FROM day_closures WHERE organization_id=$1 AND location_id=$2 FOR UPDATE',[org,c.locationId])).rows[0];
    if((old?.revision??0)!==c.expectedRevision)throw new BusinessError('STALE_REVISION','تغير إقفال الموقع؛ حدّث البيانات.');
    if(c.type==='day.close'){
     const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(c.through>today||old?.through&&c.through<=old.through)throw new BusinessError('INVALID_DATE','اختر تاريخاً بعد الإقفال السابق وحتى اليوم.');
     const stock=await reconcileStock(tx,org);if(stock.some(r=>r.locationId===c.locationId&&!r.matches))throw new BusinessError('RECONCILIATION_MISMATCH','الرصيد والدفتر وطبقات التكلفة غير متطابقة؛ لا يمكن الإقفال.');
     const draft=(await tx.query(`SELECT 1 FROM stock_counts WHERE organization_id=$1 AND location_id=$2 AND state='draft' AND (payload->>'businessDate')::date<=$3::date LIMIT 1`,[org,c.locationId,c.through])).rows.length;if(draft)throw new BusinessError('COUNT_APPROVAL_REQUIRED','يوجد جرد غير معتمد في الفترة؛ راجعه أولاً.');
     const review=await consumptionReconciliation(tx,reportQuerySchema.parse({organizationId:org,kind:'reconciliation',from:c.through,to:c.through,locationId:c.locationId,pageSize:100}));
     if((review.summary.incomplete>0||review.summary.complete===0)&&!c.acknowledgeIncomplete)throw new BusinessError('INCOMPLETE_REVIEW','مقارنة الاستهلاك غير مكتملة؛ راجع السبب وأقرّ به قبل الإقفال.');detail={previousThrough:old?.through??null,review:review.summary};
     await tx.query('INSERT INTO day_closures(organization_id,location_id,closed_through,revision,actor,reason) VALUES($1,$2,$3,1,$4,$5) ON CONFLICT(organization_id,location_id) DO UPDATE SET closed_through=EXCLUDED.closed_through,revision=day_closures.revision+1,actor=EXCLUDED.actor,reason=EXCLUDED.reason,updated_at=now()',[org,c.locationId,c.through,access.userId,c.reason]);
    }else{if(!old?.through)throw new BusinessError('INVALID_STATE','لا توجد فترة مقفلة.');detail={previousThrough:old.through};await tx.query('UPDATE day_closures SET closed_through=NULL,revision=revision+1,actor=$3,reason=$4,updated_at=now() WHERE organization_id=$1 AND location_id=$2',[org,c.locationId,access.userId,c.reason]);}
   }
  }
  const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount:'0'};
  await tx.query('INSERT INTO inventory_control_events(organization_id,operation_id,payload,result,actor) VALUES($1,$2,$3,$4,$5)',[org,c.operationId,JSON.stringify(c),JSON.stringify(detail),access.userId]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(result)]);return result;
 });
}
