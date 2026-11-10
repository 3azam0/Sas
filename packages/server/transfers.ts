import {assertInventoryWrite,assertInventoryManager,assertInventoryDateOpen} from './inventory-permissions';
import {assertGeneration,planIssue,applyIssue} from './valuation';
import type {Database,QueryDatabase} from './database';
import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,transferCommandSchema,transferRevisionSchema,type Access,type Transfer,type TransferDispatch,type TransferAction,type TransferCommand,type CommandResult,type TransferEdit} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {addIncomingStock} from './incoming';
import {sourceLot} from './stock-lots';
import {reverseTransferLines} from './transfer-edit-stock';
import {reconcileStock} from './counts';

export const transferTables=`
CREATE TABLE IF NOT EXISTS transfers(organization_id text NOT NULL REFERENCES organizations(id),transfer_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),source_id text NOT NULL,destination_id text NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL CHECK(amount>=0),posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,transfer_id),CHECK(source_id<>destination_id),FOREIGN KEY(organization_id,source_id) REFERENCES locations(organization_id,id),FOREIGN KEY(organization_id,destination_id) REFERENCES locations(organization_id,id));
CREATE INDEX IF NOT EXISTS transfer_source_lookup ON transfers(organization_id,source_id);
CREATE INDEX IF NOT EXISTS transfer_destination_lookup ON transfers(organization_id,destination_id);
CREATE TABLE IF NOT EXISTS transfer_segments(organization_id text NOT NULL,transfer_id uuid NOT NULL,dispatch_line_id uuid NOT NULL,layer_id uuid NOT NULL,ordinal integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),received numeric(18,6) NOT NULL DEFAULT 0 CHECK(received>=0),lost numeric(18,6) NOT NULL DEFAULT 0 CHECK(lost>=0),unit_cost numeric(18,6) NOT NULL CHECK(unit_cost>=0),PRIMARY KEY(organization_id,dispatch_line_id,layer_id),CHECK(received+lost<=quantity),FOREIGN KEY(organization_id,transfer_id) REFERENCES transfers(organization_id,transfer_id),FOREIGN KEY(organization_id,dispatch_line_id) REFERENCES stock_entries(organization_id,operation_id),FOREIGN KEY(organization_id,layer_id) REFERENCES cost_layers(organization_id,id));
ALTER TABLE transfer_segments ADD COLUMN IF NOT EXISTS initial_value numeric(30,12);
ALTER TABLE transfer_segments ADD COLUMN IF NOT EXISTS remaining_value numeric(30,12) CHECK(remaining_value>=0);
CREATE INDEX IF NOT EXISTS transfer_segment_document_lookup ON transfer_segments(organization_id,transfer_id);
CREATE INDEX IF NOT EXISTS transfer_segment_layer_lookup ON transfer_segments(organization_id,layer_id);
CREATE TABLE IF NOT EXISTS transfer_actions(organization_id text NOT NULL,operation_id uuid NOT NULL,transfer_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL CHECK(amount>=0),posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,transfer_id) REFERENCES transfers(organization_id,transfer_id));
CREATE INDEX IF NOT EXISTS transfer_action_document_lookup ON transfer_actions(organization_id,transfer_id);
CREATE TABLE IF NOT EXISTS transfer_allocations(organization_id text NOT NULL,operation_id uuid NOT NULL,action_id uuid NOT NULL,dispatch_line_id uuid NOT NULL,layer_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),amount numeric(30,12) NOT NULL CHECK(amount>=0),PRIMARY KEY(organization_id,operation_id,layer_id),FOREIGN KEY(organization_id,action_id) REFERENCES transfer_actions(organization_id,operation_id),FOREIGN KEY(organization_id,dispatch_line_id,layer_id) REFERENCES transfer_segments(organization_id,dispatch_line_id,layer_id));
CREATE INDEX IF NOT EXISTS transfer_allocation_action_lookup ON transfer_allocations(organization_id,action_id);
CREATE INDEX IF NOT EXISTS transfer_allocation_segment_lookup ON transfer_allocations(organization_id,dispatch_line_id,layer_id);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS transfer_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS transfer_line_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_transfer_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_transfer_scope FOREIGN KEY(organization_id,transfer_id) REFERENCES transfers(organization_id,transfer_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_transfer_lookup ON stock_entries(organization_id,transfer_id);
`;

export async function transferSnapshot(tx:Pick<Database,'query'>,org:string){
 const docs=await tx.query<{transferId:string;revision:number;document:TransferDispatch;amount:string;postedAt:string}>('SELECT transfer_id AS "transferId",revision,payload AS document,amount::text,posted_at::text AS "postedAt" FROM transfers WHERE organization_id=$1 ORDER BY posted_at',[org]);
 const totals=await tx.query<{transfer_id:string;dispatch_line_id:string;received:string;lost:string;remaining:string;amount:string;remainingValue:string}>('SELECT transfer_id,dispatch_line_id,sum(received)::text AS received,sum(lost)::text AS lost,sum(quantity-received-lost)::text AS remaining,sum(COALESCE(initial_value,quantity*unit_cost))::text AS amount,sum(COALESCE(remaining_value,(quantity-received-lost)*unit_cost))::text AS "remainingValue" FROM transfer_segments WHERE organization_id=$1 GROUP BY transfer_id,dispatch_line_id',[org]);
 const transfers:Transfer[]=docs.rows.map(d=>{const lines=d.document.lines.map(l=>{const t=totals.rows.find(r=>r.transfer_id===d.transferId&&r.dispatch_line_id===l.movementId)!;return {dispatchLineId:l.movementId,itemId:l.itemId,unitId:l.unitId,quantity:l.quantity,received:t.received,lost:t.lost,remaining:t.remaining,amount:t.amount,remainingValue:t.remainingValue};});const outstanding=lines.some(l=>decimal(l.remaining).gt(0)),loss=lines.some(l=>decimal(l.lost).gt(0)),received=lines.some(l=>decimal(l.received).gt(0));return {...d,lines,state:!lines.length?'voided':outstanding?(received||loss?'partial':'inTransit'):loss?'resolvedWithLoss':'completed'};});
 const actions=await tx.query<TransferAction>(`SELECT a.payload AS document,a.amount::text,a.posted_at::text AS "postedAt" FROM transfer_actions a
  WHERE a.organization_id=$1 AND NOT EXISTS(SELECT 1 FROM transfer_edits e WHERE e.organization_id=a.organization_id AND e.transfer_id=a.transfer_id AND e.replay_ids ? a.operation_id::text) ORDER BY a.posted_at`,[org]);
 const edits=await tx.query<TransferEdit>(`SELECT transfer_id::text AS "transferId",operation_id::text AS "operationId",revision,reason,posted_at::text AS "postedAt",previous_document AS previous,updated_document AS updated
  FROM transfer_edits WHERE organization_id=$1 ORDER BY revision DESC`,[org]);
 return {transfers,transferActions:actions.rows,transferEdits:edits.rows};
}

async function dispatchLines(tx:QueryDatabase,document:TransferDispatch){
 const {organizationId:org,sourceId,transferId,businessDate,reason}=document;
 let total=decimal('0');
 for(const line of document.lines){
  const item=(await tx.query('SELECT 1 FROM items WHERE organization_id=$1 AND id=$2 AND unit_id=$3 AND active',[org,line.itemId,line.unitId])).rows[0];
  if(!item)throw new BusinessError('INVALID_REFERENCE','المادة أو وحدة المخزون غير متاحة.');
  const allocation=await planIssue(tx,org,sourceId,line.itemId,line.quantity);
  await tx.query(`INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,transfer_id,transfer_line_id)
   VALUES($1,$2,$3,$4,$5,$6,'transfer.dispatch',$7,$8,$9,$2)`,[org,line.movementId,sourceId,line.itemId,decimal(line.quantity).neg().toString(),decimal(allocation.amount).neg().toString(),reason,businessDate,transferId]);
  for(const [ordinal,part] of allocation.allocations.entries()){
   const cost=decimal(part.amount).div(part.quantity).toFixed(6);
   await tx.query(`INSERT INTO transfer_segments(organization_id,transfer_id,dispatch_line_id,layer_id,ordinal,quantity,unit_cost,initial_value,remaining_value)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)`,[org,transferId,line.movementId,part.layerId,ordinal,part.quantity,cost,part.amount]);
  }
  await applyIssue(tx,org,sourceId,line.itemId,line.movementId,line.quantity,allocation);
  total=total.add(allocation.amount);
 }
 return total;
}

export async function postTransfer(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 assertInventoryWrite(access);
 if(typeof input==='object'&&input!==null&&'type' in input&&(input.type==='transfer.edit'||input.type==='transfer.void'))return postTransferRevision(db,access,input);
 const parsed=transferCommandSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_COMMAND','تحقق من مستند التحويل.',400);const c=parsed.data;
 if(c.organizationId!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','ليس لديك صلاحية لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[c.organizationId]);
 await assertGeneration(tx,c.organizationId,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows[0];
  if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior.result;}
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(c.businessDate>today)throw new BusinessError('FUTURE_DATE','تاريخ التحويل لا يمكن أن يكون في المستقبل.');
  const existing=(await tx.query<{revision:number;payload:TransferDispatch}>('SELECT revision,payload FROM transfers WHERE organization_id=$1 AND transfer_id=$2 FOR UPDATE',[c.organizationId,c.transferId])).rows[0];
  if((existing?.revision??0)!==c.expectedRevision)throw new BusinessError('STALE_REVISION','تغير التحويل. زامن وراجع الإصدار.');
  if(existing&&!existing.payload.lines.length)throw new BusinessError('TRANSFER_VOIDED','مستند التحويل ملغى.');
  if(c.type!=='transfer.dispatch'&&!existing)throw new BusinessError('INVALID_REFERENCE','الإرسال غير مقبول أو غير متاح.');
  const ids=[c.operationId,...c.lines.map(l=>l.movementId)];
  if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[c.organizationId,ids])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف مستند أو سطر مستخدم بالفعل.');
  let total=decimal('0');
  if(c.type==='transfer.dispatch'){
   if(existing)throw new BusinessError('ORDER_LOCKED','الإرسال مقبول بالفعل.');
   const locations=(await tx.query<{id:string}>('SELECT id FROM locations WHERE organization_id=$1 AND id=ANY($2::text[]) AND active',[c.organizationId,[c.sourceId,c.destinationId]])).rows;if(locations.length!==2)throw new BusinessError('INVALID_REFERENCE','اختر مصدر ووجهة نشطين داخل المؤسسة.');
   await tx.query('INSERT INTO transfers(organization_id,transfer_id,revision,source_id,destination_id,payload,amount) VALUES($1,$2,1,$3,$4,$5,0)',[c.organizationId,c.transferId,c.sourceId,c.destinationId,JSON.stringify(c)]);
   total=await dispatchLines(tx,c);
   await tx.query('UPDATE transfers SET amount=$3 WHERE organization_id=$1 AND transfer_id=$2',[c.organizationId,c.transferId,total.toFixed(12)]);
  }else{
   const d=existing!.payload;if(c.type==='transfer.loss')await assertInventoryDateOpen(tx,c.organizationId,d.sourceId,c.businessDate);
   // Receiving remains possible when catalog records are deactivated after dispatch.
   const prepared=[];
   for(const line of c.lines){
    const definition=d.lines.find(l=>l.movementId===line.dispatchLineId);if(!definition)throw new BusinessError('INVALID_REFERENCE','سطر الإرسال لا يخص هذا التحويل.');
    const segments=(await tx.query<{layer_id:string;remaining:string;unit_cost:string;remaining_value:string;ordinal:number}>('SELECT layer_id,(quantity-received-lost)::text AS remaining,unit_cost::text,COALESCE(remaining_value,(quantity-received-lost)*unit_cost)::text AS remaining_value,ordinal FROM transfer_segments WHERE organization_id=$1 AND transfer_id=$2 AND dispatch_line_id=$3 ORDER BY ordinal FOR UPDATE',[c.organizationId,c.transferId,line.dispatchLineId])).rows;
    let needed=decimal(line.quantity),amount=decimal('0');const parts=[];
    for(const s of segments){if(needed.lte(0))break;const q=decimal(s.remaining).lt(needed)?decimal(s.remaining):needed;if(q.lte(0))continue;const value=q.eq(s.remaining)?decimal(s.remaining_value):decimal(s.remaining_value).mul(q).div(s.remaining).toDecimalPlaces(12);parts.push({...s,quantity:q.toString(),amount:value.toFixed(12)});amount=amount.add(value);needed=needed.sub(q);}
    if(needed.gt(0))throw new BusinessError('EXCESS_TRANSFER','الكمية تتجاوز المتبقي في الطريق بعد الاستلام والفقد السابق.');
    total=total.add(amount);prepared.push({line,definition,parts,amount:amount.toFixed(12)});
   }
   await tx.query('INSERT INTO transfer_actions(organization_id,operation_id,transfer_id,payload,amount) VALUES($1,$2,$3,$4,$5)',[c.organizationId,c.operationId,c.transferId,JSON.stringify(c),total.toFixed(12)]);
   for(const {line,definition,parts,amount} of prepared){
    for(const [index,p] of parts.entries()){
     await tx.query(`UPDATE transfer_segments SET ${c.type==='transfer.receive'?'received':'lost'}=${c.type==='transfer.receive'?'received':'lost'}+$4::numeric,remaining_value=COALESCE(remaining_value,(quantity-received-lost)*unit_cost)-$5::numeric WHERE organization_id=$1 AND dispatch_line_id=$2 AND layer_id=$3`,[c.organizationId,line.dispatchLineId,p.layer_id,p.quantity,p.amount]);
     await tx.query('INSERT INTO transfer_allocations VALUES($1,$2,$3,$4,$5,$6,$7)',[c.organizationId,line.movementId,c.operationId,line.dispatchLineId,p.layer_id,p.quantity,p.amount]);
     if(c.type==='transfer.receive'){
      // Separate incoming ledger sequences preserve the original FIFO segment order.
      const movementId=index===0?line.movementId:randomUUID();
      await addIncomingStock(tx,{organizationId:c.organizationId,operationId:movementId,locationId:d.destinationId,itemId:definition.itemId,quantity:p.quantity,unitCost:p.unit_cost,amount:p.amount,type:c.type,reason:c.reason,businessDate:c.businessDate,lot:await sourceLot(tx,c.organizationId,p.layer_id)});
      await tx.query('UPDATE stock_entries SET transfer_id=$3,transfer_line_id=$4 WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,movementId,c.transferId,line.dispatchLineId]);
     }
    }
   }
   await tx.query('UPDATE transfers SET revision=revision+1 WHERE organization_id=$1 AND transfer_id=$2',[c.organizationId,c.transferId]);
  }
  // Line IDs and the envelope share the global command deduplication namespace.
  for(const line of c.lines)await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,line.movementId,createHash('sha256').update(JSON.stringify({transferOperation:c.operationId,line})).digest('hex'),JSON.stringify({operationId:line.movementId,outcome:'accepted'})]);
  const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount:total.toFixed(12)};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);return result;
 });
}

async function postTransferRevision(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 if(access.role!=='owner'&&access.role!=='manager')throw new BusinessError('FORBIDDEN','تعديل التحويل المقبول متاح للمالك والمدير.',403);
 const parsed=transferRevisionSchema.safeParse(input);
 if(!parsed.success)throw new BusinessError('INVALID_COMMAND','راجع مواد التحويل وسبب التعديل.',400);
 const edit=parsed.data;
 const voiding=edit.type==='transfer.void';
 const {organizationId:org,transferId,operationId}=edit;
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','ليس لديك صلاحية لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(edit)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
  await assertGeneration(tx,org,edit.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,operationId])).rows[0];
  if(prior){
   if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف التعديل مستخدم لبيانات مختلفة.');
   return prior.result;
  }
  const current=(await tx.query<{payload:TransferDispatch;revision:number;amount:string}>('SELECT payload,revision,amount::text FROM transfers WHERE organization_id=$1 AND transfer_id=$2 FOR UPDATE',[org,transferId])).rows[0];
  if(!current)throw new BusinessError('INVALID_REFERENCE','مستند التحويل غير متاح.');
  if(current.revision!==edit.expectedRevision)throw new BusinessError('STALE_REVISION','تغير التحويل. زامن وأعد فتح التعديل.');
  if(operationId===transferId||(await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=$2',[org,operationId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف التعديل مستخدم بالفعل.');
  const previous=current.payload;
  if(!previous.lines.length)throw new BusinessError('TRANSFER_VOIDED','مستند التحويل ملغى بالفعل.');
  const reference=voiding?previous.reason:edit.reference;
  const businessDate=voiding?previous.businessDate:edit.businessDate;
  const oldByItem=new Map(previous.lines.map(line=>[line.itemId,line]));
  const lines=(voiding?[]:edit.lines).map(line=>{
   const old=oldByItem.get(line.itemId);
   return old&&old.unitId===line.unitId&&decimal(old.quantity).eq(line.quantity)?old:{...line,movementId:randomUUID()};
  });
  const currentIds=new Set(previous.lines.map(line=>line.movementId));
  const nextIds=new Set(lines.map(line=>line.movementId));
  const removed=previous.lines.filter(line=>!nextIds.has(line.movementId));
  const added=lines.filter(line=>!currentIds.has(line.movementId));
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dateChanged=previous.businessDate!==businessDate;
  if(!removed.length&&!added.length&&!dateChanged&&previous.reason===reference)throw new BusinessError('NO_CHANGE','غيّر التاريخ أو الكميات أو مرجع المستند قبل الحفظ.');
  if(businessDate>day)throw new BusinessError('FUTURE_DATE','تاريخ التحويل لا يمكن أن يكون في المستقبل.');
  if(dateChanged){
   await assertInventoryDateOpen(tx,org,previous.sourceId,previous.businessDate);
   await assertInventoryDateOpen(tx,org,previous.sourceId,businessDate);
   const firstAction=(await tx.query<{date:string|null}>(`SELECT min(a.payload->>'businessDate') AS date FROM transfer_actions a
    WHERE a.organization_id=$1 AND a.transfer_id=$2 AND NOT EXISTS(SELECT 1 FROM transfer_edits e WHERE e.organization_id=a.organization_id AND e.transfer_id=a.transfer_id AND e.replay_ids ? a.operation_id::text)`,[org,transferId])).rows[0]?.date;
   if(firstAction&&businessDate>firstAction)throw new BusinessError('INVALID_DATE','تاريخ التحويل لا يمكن أن يكون بعد أول استلام أو فقد مسجل.');
  }
  const updated:TransferDispatch={...previous,businessDate,reason:reference,lines};
  const settlements=(await tx.query<{id:string;received:string;lost:string;amount:string}>(`SELECT dispatch_line_id::text AS id,sum(received)::text AS received,sum(lost)::text AS lost,sum(COALESCE(initial_value,quantity*unit_cost))::text AS amount
   FROM transfer_segments WHERE organization_id=$1 AND transfer_id=$2 AND dispatch_line_id=ANY($3::uuid[]) GROUP BY dispatch_line_id`,[org,transferId,[...currentIds]])).rows;
  const byLine=new Map(settlements.map(row=>[row.id,row]));
  if(settlements.length!==previous.lines.length)throw new BusinessError('INVALID_REFERENCE','تعذر مطابقة تسويات التحويل الحالية.');
  if(voiding&&settlements.some(row=>decimal(row.lost).gt(0)))throw new BusinessError('TRANSFER_HAS_LOSS','لا يمكن إلغاء تحويل له فقد مسجل. راجع تسوية الفقد أولاً.');
  const fullyReceived=previous.lines.every(line=>decimal(byLine.get(line.movementId)!.received).eq(line.quantity));
  const receive:Extract<TransferCommand,{type:'transfer.receive'}>['lines']=[];
  const lose:typeof receive=[];
  const newByItem=new Map(added.map(line=>[line.itemId,line]));
  for(const old of removed){
   const replacement=newByItem.get(old.itemId);
   const settled=byLine.get(old.movementId)!;
   const total=decimal(settled.received).add(settled.lost);
   if(!voiding&&!fullyReceived&&total.gt('0')&&(!replacement||replacement.unitId!==old.unitId||decimal(replacement.quantity).lt(total)))throw new BusinessError('BELOW_SETTLED_QUANTITY','لا يمكن خفض كمية مادة عن المستلم أو الفاقد المسجل في تحويل جزئي.');
   if(replacement&&!fullyReceived){
    if(decimal(settled.received).gt('0'))receive.push({movementId:randomUUID(),dispatchLineId:replacement.movementId,quantity:settled.received});
    if(decimal(settled.lost).gt('0'))lose.push({movementId:randomUUID(),dispatchLineId:replacement.movementId,quantity:settled.lost});
   }
  }
  if(fullyReceived)for(const line of added)receive.push({movementId:randomUUID(),dispatchLineId:line.movementId,quantity:line.quantity});
  let amount=decimal(current.amount);
  const reversalIds:string[]=[];
  if(added.length||removed.length){
   await assertInventoryDateOpen(tx,org,previous.sourceId,previous.businessDate);
   await assertInventoryDateOpen(tx,org,previous.sourceId,day);
   if(receive.length)await assertInventoryDateOpen(tx,org,previous.destinationId,day);
   if(added.length){
    const locations=await tx.query('SELECT id FROM locations WHERE organization_id=$1 AND id=ANY($2::text[]) AND active',[org,[previous.sourceId,previous.destinationId]]);
    if(locations.rows.length!==2)throw new BusinessError('INVALID_REFERENCE','مصدر التحويل ووجهته يجب أن يكونا نشطين عند إضافة كميات.');
   }
   if(removed.length)reversalIds.push(...await reverseTransferLines(tx,org,transferId,removed.map(line=>line.movementId),day,edit.reason));
   amount=amount.sub(removed.reduce((sum,line)=>sum.add(byLine.get(line.movementId)!.amount),decimal('0')));
   amount=amount.add(await dispatchLines(tx,{...updated,lines:added,businessDate:day}));
  }
  let revision=current.revision+1;
  await tx.query('UPDATE transfers SET payload=$3,amount=$4,revision=$5 WHERE organization_id=$1 AND transfer_id=$2',[org,transferId,JSON.stringify(updated),amount.toFixed(12),revision]);
  const replayIds:string[]=[];
  const facade:Database={query:tx.query.bind(tx),transaction:run=>run(tx)};
  for(const [type,settled] of [['transfer.receive',receive],['transfer.loss',lose]] as const){
   if(!settled.length)continue;
   const replayId=randomUUID();
   await postTransfer(facade,access,{type,lines:settled,operationId:replayId,organizationId:org,generation:edit.generation,transferId,expectedRevision:revision,businessDate:day,reason:reference,capturedAt:new Date().toISOString(),schemaVersion:1});
   replayIds.push(replayId);
   revision++;
  }
  const touched=new Set([...removed,...added].map(line=>line.itemId));
  if(touched.size&&(await reconcileStock(tx,org)).some(row=>[previous.sourceId,previous.destinationId].includes(row.locationId)&&touched.has(row.itemId)&&!row.matches))throw new BusinessError('RECONCILIATION_MISMATCH','أرصدة التعديل لا تطابق سجل المخزون.');
  await tx.query(`INSERT INTO transfer_edits(organization_id,transfer_id,operation_id,revision,actor,reason,previous_document,updated_document,reversal_ids,replay_ids)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[org,transferId,operationId,revision,access.userId,edit.reason,JSON.stringify(previous),JSON.stringify(updated),JSON.stringify(reversalIds),JSON.stringify(replayIds)]);
  const result:CommandResult={operationId,outcome:'accepted',amount:amount.toFixed(12)};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,operationId,hash,JSON.stringify(result)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,operationId,edit.type]);
  return result;
 });
}
