import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,type Access,type CommandResult,type RecipeDefinition} from '@saas/contracts';
import {centralCommandSchema,type CentralCommand,type CentralBatch,type CentralAction,type CentralEffect,type CentralIssue} from '../contracts/central-kitchen';
import type {StockLot,LotMetadata} from '../contracts/inventory-operations';
import type {Database,QueryDatabase} from './database';
import {decimal} from '@saas/domain';
import {assertGeneration,applyIssue,planIssue,costingMethod,rebalanceAverage} from './valuation';
import {assertInventoryWrite,assertInventoryDateOpen} from './inventory-permissions';
import {addIncomingStock} from './incoming';
import {sourceLot} from './stock-lots';
import {exactOutputLayers} from '../domain/production';
import {nextAutomaticCode} from './automatic-code';
import {reconcileStock} from './counts';

function check(value:unknown,message:string,code='INVALID_CENTRAL_BATCH'):asserts value{if(!value)throw new BusinessError(code,message);}
const sum=(values:string[])=>values.reduce((n,v)=>n.add(v),decimal('0'));
const money=(value:ReturnType<typeof decimal>)=>value.toFixed(12);
const remaining=(line:CentralIssue)=>decimal(line.quantity).sub(line.returned).sub(line.lost);
const weight=(value:ReturnType<typeof decimal>)=>value.toDecimalPlaces(6).toString();
function weightImbalanceMessage(inputMass:ReturnType<typeof decimal>,outputMass:ReturnType<typeof decimal>){
 const difference=outputMass.sub(inputMass),gap=difference.abs();
 const detail=`إجمالي المواد المستهلكة بعد المرتجعات والفاقد ${weight(inputMass)} كجم، وإجمالي المنتجات المستلمة ${weight(outputMass)} كجم، والفرق ${weight(gap)} كجم.`;
 if(difference.gt(0))return `الوزن المستلم أكبر من وزن المواد المستهلكة. ${detail} أضف وصرف المكوّن الناقص مثل الماء بكمية ${weight(gap)} كجم، أو صحح كمية/وزن المنتج المستلم إذا كان التسجيل غير دقيق.`;
 return `وزن المواد المستهلكة أكبر من الوزن المستلم. ${detail} سجّل مرتجعًا أو فاقدًا إضافيًا بمقدار ${weight(gap)} كجم، أو صحح كمية/وزن المنتج المستلم إذا كان الوزن الفعلي أكبر.`;
}
const sourceRemaining=(source:CentralIssue['sources'][number])=>decimal(source.quantity).sub(source.returned).sub(source.lost??'0');
const sourceValue=(source:CentralIssue['sources'][number])=>decimal(source.amount).sub(source.returnedAmount).sub(source.lostAmount??'0');
function refresh(b:CentralBatch){
 b.issuedAmount=money(sum(b.issues.map(l=>l.amount)));b.returnedAmount=money(sum(b.issues.map(l=>l.returnedAmount)));b.processingAmount=money(sum(b.processingCosts.map(l=>l.amount)));b.abnormalAmount=money(sum(b.issues.map(l=>l.abnormalAmount)));
 const value=decimal(b.issuedAmount).sub(b.returnedAmount).add(b.processingAmount).sub(b.abnormalAmount);
 check(value.gte(0),'قيمة الدفعة غير متوازنة.','RECONCILIATION_MISMATCH');
 b.wipAmount=b.status==='closed'?'0.000000000000':money(value);
 if(b.status!=='closed'){b.outputAmount='0.000000000000';b.expenseAmount=b.abnormalAmount;b.status=b.receipts.length?'partially_received':b.issues.length||b.processingCosts.length?'in_progress':'draft';}
}
export async function centralKitchenSnapshot(tx:QueryDatabase,org:string){
 const batches=(await tx.query<{state:CentralBatch}>('SELECT state FROM central_batches WHERE organization_id=$1 ORDER BY created_at DESC',[org])).rows.map(r=>r.state);
 const actions=(await tx.query<CentralAction>('SELECT operation_id::text AS "operationId",batch_id::text AS "batchId",command,actor,posted_at::text AS "postedAt",amount::text,effects,reversed_by::text AS "reversedBy" FROM central_actions WHERE organization_id=$1 ORDER BY sequence',[org])).rows;
 return {centralBatches:batches,centralActions:actions};
}

export async function postCentralKitchen(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 assertInventoryWrite(access);const parsed=centralCommandSchema.safeParse(input);
 if(!parsed.success)throw new BusinessError('INVALID_CENTRAL_COMMAND',parsed.error.issues[0]?.message??'راجع بيانات الدفعة.',400);
 const c=parsed.data,org=c.organizationId;
 check(org===access.organizationId&&Number.isFinite(Date.parse(access.expiresAt))&&Date.parse(access.expiresAt)>Date.now(),'الجلسة لا تسمح بهذه المؤسسة.','FORBIDDEN');
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];
  if(prior){check(prior.payload_hash===hash,'معرّف العملية مستخدم لبيانات مختلفة.','PAYLOAD_CONFLICT');return prior.result;}
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());check(c.businessDate<=today,'لا يمكن تسجيل تاريخ في المستقبل.','FUTURE_DATE');
  const stored=(await tx.query<{state:CentralBatch}>('SELECT state FROM central_batches WHERE organization_id=$1 AND batch_id=$2 FOR UPDATE',[org,c.batchId])).rows[0]?.state;
  check((stored?.revision??0)===c.expectedRevision,'تغيرت الدفعة؛ زامن البيانات وراجع العملية.','STALE_REVISION');
  let b:CentralBatch;
  if(c.type==='central.create'){
   check(!stored,'الدفعة موجودة بالفعل.');check(c.expectedRevision===0,'الدفعة الجديدة تبدأ من الإصدار صفر.');
   check((await tx.query('SELECT l.id FROM locations l WHERE l.organization_id=$1 AND l.id=$2 AND l.active AND NOT EXISTS(SELECT 1 FROM kitchens k WHERE k.organization_id=l.organization_id AND k.location_id=l.id)',[org,c.locationId])).rows.length,'اختر مخزنًا نشطًا داخل المؤسسة.');
   if(c.recipeVersionId){const version=(await tx.query<{payload:RecipeDefinition}>('SELECT payload FROM recipe_versions WHERE organization_id=$1 AND version_id=$2',[org,c.recipeVersionId])).rows[0]?.payload;check(version&&version.outputMode==='stocked'&&version.effectiveDate<=c.businessDate,'اختر وصفة مخزنية منشورة وسارية في تاريخ الدفعة.');check(c.plannedOutput,'أدخل كمية الإنتاج المطلوبة للوصفة.');}
   b={batchId:c.batchId,reference:await nextAutomaticCode(tx,org,'central'),name:c.name,locationId:c.locationId,operationType:c.operationType,butcheryMode:c.butcheryMode,recipeVersionId:c.recipeVersionId,plannedOutput:c.plannedOutput,revision:1,status:'draft',businessDate:c.businessDate,operator:access.userId,notes:c.notes,method:await costingMethod(tx,org),issues:[],receipts:[],losses:[],processingCosts:[],issuedAmount:'0',returnedAmount:'0',processingAmount:'0',abnormalAmount:'0',wipAmount:'0',outputAmount:'0',expenseAmount:'0',createdAt:new Date().toISOString()};
   await tx.query('INSERT INTO central_batches(organization_id,batch_id,reference,location_id,revision,state) VALUES($1,$2,$3,$4,1,$5)',[org,c.batchId,b.reference,b.locationId,JSON.stringify(b)]);
  }else{check(stored,'الدفعة غير موجودة.');b=structuredClone(stored);check(b.status!=='closed'||c.type==='central.reverse','الدفعة مغلقة؛ استخدم عكس الإغلاق إذا لم تصرف المنتجات.','BATCH_CLOSED');b.revision++;}
  check(c.businessDate>=b.businessDate,'تاريخ العملية يسبق تاريخ الدفعة.');await assertInventoryDateOpen(tx,org,b.locationId,c.businessDate);
  check((await costingMethod(tx,org))===b.method,'تغيرت سياسة التكلفة؛ راجع الدفعة قبل الترحيل.');
  const ids=[c.operationId,...('lines'in c?c.lines.map(l=>l.lineId):[])];
  check(!(await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[org,ids])).rows.length,'أحد معرّفات السطور مستخدم.','PAYLOAD_CONFLICT');
  check((await reconcileStock(tx,org)).every(r=>r.matches),'الرصيد والدفتر والطبقات غير متطابقة.','RECONCILIATION_MISMATCH');
  await tx.query('INSERT INTO central_actions(organization_id,batch_id,operation_id,command,before_state,actor,amount,effects) VALUES($1,$2,$3,$4,$5,$6,0,$7)',[org,b.batchId,c.operationId,JSON.stringify(c),stored?JSON.stringify(stored):null,access.userId,'[]']);
  const effects:CentralEffect[]=[];let actionAmount=decimal('0');
  const item=async(itemId:string,unitId:string)=>check((await tx.query('SELECT id FROM items WHERE organization_id=$1 AND id=$2 AND unit_id=$3 AND active',[org,itemId,unitId])).rows.length,'الصنف أو وحدة مخزونه غير متاحة.','INVALID_REFERENCE');
  const link=async(operationId:string)=>tx.query('UPDATE stock_entries SET central_batch_id=$3,central_action_id=$4 WHERE organization_id=$1 AND operation_id=$2',[org,operationId,b.batchId,c.operationId]);
  const incoming=async(itemId:string,quantity:string,value:string,type:string,lot?:StockLot|LotMetadata,firstId?:string)=>{
   const parts=b.method==='fifo'?exactOutputLayers(quantity,value):[{quantity,unitCost:decimal(value).div(quantity).toFixed(6)}];
   for(const [i,p]of parts.entries()){
    const operationId=i===0&&firstId?firstId:randomUUID(),amount=b.method==='fifo'?money(decimal(p.quantity).mul(p.unitCost)):value;
    await addIncomingStock(tx,{organizationId:org,operationId,locationId:b.locationId,itemId,quantity:p.quantity,unitCost:p.unitCost,amount,type,reason:b.reference,businessDate:c.businessDate,lot});await link(operationId);
    effects.push({operationId,itemId,quantity:p.quantity,amount,lot:lot?{...lot,originId:'originId'in lot?lot.originId:operationId}:undefined});
   }
  };
  if(c.type==='central.issue'){
   for(const l of c.lines){
    await item(l.itemId,l.unitId);const plan=await planIssue(tx,org,b.locationId,l.itemId,l.quantity);
    await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,central_batch_id,central_action_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[org,l.lineId,b.locationId,l.itemId,decimal(l.quantity).neg().toString(),decimal(plan.amount).neg().toString(),'central.issue',b.reference,c.businessDate,b.batchId,c.operationId]);
    await applyIssue(tx,org,b.locationId,l.itemId,l.lineId,l.quantity,plan);
    const sources=[];for(const p of plan.allocations)sources.push({sourceId:p.layerId,quantity:p.quantity,amount:p.amount,returned:'0',returnedAmount:'0',lot:await sourceLot(tx,org,p.layerId)});
    b.issues.push({...l,operationId:c.operationId,amount:plan.amount,returned:'0',returnedAmount:'0',lost:'0',abnormalAmount:'0',sources});effects.push({operationId:l.lineId,itemId:l.itemId,quantity:decimal(l.quantity).neg().toString(),amount:decimal(plan.amount).neg().toString()});actionAmount=actionAmount.add(plan.amount);
   }
  }else if(c.type==='central.return'){
   for(const l of c.lines){
    const issue=b.issues.find(i=>i.lineId===l.issueLineId);check(issue,'سطر الصرف الأصلي غير متاح.');
    const sources=issue.sources.filter(s=>!l.sourceId||s.sourceId===l.sourceId);
    check(decimal(l.quantity).lte(remaining(issue))&&decimal(l.quantity).lte(sum(sources.map(s=>sourceRemaining(s).toString()))),'المرتجع يتجاوز المواد المتبقية من الصرف.','EXCESS_RETURN');
    let needed=decimal(l.quantity),first=true;
    for(const source of sources){const available=sourceRemaining(source),q=available.lt(needed)?available:needed;if(q.lte(0))continue;
     const value=q.eq(available)?sourceValue(source):sourceValue(source).mul(q).div(available).toDecimalPlaces(12,1);
     await incoming(issue.itemId,q.toString(),money(value),'central.return',source.lot??undefined,first?l.lineId:undefined);first=false;
     source.returned=decimal(source.returned).add(q).toString();source.returnedAmount=money(decimal(source.returnedAmount).add(value));issue.returned=decimal(issue.returned).add(q).toString();issue.returnedAmount=money(decimal(issue.returnedAmount).add(value));actionAmount=actionAmount.add(value);needed=needed.sub(q);
    }
   }
  }else if(c.type==='central.receive'){
   check(b.issues.length,'اصرف المواد إلى الدفعة أولًا.');
   for(const l of c.lines){await item(l.itemId,l.unitId);if(l.lot?.manufacturedOn)check(l.lot.manufacturedOn<=c.businessDate,'تاريخ تصنيع التشغيلة يتجاوز الاستلام.');if(l.lot?.manufacturedOn&&l.lot.expiresOn)check(l.lot.expiresOn>=l.lot.manufacturedOn,'الصلاحية تسبق التصنيع.');b.receipts.push({...l,operationId:c.operationId,recipient:c.recipient,businessDate:c.businessDate});}
   // Physical receipt is recorded in the holding ledger. Its value remains WIP;
   // it is never added at a zero price to the available moving-average pool.
  }else if(c.type==='central.loss'){
   for(const l of c.lines){
    const issue=b.issues.find(i=>i.lineId===l.issueLineId);check(issue,'سطر الصرف غير متاح.');const sources=issue.sources.filter(s=>!l.sourceId||s.sourceId===l.sourceId);
    check(decimal(l.quantity).lte(remaining(issue))&&sum(sources.map(s=>sourceRemaining(s).toString())).gte(l.quantity),'الفاقد يتجاوز المتبقي من المواد.','EXCESS_LOSS');
    let needed=decimal(l.quantity),value=decimal('0');
    for(const source of sources){const available=sourceRemaining(source),q=available.lt(needed)?available:needed;if(q.lte(0))continue;const part=q.eq(available)?sourceValue(source):sourceValue(source).mul(q).div(available).toDecimalPlaces(12,1);source.lost=decimal(source.lost??'0').add(q).toString();source.lostAmount=money(decimal(source.lostAmount??'0').add(part));value=value.add(part);needed=needed.sub(q);}
    issue.lost=decimal(issue.lost).add(l.quantity).toString();if(l.kind==='abnormal')issue.abnormalAmount=money(decimal(issue.abnormalAmount).add(value));b.losses.push({...l,amount:money(value)});actionAmount=actionAmount.add(value);
   }
  }else if(c.type==='central.cost'){
   b.processingCosts.push({operationId:c.operationId,amount:c.amount,reason:c.reason});actionAmount=decimal(c.amount);
  }else if(c.type==='central.close'){
   check(b.issues.length||b.processingCosts.length,'لا توجد مواد أو تكاليف لتسويتها.');
   const dates=(await tx.query<{date:string}>("SELECT MAX(command->>'businessDate') AS date FROM central_actions WHERE organization_id=$1 AND batch_id=$2",[org,b.batchId])).rows[0]?.date;check(!dates||c.businessDate>=dates,'تاريخ الإغلاق يسبق آخر عملية في الدفعة.');
   check(c.consumption.length===b.issues.length&&b.issues.every(i=>{const used=c.consumption.find(l=>l.issueLineId===i.lineId);return used&&decimal(used.quantity).eq(remaining(i));}),'كل صرف يجب أن يقابله استهلاك أو مرتجع أو فاقد؛ راجع تسوية المواد.','UNSETTLED_MATERIALS');
   const units=(await tx.query<{id:string;name:string}>('SELECT id,name FROM units WHERE organization_id=$1',[org])).rows;
   const mass=(unitId:string)=>{const name=units.find(u=>u.id===unitId)?.name.trim().toLowerCase().replace(/\s/g,'');return ['kg','كجم','كيلوجرام','كيلوغرام'].includes(name??'')?'1':['g','جم','جرام','غرام'].includes(name??'')?'0.001':null;};
   const used=b.issues.filter(i=>remaining(i).gt(0)),comparable=used.every(i=>mass(i.unitId))&&b.receipts.every(r=>mass(r.unitId)||r.weightKg);
   if(b.receipts.length&&comparable){const inputMass=sum(used.map(i=>remaining(i).mul(mass(i.unitId)!).toString())),outputMass=sum(b.receipts.map(r=>mass(r.unitId)?decimal(r.quantity).mul(mass(r.unitId)!).toString():r.weightKg!));check(inputMass.eq(outputMass),weightImbalanceMessage(inputMass,outputMass),'WEIGHT_IMBALANCE');}
   else if(b.receipts.length)check(c.balanceReason.length>=2,'الوحدات غير قابلة لجمع الوزن؛ اكتب تفسير موازنة الكميات.','BALANCE_REASON_REQUIRED');
   refresh(b);const cost=decimal(b.wipAmount),products=[...new Set(b.receipts.map(r=>r.itemId))];
   let allocations=c.allocations;
   if(products.length===1&&!allocations.length)allocations=[{itemId:products[0],share:'100'}];
   if(products.length)check(allocations.length===products.length&&allocations.every(a=>products.includes(a.itemId))&&sum(allocations.map(a=>a.share)).eq(100),'وزّع ١٠٠٪ من التكلفة على جميع المنتجات دون تكرار.','INVALID_COST_ALLOCATION');
   else{check(c.consumption.every(l=>decimal(l.quantity).isZero()),'لا يمكن إغلاق دفعة بلا ناتج وبها استهلاك غير مفسر؛ سجل الفاقد أو المرتجع.');check(!allocations.length,'لا يوجد ناتج لتوزيع التكلفة.');check(c.balanceReason.length>=2,'اكتب سبب إغلاق الدفعة بلا ناتج.');}
   let productLeft=cost;
   for(const [index,a]of allocations.entries()){
    const productCost=index===allocations.length-1?productLeft:cost.mul(a.share).div(100).toDecimalPlaces(12);productLeft=productLeft.sub(productCost);
    const receipts=b.receipts.filter(r=>r.itemId===a.itemId),quantity=sum(receipts.map(r=>r.quantity));let left=productCost;
    for(const [i,r]of receipts.entries()){const value=i===receipts.length-1?left:productCost.mul(r.quantity).div(quantity).toDecimalPlaces(12);left=left.sub(value);r.finalAmount=money(value);await incoming(r.itemId,r.quantity,money(value),'central.release',r.lot);}
   }
   b.status='closed';b.closedAt=new Date().toISOString();b.consumption=c.consumption;b.allocations=allocations;b.balanceReason=c.balanceReason;b.outputAmount=products.length?money(cost):'0.000000000000';b.expenseAmount=money(decimal(b.abnormalAmount).add(products.length?0:cost));b.wipAmount='0.000000000000';actionAmount=products.length?cost:decimal(b.expenseAmount);
  }else if(c.type==='central.reverse'){
   const target=(await tx.query<{operationId:string;command:CentralCommand;before:CentralBatch|null;effects:CentralEffect[]}>("SELECT operation_id::text AS \"operationId\",command,before_state AS before,effects FROM central_actions WHERE organization_id=$1 AND batch_id=$2 AND operation_id<>$3 AND reversed_by IS NULL AND command->>'type'<>'central.reverse' ORDER BY sequence DESC LIMIT 1",[org,b.batchId,c.operationId])).rows[0];
   check(target?.operationId===c.targetOperationId&&target.before,'يمكن عكس آخر عملية فعّالة فقط؛ لا يمكن عكس إنشاء الدفعة.','REVERSAL_ORDER');
   for(const e of target.effects.filter(e=>decimal(e.quantity).gt(0))){
    const row=(await tx.query<{sequence:string;remaining:string}>('SELECT s.sequence::text,l.remaining::text FROM stock_entries s JOIN cost_layers l ON l.organization_id=s.organization_id AND l.sequence=s.sequence WHERE s.organization_id=$1 AND s.operation_id=$2',[org,e.operationId])).rows[0];
    check(row&&decimal(row.remaining).eq(e.quantity),'تم التصرف في هذا المخزون؛ لا يمكن عكسه مباشرة.','REVERSAL_STOCK_USED');
    check(!(await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND sequence>$4 AND (quantity<0 OR amount<0)',[org,b.locationId,e.itemId,row.sequence])).rows.length,'حدث صرف أو تعديل تكلفة لاحق؛ يلزم مراجعة التصرفات المرتبطة أولًا.','REVERSAL_STOCK_USED');
   }
   for(const e of target.effects){
    if(decimal(e.quantity).lt(0)){
     const issue=b.issues.find(i=>i.lineId===e.operationId);check(issue,'تعذر تحديد مصادر الصرف للعكس.');for(const s of issue.sources)await incoming(issue.itemId,s.quantity,s.amount,'central.reverse',s.lot??undefined);
    }else{
     const id=randomUUID();await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,central_batch_id,central_action_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[org,id,b.locationId,e.itemId,decimal(e.quantity).neg().toString(),decimal(e.amount).neg().toString(),'central.reverse',b.reference+' · '+c.reason,c.businessDate,b.batchId,c.operationId]);
     await tx.query('UPDATE cost_layers SET remaining=0,remaining_value=0 WHERE organization_id=$1 AND sequence=(SELECT sequence FROM stock_entries WHERE organization_id=$1 AND operation_id=$2)',[org,e.operationId]);
     await tx.query('UPDATE stock_balances SET quantity=quantity-$4::numeric,value=value-$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,b.locationId,e.itemId,e.quantity,e.amount]);await rebalanceAverage(tx,org,b.locationId,e.itemId);effects.push({operationId:id,itemId:e.itemId,quantity:decimal(e.quantity).neg().toString(),amount:decimal(e.amount).neg().toString()});
    }
   }
   const revision=b.revision;b=structuredClone(target.before);b.revision=revision;
   await tx.query('UPDATE central_actions SET reversed_by=$3 WHERE organization_id=$1 AND operation_id=$2',[org,target.operationId,c.operationId]);
  }
  refresh(b);check(decimal(b.wipAmount).lt('1000000000000000000'),'قيمة الدفعة تتجاوز الحد المسموح.','COST_TOO_LARGE');
  await tx.query('UPDATE central_batches SET revision=$3,state=$4 WHERE organization_id=$1 AND batch_id=$2',[org,b.batchId,b.revision,JSON.stringify(b)]);
  await tx.query('UPDATE central_actions SET amount=$3,effects=$4 WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId,money(actionAmount),JSON.stringify(effects)]);
  check((await reconcileStock(tx,org)).every(r=>r.matches),'تعذرت مطابقة الكميات والقيم؛ لم تُرحّل العملية.','RECONCILIATION_MISMATCH');
  for(const id of new Set([...ids.slice(1),...effects.map(e=>e.operationId)]))await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,id,createHash('sha256').update('central:'+c.operationId+':'+id).digest('hex'),JSON.stringify({operationId:id,outcome:'accepted'})]);
  const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount:money(actionAmount)};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(result)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);return result;
 });
}
