import type {PGlite} from '@electric-sql/pglite';
import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,type Access,type CommandResult,type Item} from '@saas/contracts';
import {workshopCommandSchema,type Transfer,type WorkshopDocument} from '../contracts/butchery';
import {decimal} from '@saas/domain';

import {stockMove,addPool,takePool,poolHead,valueNode} from './valuation';
import {assignReference,operationPrefix} from './references';
import {isProductionCommand,postProduction,productionSnapshot} from './production';

type Tx=Parameters<Parameters<PGlite['transaction']>[0]>[0];
function check(condition:unknown,message:string):asserts condition {if(!condition)throw new BusinessError('INVALID_COMMAND',message,400);}
export async function workshopSnapshot(tx:Tx,org:string) {
 const documents=await tx.query<WorkshopDocument>('SELECT (SELECT r.code FROM document_references r WHERE r.organization_id=w.organization_id AND r.entity_kind=\'operation\' AND r.entity_id=w.id::text) AS reference,id,command,amount::text,details,posted_at::text AS "postedAt" FROM workshop_documents w WHERE organization_id=$1 ORDER BY posted_at DESC,id',[org]);
 const transfers=await tx.query<Transfer>('SELECT (SELECT r.code FROM document_references r WHERE r.organization_id=t.organization_id AND r.entity_kind=\'operation\' AND r.entity_id=t.id::text) AS reference,id,source_id AS "sourceId",destination_id AS "destinationId",item_id AS "itemId",quantity::text,remaining::text,remaining_value::text AS "remainingValue",amount::text,business_date::text AS "businessDate" FROM transfers t WHERE organization_id=$1 ORDER BY business_date DESC,id',[org]);
 return {workshopDocuments:documents.rows,transfers:transfers.rows,...await productionSnapshot(tx,org)};
}

export async function postWorkshopCommand(db:PGlite,access:Access,input:unknown):Promise<CommandResult> {
 const parsed=workshopCommandSchema.safeParse(input);
 if(!parsed.success)throw new BusinessError('INVALID_COMMAND','تحقق من بيانات الجزارة والتحويل',400);
 const c=parsed.data,org=c.organizationId;
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة أو المؤسسة غير متاحة',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  const tenant=await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
  if(!tenant.rows.length)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة',403);
  const prior=await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId]);
  if(prior.rows[0]){if(prior.rows[0].payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم ببيانات مختلفة');return prior.rows[0].result;}
  const item=async(id:string)=>{const r=await tx.query<Item>('SELECT id,name,unit,meat_kind AS "meatKind" FROM items WHERE organization_id=$1 AND id=$2',[org,id]);check(r.rows[0],'المادة غير متاحة');return r.rows[0];};
  const location=async(id:string)=>{const r=await tx.query('SELECT id FROM locations WHERE organization_id=$1 AND id=$2',[org,id]);check(r.rows.length,'الموقع غير متاح');};
  const reference=await assignReference(tx,org,'operation',c.operationId,operationPrefix(c.type));
  const details:Record<string,unknown>={reference};let amount='0.000000000000';
  // Each ledger leg has its own operation ID. The immutable parent links every leg.
  const move=async(locationId:string,itemId:string,quantity:string,value:string,receipt:boolean,source?:string)=>{
   const leg=randomUUID();const posted=await stockMove(tx,org,{...c,operationId:leg,reason:`${c.reason||reference} · ${c.operationId}`},locationId,itemId,decimal(quantity).mul(receipt?1:-1).toFixed(6),receipt?value:undefined,source);
   const legs=(details.legs??=[]) as string[];legs.push(leg);if(!receipt)details.allocations={method:'weighted_average',amount:posted.amount};return posted;
  };
  let consumedNode:string|undefined;
  const consume=async(locationId:string,itemId:string,quantity:string)=>{
   const posted=await move(locationId,itemId,quantity,'0',false);consumedNode=posted.node;return posted.amount;
  };
  if(isProductionCommand(c)){
   amount=await postProduction(tx,access,c,details);
  } else if(c.type==='product.create') {
   const duplicate=await tx.query('SELECT id FROM items WHERE organization_id=$1 AND lower(trim(name))=lower(trim($2))',[org,c.name]);
   check(!duplicate.rows.length,'يوجد صنف بهذا الاسم؛ استخدم الصنف الموجود');
   await tx.query('INSERT INTO items(organization_id,id,name,sku,category,unit,minimum,meat_kind) VALUES($1,$2,$3,$4,$5,$6,0,$7)',[org,c.itemId,c.name,await assignReference(tx,org,'item',c.itemId,'MAT'),c.meatKind.startsWith('beef')?'لحوم بقري':'لحوم ضاني','كجم',c.meatKind]);
  } else if(c.type==='butchery.process') {
   await location('butchery');const inputItem=await item(c.itemId);
   check(inputItem.meatKind===(c.mode==='beef'?'beef_input':'sheep_live')&&inputItem.unit==='كجم','اختر مدخل بقري أو ضاني مناسباً بالكيلوجرام');
   check(new Set(c.outputs.map(o=>o.itemId)).size===c.outputs.length,'لا تكرر صنفاً في المخرجات');
   const sum=c.outputs.reduce((n,o)=>n.add(o.quantity),decimal('0'));
   check(c.outputs.reduce((n,o)=>n.add(o.costShare),decimal('0')).eq(100),'يجب أن يكون مجموع نسب التكلفة 100%');
   if(c.mode==='lamb') {
    check(c.headCount&&c.carcassWeight,'عدد الرؤوس ووزن الذبيحة مطلوبان');
    check(decimal(c.carcassWeight).add(c.slaughterLoss).eq(c.quantity),'وزن الذبيحة وفاقد الذبح يجب أن يساويا الوزن الحي');
    check(sum.add(c.cuttingLoss).eq(c.carcassWeight),'المخرجات وفاقد التقطيع يجب أن يساويا وزن الذبيحة');
   } else {
    check(decimal(c.slaughterLoss).isZero()&&!c.headCount&&!c.carcassWeight,'البقري المشترى لحوم لا يحتاج بيانات ذبح');
    check(sum.add(c.cuttingLoss).eq(c.quantity),'المخرجات وفاقد التقطيع يجب أن يساويا وزن المدخل');
   }
   for(const output of c.outputs){const product=await item(output.itemId);check(product.unit==='كجم'&&product.meatKind===(c.mode==='beef'?'beef_product':'lamb_product'),'نوع صنف المخرج لا يطابق الدفعة');}
   const inputCost=await consume('butchery',c.itemId,c.quantity);
   amount=decimal(inputCost).add(c.processingCost).toFixed(12);details.inputCost=inputCost;
   await addPool(tx,org,'legacy',c.operationId,consumedNode!);if(decimal(c.processingCost).gt(0))await addPool(tx,org,'legacy',c.operationId,await valueNode(tx,org,c.processingCost));
   let allocated=decimal('0');const costs=[];
   // Round all shares down; assign the sub-cent remainder to the last positive share.
   const last=c.outputs.reduce((index,o,i)=>decimal(o.costShare).gt(0)?i:index,-1);
   for(let i=0;i<c.outputs.length;i++) {
    const o=c.outputs[i],value=i===last?decimal(amount).sub(allocated):decimal(amount).mul(o.costShare).div(100).toDecimalPlaces(12,1);
    allocated=allocated.add(value);const outputNode=await takePool(tx,org,'legacy',c.operationId,value.toFixed(12));await move('butchery',o.itemId,o.quantity,value.toFixed(12),true,outputNode);
    costs.push({...o,amount:value.toFixed(12),unitCost:value.div(o.quantity).toFixed(12)});
   }
   details.outputs=costs;
  } else if(c.type==='transfer.dispatch') {
   await location(c.sourceId);await location(c.destinationId);check(c.sourceId!==c.destinationId,'اختر موقعين مختلفين');
   await item(c.itemId);check(c.sourceId==='butchery'||c.destinationId==='butchery'||c.sourceId==='central','التحويل من المخزن الرئيسي إلى المطابخ أو عبر الجزارة');
   amount=await consume(c.sourceId,c.itemId,c.quantity);
   await tx.query('INSERT INTO transfers(organization_id,id,source_id,destination_id,item_id,quantity,remaining,remaining_value,amount,business_date,valuation_node) VALUES($1,$2,$3,$4,$5,$6,$6,$7,$7,$8,$9)',[org,c.operationId,c.sourceId,c.destinationId,c.itemId,c.quantity,amount,c.businessDate,consumedNode]);
   await addPool(tx,org,'transit',c.operationId,consumedNode!);
  } else {
   const result=await tx.query<Transfer&{valuation_node:string}>('SELECT valuation_node,id,destination_id AS "destinationId",item_id AS "itemId",remaining::text,remaining_value::text AS "remainingValue" FROM transfers WHERE organization_id=$1 AND id=$2 FOR UPDATE',[org,c.transferId]);const transfer=result.rows[0];check(transfer,'التحويل غير متاح؛ زامن إرسال التحويل أولاً');
   check(decimal(c.quantity).lte(transfer.remaining),'الكمية تتجاوز المتبقي بالطريق');
   amount=decimal(c.quantity).eq(transfer.remaining)?transfer.remainingValue:decimal(transfer.remainingValue).mul(c.quantity).div(transfer.remaining).toFixed(12);
   if(!await poolHead(tx,org,'transit',c.transferId))await addPool(tx,org,'transit',c.transferId,await valueNode(tx,org,transfer.remainingValue));
   const source=await takePool(tx,org,'transit',c.transferId,amount,decimal(c.quantity).div(transfer.remaining).toFixed(30));
   await move(transfer.destinationId,transfer.itemId,c.quantity,amount,true,source);
   await tx.query('UPDATE transfers SET remaining=remaining-$3::numeric,remaining_value=remaining_value-$4::numeric WHERE organization_id=$1 AND id=$2',[org,c.transferId,c.quantity,amount]);
  }
  await tx.query('INSERT INTO workshop_documents(organization_id,id,command,amount,details) VALUES($1,$2,$3,$4,$5)',[org,c.operationId,JSON.stringify(c),amount,JSON.stringify(details)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);
  const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount,reference};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(result)]);return result;
 });
}
