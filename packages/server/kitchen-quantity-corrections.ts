import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,type Access,type CommandResult,type KitchenIssueDocument,type PostedKitchenIssue} from '@saas/contracts';
import {kitchenEditDocumentSchema,kitchenIssueRevisionSchema,type KitchenDocumentChanges,type KitchenIssueRevisionCommand} from '../contracts/document-corrections';
import {decimal} from '@saas/domain';
import type {Database,QueryDatabase} from './database';
import {assertInventoryDateOpen,assertInventoryManager} from './inventory-permissions';
import {addIncomingStock} from './incoming';
import {sourceLot} from './stock-lots';
import {applyIssue,assertGeneration,planIssue} from './valuation';
import {reconcileStock} from './counts';
import {readKitchenIssues} from './kitchen-revision-state';

type IssuePlan=Awaited<ReturnType<typeof planIssue>>;
type PostedLine=PostedKitchenIssue['lines'][number];
type InputLine=KitchenIssueDocument['lines'][number];
type Posting={org:string;documentId:string;date:string;reason:string};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export async function postKitchenIssueRevision(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 assertInventoryManager(access);
 const parsed=kitchenIssueRevisionSchema.safeParse(input);
 if(!parsed.success)throw new BusinessError('INVALID_CORRECTION','راجع بيانات المستند والكميات وسبب التصحيح.',400);
 const command=parsed.data,org=command.organizationId;
 if(org!==access.organizationId)throw new BusinessError('FORBIDDEN','المستند يخص مؤسسة أخرى.',403);
 if(!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('AUTH_REQUIRED','جدد جلسة الدخول.',401);
 const hash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
  await assertGeneration(tx,org,command.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,command.operationId])).rows[0];
  if(prior){
   if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرف التصحيح مستخدم لبيانات مختلفة.');
   return prior.result;
  }
  if((await tx.query('SELECT 1 FROM document_corrections WHERE organization_id=$1 AND source_id=$2',[org,command.sourceId])).rows.length)throw new BusinessError('ALREADY_CORRECTED','افتح المستند الحالي قبل التصحيح.');
  const [issue]=await readKitchenIssues(tx,org,command.sourceId);
  if(!issue||issue.document.type!=='kitchen.transfer'||!issue.document.destinationLocationId)throw new BusinessError('INVALID_REFERENCE','اختر مستند تحويل مخزون مقبولاً إلى مطبخ.');
  const revision=issue.revision??0;
  if(command.expectedRevision!==revision)throw new BusinessError('STALE_REVISION','تغير المستند. زامن التطبيق وافتح أحدث نسخة قبل التصحيح.');
  const posting={org,documentId:command.sourceId,date:today(),reason:command.reason};
  if(command.kind==='kitchen_quantity'){
   await postQuantity(tx,issue,command,posting,access.userId,revision+1);
  }else{
   await postDocument(tx,issue,command,posting,access.userId,revision+1);
  }
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',
   [org,access.userId,command.operationId,command.kind==='kitchen_edit'?'kitchen.document.edit':'kitchen.quantity.correct']);
  const result={operationId:command.operationId,outcome:'accepted' as const,replacementId:command.sourceId};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,command.operationId,hash,JSON.stringify(result)]);
  return result;
 });
}

async function postQuantity(tx:QueryDatabase,issue:PostedKitchenIssue,command:Extract<KitchenIssueRevisionCommand,{kind:'kitchen_quantity'}>,posting:Posting,actor:string,revision:number){
 const line=issue.lines.find(row=>row.lineId===command.lineId),input=issue.document.lines.find(row=>row.lineId===command.lineId);
 if(!line||!input)throw new BusinessError('INVALID_REFERENCE','المادة غير موجودة في هذا المستند.');
 const delta=decimal(command.quantity).sub(line.quantity);
 if(delta.isZero())throw new BusinessError('INVALID_CORRECTION','أدخل كمية تختلف عن الكمية المسجلة.');
 const destination=issue.document.destinationLocationId!;
 const amount=await applyLineEdit(tx,posting,issue.document.locationId,destination,destination,line,{...input,quantity:command.quantity},line,input.unitPrice);
 await tx.query(`INSERT INTO kitchen_quantity_revisions(organization_id,kitchen_issue_id,line_id,operation_id,revision,previous_quantity,quantity,amount,actor,reason,business_date)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [posting.org,posting.documentId,line.lineId,command.operationId,revision,line.quantity,command.quantity,amount,actor,posting.reason,posting.date]);
}

async function postDocument(tx:QueryDatabase,issue:PostedKitchenIssue,command:Extract<KitchenIssueRevisionCommand,{kind:'kitchen_edit'}>,posting:Posting,actor:string,revision:number){
 const {document:previous}=issue,{document:input}=command;
 if(input.organizationId!==posting.org||input.generation!==command.generation||input.operationId!==posting.documentId||input.locationId!==previous.locationId||input.type!=='kitchen.transfer'){
  throw new BusinessError('INVALID_REFERENCE','التصحيح يحتفظ برقم المستند ومخزن المصدر.');
 }
 if(input.businessDate>posting.date)throw new BusinessError('INVALID_DATE','تاريخ المستند المصحح لا يمكن أن يكون في المستقبل.');
 const oldDestination=previous.destinationLocationId!,newDestination=input.destinationLocationId!;
 let kitchen=previous.kitchen;
 if(input.kitchenId!==previous.kitchenId||newDestination!==oldDestination){
  const target=(await tx.query<{name:string;locationId:string;active:boolean}>(`SELECT k.name,k.location_id AS "locationId",k.active AND l.active AS active
   FROM kitchens k JOIN locations l ON l.organization_id=k.organization_id AND l.id=k.location_id
   WHERE k.organization_id=$1 AND k.id=$2`,[posting.org,input.kitchenId])).rows[0];
  if(!target?.active||target.locationId!==newDestination||newDestination===previous.locationId)throw new BusinessError('INVALID_REFERENCE','اختر مطبخاً نشطاً له موقع مخزون مختلف عن المصدر.');
  kitchen=target.name;
 }
 const oldInputs=new Map(previous.lines.map(line=>[line.itemId,line]));
 const oldLines=new Map(issue.lines.map(line=>[line.itemId,line]));
 const newInputs=new Map(input.lines.map(line=>[line.itemId,line]));
 const fields:KitchenDocumentChanges['fields']=[];
 const updated={...input,kitchen,capturedAt:previous.capturedAt};
 for(const field of ['businessDate','kitchen','reference','notes'] as const){
  if(previous[field]!==updated[field]||field==='kitchen'&&(input.kitchenId!==previous.kitchenId||newDestination!==oldDestination)){
   fields.push({field,previous:previous[field],current:updated[field]});
  }
 }
 const details:KitchenDocumentChanges['lines']=[];
 const posted=new Map<string,PostedLine>();
 const canonical=new Map<string,InputLine>();
 for(const itemId of new Set([...oldInputs.keys(),...newInputs.keys()])){
  const before=oldInputs.get(itemId),after=newInputs.get(itemId),old=oldLines.get(itemId);
  if(before&&!old)throw new BusinessError('INVALID_REFERENCE','تعذر مطابقة بيانات مادة بالمستند الأصلي.');
  let item:Pick<PostedLine,'name'|'sku'|'unit'>;
  if(old){
   item=old;
   if(before&&after&&after.unitId!==before.unitId)throw new BusinessError('INVALID_UNIT',old.name+': استخدم وحدة المخزون المسجلة في المستند.');
  }else{
   const added=(await tx.query<{name:string;sku:string;unit:string;unitId:string;active:boolean}>(
    'SELECT name,sku,unit,unit_id AS "unitId",active FROM items WHERE organization_id=$1 AND id=$2',[posting.org,itemId])).rows[0];
   if(!added||!after||!added.active||after.unitId!==added.unitId)throw new BusinessError('INVALID_REFERENCE',(added?.name??itemId)+': اختر مادة نشطة بوحدة المخزون الصحيحة.');
   item=added;
  }
  if(after)canonical.set(itemId,{...after,lineId:before?.lineId??after.lineId});
  const quantityChanged=!before||!after||!decimal(before.quantity).eq(after.quantity);
  const priceChanged=before?.unitPrice===undefined||after?.unitPrice===undefined
   ?before?.unitPrice!==after?.unitPrice:!decimal(before.unitPrice).eq(after.unitPrice);
  if(quantityChanged||priceChanged)details.push({itemId,lineId:before?.lineId??after?.lineId,name:item.name,unit:item.unit,
   previous:before&&{quantity:before.quantity,unitPrice:before.unitPrice},current:after&&{quantity:after.quantity,unitPrice:after.unitPrice}});
  const amount=quantityChanged||newDestination!==oldDestination
   ?await applyLineEdit(tx,posting,previous.locationId,oldDestination,newDestination,old,after,{...item,itemId},before?.unitPrice)
   :old!.amount;
  if(after)posted.set(itemId,{lineId:canonical.get(itemId)!.lineId,itemId,name:item.name,sku:item.sku,unit:item.unit,quantity:after.quantity,amount});
 }
 if(!fields.length&&!details.length)throw new BusinessError('INVALID_CORRECTION','عدّل بيانات المستند أو أحد بنوده أولاً.');
 const document=kitchenEditDocumentSchema.safeParse({...updated,lines:input.lines.map(line=>canonical.get(line.itemId))});
 if(!document.success)throw new BusinessError('INVALID_CORRECTION','معرّفات بنود المستند غير متطابقة.');
 const lines=input.lines.map(line=>posted.get(line.itemId)!);
 const amount=lines.reduce((sum,line)=>sum.add(line.amount),decimal('0')).toFixed(12);
 await tx.query(`INSERT INTO kitchen_document_revisions(organization_id,kitchen_issue_id,operation_id,revision,document,lines,amount,changes,actor,reason,business_date)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [posting.org,posting.documentId,command.operationId,revision,JSON.stringify(document.data),JSON.stringify(lines),amount,JSON.stringify({fields,lines:details}),actor,posting.reason,posting.date]);
}

async function applyLineEdit(tx:QueryDatabase,posting:Posting,warehouse:string,oldKitchen:string,newKitchen:string,old:PostedLine|undefined,next:InputLine|undefined,item:Pick<PostedLine,'itemId'|'name'|'unit'>,oldPrice:string|undefined){
 const {org,date}=posting;
 const before=decimal(old?.quantity??'0'),after=decimal(next?.quantity??'0');
 const delta=after.sub(before),retained=before.lt(after)?before:after;
 const locations=[...new Set([
  ...(delta.lt(0)?[oldKitchen,warehouse]:[]),
  ...(oldKitchen!==newKitchen&&retained.gt(0)?[oldKitchen,newKitchen]:[]),
  ...(delta.gt(0)?[warehouse,newKitchen]:[])
 ])];
 const assertReconciled=async()=>{
  if((await reconcileStock(tx,org,{itemId:item.itemId,locationIds:locations})).some(row=>!row.matches)){
   throw new BusinessError('RECONCILIATION_MISMATCH','رصيد المادة لا يطابق دفتر المخزون. لم يتم التصحيح.');
  }
 };
 try{
  for(const location of locations)await assertInventoryDateOpen(tx,org,location,date);
  await assertReconciled();
  let amount=decimal(old?.amount??'0');
  if(delta.lt(0))amount=amount.sub(await moveStock(tx,posting,item,oldKitchen,warehouse,delta.abs().toFixed(6),'return',oldPrice));
  if(oldKitchen!==newKitchen&&retained.gt(0))amount=decimal(await moveStock(tx,posting,item,oldKitchen,newKitchen,retained.toFixed(6),'redirect'));
  if(delta.gt(0))amount=amount.add(await moveStock(tx,posting,item,warehouse,newKitchen,delta.toFixed(6),'issue',next?.unitPrice));
  if(amount.lt(0)||after.isZero()&&!amount.isZero())throw new BusinessError('RECONCILIATION_MISMATCH','قيمة التصحيح لا تطابق التكلفة المسجلة للبند.');
  await assertReconciled();
  return amount.toFixed(12);
 }catch(error){
  if(error instanceof BusinessError&&!error.message.includes(item.name))throw new BusinessError(error.code,item.name+': '+error.message,error.status);
  throw error;
 }
}

async function moveStock(tx:QueryDatabase,posting:Posting,item:Pick<PostedLine,'itemId'|'name'|'unit'>,from:string,to:string,quantity:string,mode:'issue'|'return'|'redirect',unitPrice?:string){
 const {org,documentId,date,reason}=posting;
 const {itemId,name,unit}=item;
 const plan=mode==='issue'
  ?await planIssue(tx,org,from,itemId,quantity)
  :await planKitchenReduction(tx,org,documentId,from,itemId,quantity,name,unit);
 const outgoing=randomUUID();
 const priceAmount=(q:string)=>unitPrice===undefined?null:decimal(unitPrice).mul(q).toFixed(12);
 await applyIssue(tx,org,from,itemId,outgoing,quantity,plan);
 await tx.query(`INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,kitchen_issue_id,reference_amount)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [org,outgoing,from,itemId,decimal(quantity).neg().toFixed(6),decimal(plan.amount).neg().toFixed(12),
   mode==='issue'?'kitchen.transfer.out':'kitchen.transfer.reverse.in',reason,date,documentId,mode==='issue'?priceAmount(decimal(quantity).neg().toFixed(6)):null]);
 for(const allocation of plan.allocations){
  const operationId=randomUUID();
  await addIncomingStock(tx,{organizationId:org,operationId,locationId:to,itemId,quantity:allocation.quantity,
   unitCost:decimal(allocation.amount).div(allocation.quantity).toFixed(6),amount:allocation.amount,
   type:mode==='return'?'kitchen.transfer.reverse.out':'kitchen.transfer.in',reason,businessDate:date,lot:await sourceLot(tx,org,allocation.layerId)});
  await tx.query('UPDATE stock_entries SET kitchen_issue_id=$3,reference_amount=$4 WHERE organization_id=$1 AND operation_id=$2',
   [org,operationId,documentId,mode==='return'?priceAmount(allocation.quantity):null]);
 }
 return plan.amount;
}

async function planKitchenReduction(tx:QueryDatabase,org:string,documentId:string,location:string,item:string,quantity:string,name:string,unit:string):Promise<IssuePlan>{
 const layers=(await tx.query<{id:string;remaining:string;quantity:string;amount:string}>(`SELECT l.id,l.remaining::text,e.quantity::text,e.amount::text
  FROM stock_entries e JOIN cost_layers l ON l.organization_id=e.organization_id AND l.sequence=e.sequence
  WHERE e.organization_id=$1 AND e.kitchen_issue_id=$2 AND e.location_id=$3 AND e.item_id=$4
  AND e.type='kitchen.transfer.in' AND e.quantity>0 AND l.remaining>0
  ORDER BY e.sequence DESC FOR UPDATE OF l`,[org,documentId,location,item])).rows;
 const available=layers.reduce((total,row)=>total.add(row.remaining),decimal('0'));
 if(available.lt(quantity))throw new BusinessError('SOURCE_ALREADY_USED',`تصحيح ${name} يحتاج ${quantity} ${unit} من التوريد الأصلي؛ المتاح ${available} ${unit}. راجع حركات الاستهلاك أو التحويل لهذا البند.`);
 let left=decimal(quantity),value=decimal('0');
 const allocations:IssuePlan['allocations']=[];
 for(const layer of layers){
  if(left.isZero())break;
  const before=decimal(layer.remaining),take=before.lt(left)?before:left;
  const originalValue=(remaining:typeof before)=>decimal(layer.amount).mul(remaining).div(layer.quantity).toDecimalPlaces(12);
  const amount=originalValue(before).sub(originalValue(before.sub(take)));
  allocations.push({layerId:layer.id,quantity:take.toFixed(6),amount:amount.toFixed(12)});
  value=value.add(amount);
  left=left.sub(take);
 }
 const balance=(await tx.query<{quantity:string;value:string;method:IssuePlan['method']}>(`SELECT b.quantity::text,b.value::text,o.costing_method AS method
  FROM stock_balances b JOIN organizations o ON o.id=b.organization_id
  WHERE b.organization_id=$1 AND b.location_id=$2 AND b.item_id=$3 FOR UPDATE OF b`,[org,location,item])).rows[0];
 if(!balance||decimal(balance.quantity).lt(quantity)||decimal(balance.value).lt(value)
  ||decimal(balance.quantity).eq(quantity)&&!decimal(balance.value).eq(value)){
  throw new BusinessError('RECONCILIATION_MISMATCH','تكلفة الصرف الأصلي تتعارض مع تقييم الرصيد الحالي. يلزم مراجعة التكلفة قبل التصحيح.');
 }
 return {method:balance.method,amount:value.toFixed(12),allocations};
}
