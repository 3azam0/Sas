import {assignReference} from './references';
import {randomUUID} from 'node:crypto';
import {BusinessError,type Access,type Item} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {productionCommandSchema,type ProductionCommand,type ProductionBatch} from '../contracts/production';
import {type Tx,stockMove,valueNode,nodeValue,addPool,takePool,poolHead,adjustNode} from './valuation';

function check(v:unknown,message:string):asserts v{if(!v)throw new BusinessError('INVALID_COMMAND',message);}
export function isProductionCommand(c:{type:string}):c is ProductionCommand{return c.type.startsWith('production.')||c.type==='catalog.create'||c.type==='inventory.count';}
const units:Record<string,{dimension:string;factor:string}>={'كجم':{dimension:'mass',factor:'1'},'جم':{dimension:'mass',factor:'0.001'},'لتر':{dimension:'volume',factor:'1'},'مل':{dimension:'volume',factor:'0.001'},'قطعة':{dimension:'piece',factor:'1'}};
export function convertUnit(quantity:string,from:string,to:string){check(units[from]&&units[to]&&units[from].dimension===units[to].dimension,'الوحدات غير متوافقة؛ لا يمكن تحويل الوزن إلى حجم أو قطع');const q=decimal(quantity).mul(units[from].factor).div(units[to].factor);check(q.decimalPlaces()<=6&&q.gt(0),'الكمية بعد التحويل أدق من ست منازل أو غير موجبة');return q.toFixed(6);}
export async function productionSnapshot(tx:Tx,org:string){
 const batches=await tx.query<{data:ProductionBatch}>('SELECT data FROM production_batches WHERE organization_id=$1 ORDER BY data->>\'businessDate\' DESC,id',[org]);
 for(const b of batches.rows)b.data.wipValue=(await poolHead(tx,org,'wip',b.data.id))?.value||'0.000000000000';
 const adjustments=await tx.query<{operationId:string;kind:string;owner:string;amount:string}>('SELECT operation_id AS "operationId",kind,owner,amount::text FROM cost_adjustments WHERE organization_id=$1 ORDER BY id',[org]);
 return {productionBatches:batches.rows.map(b=>b.data),costAdjustments:adjustments.rows};
}
export async function postProduction(tx:Tx,access:Access,input:ProductionCommand,details:Record<string,unknown>){
 const c=productionCommandSchema.parse(input),org=access.organizationId;
 const item=async(id:string)=>{const r=await tx.query<Item>('SELECT id,name,unit,role,meat_kind AS "meatKind" FROM items WHERE organization_id=$1 AND id=$2',[org,id]);check(r.rows[0],'الصنف غير متاح لهذه المؤسسة');return r.rows[0];};
 const leg=(type:string)=>({...c,type,operationId:randomUUID(),reason:`${c.reason||String(details.reference||'')} · ${c.operationId}`});
 if(c.type==='inventory.count'){
  await item(c.itemId);const loc=await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2',[org,c.locationId]);check(loc.rows.length,'الموقع غير متاح');
  const current=await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[org,c.locationId,c.itemId]);const old=current.rows[0]||{quantity:'0',value:'0'};
  const revision=await tx.query<{revision:string}>('SELECT COALESCE(max(sequence),0)::text AS revision FROM stock_entries WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,c.locationId,c.itemId]);check(revision.rows[0].revision===c.expectedRevision,'حدثت حركة بعد تنزيل الرصيد؛ زامن وأعد مراجعة الجرد');
  check(decimal(old.quantity).eq(c.expectedQuantity)&&decimal(old.value).eq(c.expectedValue),'تغير الرصيد منذ آخر مزامنة؛ حدّث البيانات وأعد مراجعة الجرد');
  const difference=decimal(c.quantity).sub(old.quantity);details.theoretical=old.quantity;details.actual=c.quantity;details.variance=difference.toFixed(6);
  if(difference.isZero())return '0.000000000000';const value=difference.gt(0)?difference.mul(decimal(old.quantity).gt(0)?decimal(old.value).div(old.quantity):decimal(c.unitCost)).toFixed(12):undefined;
  const posted=await stockMove(tx,org,leg(c.type),c.locationId,c.itemId,difference.toFixed(6),value);return posted.amount;
 }
 if(c.type==='catalog.create'){
  const exists=await tx.query('SELECT 1 FROM items WHERE organization_id=$1 AND lower(trim(name))=lower(trim($2))',[org,c.name]);check(!exists.rows.length,'يوجد صنف بهذا الاسم');
  await tx.query('INSERT INTO items(organization_id,id,name,sku,category,unit,minimum,role) VALUES($1,$2,$3,$4,$5,$6,0,$7)',[org,c.itemId,c.name,await assignReference(tx,org,'item',c.itemId,'MAT'),'المطبخ المركزي',c.unit,c.role]);return '0.000000000000';
 }
 const found=await tx.query<{data:ProductionBatch}>('SELECT data FROM production_batches WHERE organization_id=$1 AND id=$2 FOR UPDATE',[org,c.batchId]);let b=found.rows[0]?.data;
 if(c.type==='production.create'){
  check(!b,'رقم الدفعة مستخدم بالفعل');check(new Set(c.outputs.map(o=>o.itemId)).size===c.outputs.length,'لا تكرر صنف المخرج');
  check(c.outputs.reduce((n,o)=>n.add(o.costShare),decimal('0')).eq(100),'مجموع نسب تكلفة المخرجات يجب أن يساوي 100%');
  for(const o of c.outputs)await item(o.itemId);
  const reference=await assignReference(tx,org,'batch',c.batchId,'PROD');
  b={id:c.batchId,reference,name:c.name||reference,operationType:c.operationType,status:'draft',warehouseId:'central',businessDate:c.businessDate,operator:access.userId,recipient:c.recipient,notes:c.reason,balanceMode:c.balanceMode,outputs:c.outputs,issues:[],receipts:[],returns:[],losses:[],processingCost:'0',costOperations:[]};
  await tx.query('INSERT INTO production_batches VALUES($1,$2,$3)',[org,c.batchId,JSON.stringify(b)]);return '0.000000000000';
 }
 check(b,'الدفعة غير متاحة؛ زامن إنشاء الدفعة أولاً');
 check(b.status!=='closed'&&b.status!=='cancelled','الدفعة مغلقة أو ملغاة؛ لا يمكن تعديلها');
 let amount='0.000000000000';
 if(c.type==='production.issue'){
  check(b.issues.length+c.lines.length<=500,'الدفعة وصلت حد 500 بند إصدار؛ أغلقها وافتح دفعة جديدة');
  check(new Set(c.lines.map(l=>l.itemId)).size===c.lines.length,'لا تكرر نفس المادة داخل الإصدار الواحد');
  for(const l of c.lines){check(!b.outputs.some(o=>o.itemId===l.itemId),'استخدم صنفاً مختلفاً للمدخل والمخرج لتجنب دورة إنتاج');const material=await item(l.itemId),quantity=convertUnit(l.quantity,l.unit,material.unit);const p=leg(c.type);
   const posted=await stockMove(tx,org,p,b.warehouseId,l.itemId,decimal(quantity).neg().toFixed(6));await addPool(tx,org,'wip',b.id,posted.node);
   b.issues.push({id:p.operationId,operationId:c.operationId,itemId:l.itemId,quantity,amount:posted.amount,returned:'0',node:posted.node,recipient:c.recipient,operator:access.userId});amount=decimal(amount).add(posted.amount).toFixed(12);
  }b.status=b.receipts.some(r=>!r.reversed)?'partially_received':'in_progress';
 }else if(c.type==='production.return'){
  const issue=b.issues.find(i=>i.id===c.issueId);check(issue,'مرجع إصدار المادة غير متاح');const lost=(b.losses||[]).filter(l=>l.issueId===issue.id).reduce((n,l)=>n.add(l.quantity),decimal('0'));check(decimal(issue.returned).add(c.quantity).add(lost).lte(issue.quantity),'المرتجع يتجاوز كمية المادة الصادرة بعد الفاقد');
  amount=decimal(issue.returned).add(c.quantity).eq(issue.quantity)?decimal(issue.amount).sub(b.returns.filter(r=>r.issueId===issue.id&&!r.reversed).reduce((n,r)=>n.add(r.amount),decimal('0'))).toFixed(12):decimal(issue.amount).mul(c.quantity).div(issue.quantity).toFixed(12);const source=await takePool(tx,org,'wip',b.id,amount);
  const p=leg(c.type);await stockMove(tx,org,p,b.warehouseId,issue.itemId,c.quantity,amount,source);issue.returned=decimal(issue.returned).add(c.quantity).toFixed(6);b.returns.push({operationId:c.operationId,issueId:issue.id,quantity:c.quantity,amount});
 }else if(c.type==='production.loss'){
  const issue=b.issues.find(i=>i.id===c.issueId);check(issue,'إصدار المادة غير متاح');const prior=(b.losses||[]).filter(l=>l.issueId===issue.id).reduce((n,l)=>n.add(l.quantity),decimal('0'));check(decimal(issue.returned).add(prior).add(c.quantity).lte(issue.quantity),'الفاقد يتجاوز الكمية الصادرة بعد المرتجع');(b.losses??=[]).push({operationId:c.operationId,issueId:issue.id,quantity:c.quantity,reason:c.reason});
 }else if(c.type==='production.receive'){
  check(b.issues.length,'أصدر المواد أولاً');check(b.outputs.some(o=>o.itemId===c.itemId),'الصنف ليس ضمن مخرجات الدفعة');
  amount=decimal(c.provisionalValue).toFixed(12);const source=await takePool(tx,org,'wip',b.id,amount);const p=leg(c.type);
  await stockMove(tx,org,p,b.warehouseId,c.itemId,c.quantity,amount,source);b.receipts.push({id:p.operationId,operationId:c.operationId,itemId:c.itemId,quantity:c.quantity,amount,node:source});b.status='partially_received';
 }else if(c.type==='production.cost'){
  amount=decimal(c.amount).toFixed(12);await addPool(tx,org,'wip',b.id,await valueNode(tx,org,amount));b.processingCost=decimal(b.processingCost).add(amount).toFixed(12);b.costOperations.push({operationId:c.operationId,amount});
 }else if(c.type==='production.cancel'){
  check(!(b.losses||[]).length,'لا يمكن إلغاء دفعة بها فاقد مسجل؛ أكمل التسوية');check(b.issues.every(i=>decimal(i.returned).eq(i.quantity))&&!b.receipts.some(r=>!r.reversed)&&decimal(b.processingCost).isZero(),'أعد جميع المواد واعكس الاستلام والتكلفة قبل الإلغاء');check(decimal((await poolHead(tx,org,'wip',b.id))?.value||'0').isZero(),'توجد قيمة غير مسواة في الدفعة');b.status='cancelled';
 }else if(c.type==='production.reverse'){
  const cost=b.costOperations.find(x=>x.operationId===c.targetOperationId&&!x.reversed);
  if(cost){await takePool(tx,org,'wip',b.id,cost.amount);cost.reversed=true;b.processingCost=decimal(b.processingCost).sub(cost.amount).toFixed(12);details.reverses=c.targetOperationId;await tx.query('UPDATE production_batches SET data=$3 WHERE organization_id=$1 AND id=$2',[org,b.id,JSON.stringify(b)]);return cost.amount;}
  const receipt=b.receipts.find(r=>r.operationId===c.targetOperationId&&!r.reversed);
  check(receipt,'يمكن عكس استلام منتج مفتوح لم يستخدم بعد؛ التصحيحات الأخرى تسجل بمرتجع مرتبط');
  const stock=await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,b.warehouseId,receipt.itemId]);
  const last=await tx.query<{operation_id:string}>('SELECT operation_id::text FROM stock_entries WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 ORDER BY sequence DESC LIMIT 1',[org,b.warehouseId,receipt.itemId]);
  check(last.rows[0]?.operation_id===receipt.id&&decimal(stock.rows[0]?.quantity||'0').eq(receipt.quantity)&&decimal(stock.rows[0]?.value||'0').eq(await nodeValue(tx,org,receipt.node)),'المنتج اختلط برصيد آخر أو له حركات تابعة؛ يلزم تسوية مرتبطة بدلاً من عكس الاستلام');
  const posted=await stockMove(tx,org,leg(c.type),b.warehouseId,receipt.itemId,decimal(receipt.quantity).neg().toFixed(6));await addPool(tx,org,'wip',b.id,posted.node);receipt.reversed=true;amount=posted.amount;b.status=b.receipts.some(r=>!r.reversed)?'partially_received':'in_progress';details.reverses=c.targetOperationId;
 }else if(c.type==='production.close'){
  check(c.usages.length===b.issues.length&&new Set(c.usages.map(u=>u.issueId)).size===b.issues.length,'اشرح استهلاك وفاقد كل إصدار مرة واحدة');
  let usableMass=decimal('0');
  for(const issue of b.issues){const u=c.usages.find(u=>u.issueId===issue.id);check(u,'إصدار بلا تسوية');check(decimal(u.consumed).add(u.loss).add(issue.returned).eq(issue.quantity),'المستهلك + المرتجع + الفاقد يجب أن يساوي الكمية الصادرة لكل مادة');const recordedLoss=(b.losses||[]).filter(l=>l.issueId===issue.id).reduce((n,l)=>n.add(l.quantity),decimal('0'));check(decimal(u.loss).gte(recordedLoss),'الفاقد في التسوية أقل من الفاقد المسجل');check(decimal(u.loss).isZero()||u.lossReason.length>=2,'سبب الفاقد مطلوب');const material=await item(issue.itemId);
   if(b.balanceMode==='mass'){check(units[material.unit]?.dimension==='mass','ميزان الوزن يتطلب وحدات وزن لكل المدخلات؛ استخدم تسوية موثقة للوحدات المختلطة');usableMass=usableMass.add(decimal(u.consumed).mul(units[material.unit].factor));}
  }
  const receipts=b.receipts.filter(r=>!r.reversed);check(receipts.length,'استلم المنتجات قبل الإغلاق');
  if(b.operationType==='butchery'){
   check(c.butchery&&b.balanceMode==='mass','أدخل بيانات الذبح والتقطيع واستخدم ميزان الوزن للجزارة');const m=c.butchery;
   let gross=decimal('0'),loss=decimal('0');
   for(const i of b.issues){const material=await item(i.itemId);check(material.unit==='كجم'&&material.meatKind===(m.mode==='beef'?'beef_input':'sheep_live'),'مدخل الجزارة يجب أن يطابق النوع وبالكيلوجرام');gross=gross.add(decimal(i.quantity).sub(i.returned));loss=loss.add(c.usages.find(u=>u.issueId===i.id)!.loss);}
   check(loss.eq(decimal(m.slaughterLoss).add(m.cuttingLoss)),'فاقد الذبح والتقطيع لا يساوي فاقد المواد');
   if(m.mode==='lamb'){check(m.headCount&&m.carcassWeight,'عدد الرؤوس ووزن الذبيحة مطلوبان');check(decimal(m.carcassWeight).add(m.slaughterLoss).eq(gross),'الذبيحة وفاقد الذبح لا يساويان الوزن الحي المستخدم');check(usableMass.add(m.cuttingLoss).eq(m.carcassWeight),'المخرجات وفاقد التقطيع لا يساويان وزن الذبيحة');}
   else check(decimal(m.slaughterLoss).isZero()&&!m.headCount&&!m.carcassWeight&&usableMass.add(m.cuttingLoss).eq(gross),'راجع وزن التقطيع؛ البقري المشترى لا يسجل كذبح');
   for(const r of receipts){const product=await item(r.itemId);check(product.unit==='كجم'&&product.meatKind===(m.mode==='beef'?'beef_product':'lamb_product'),'مخرج الجزارة لا يطابق نوع الدفعة');}
   details.butchery=m;
  }
  if(b.balanceMode==='documented')check(c.reconciliationNote.length>=5,'اشرح تسوية الوحدات المختلطة أو تغير الوزن');
  if(b.balanceMode==='mass'){let outputMass=decimal('0');for(const r of receipts){const product=await item(r.itemId);check(units[product.unit]?.dimension==='mass','المخرج ليس بوحدة وزن');outputMass=outputMass.add(decimal(r.quantity).mul(units[product.unit].factor));}check(usableMass.eq(outputMass),'وزن المواد المستهلكة لا يساوي وزن المنتجات المستلمة؛ أدرج كل المكونات والمياه والفاقد');}
  for(const o of b.outputs)check(receipts.some(r=>r.itemId===o.itemId),'يجب استلام كل صنف مخرج قبل الإغلاق');
  const wip=(await poolHead(tx,org,'wip',b.id))?.value||'0';let final=decimal(wip);const values=new Map<string,string>();for(const r of receipts){const v=await nodeValue(tx,org,r.node);values.set(r.id,v);final=final.add(v);}
  let allocated=decimal('0');const last=b.outputs.reduce((n,o,i)=>decimal(o.costShare).gt(0)?i:n,-1);
  const allocations=[];
  for(let i=0;i<b.outputs.length;i++){
   const o=b.outputs[i],target=i===last?final.sub(allocated):final.mul(o.costShare).div(100).toDecimalPlaces(12,1);allocated=allocated.add(target);
   const lines=receipts.filter(r=>r.itemId===o.itemId),quantity=lines.reduce((n,r)=>n.add(r.quantity),decimal('0'));let assigned=decimal('0');
   for(let j=0;j<lines.length;j++){const r=lines[j],desired=j===lines.length-1?target.sub(assigned):target.mul(r.quantity).div(quantity).toDecimalPlaces(12,1);assigned=assigned.add(desired);r.finalValue=desired.toFixed(12);const delta=desired.sub(values.get(r.id)!);if(!delta.isZero())await adjustNode(tx,org,r.node,delta.toFixed(12),c);allocations.push({receiptId:r.id,itemId:r.itemId,quantity:r.quantity,finalValue:desired.toFixed(12),adjustment:delta.toFixed(12)});}
  }
  // Clear the remaining WIP after linked receipt corrections. This is settlement,
  // not another material deduction or a separate waste charge.
  const remaining=(await poolHead(tx,org,'wip',b.id))?.value||'0';await takePool(tx,org,'wip',b.id,remaining,'1');
  b.status='closed';b.usages=c.usages;b.reconciliationNote=c.reconciliationNote;b.finalCost=final.toFixed(12);b.closedAt=new Date().toISOString();details.allocations=allocations;amount=b.finalCost;
 }
 details.batchId=b.id;details.operator=access.userId;details.wipValue=(await poolHead(tx,org,'wip',b.id))?.value||'0';
 await tx.query('UPDATE production_batches SET data=$3 WHERE organization_id=$1 AND id=$2',[org,b.id,JSON.stringify(b)]);return amount;
}
