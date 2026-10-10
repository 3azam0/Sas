import {assertGeneration,planIssue,applyIssue} from './valuation';
import type {PGlite} from '@electric-sql/pglite';
import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,transferCommandSchema,type Access,type Transfer,type TransferDispatch,type TransferAction,type CommandResult,type Layer} from '@saas/contracts';
import {allocateFIFO,decimal} from '@saas/domain';
import {addIncomingStock} from './incoming';

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

export async function transferSnapshot(tx:Pick<PGlite,'query'>,org:string){
 const docs=await tx.query<{transferId:string;revision:number;document:TransferDispatch;amount:string;postedAt:string}>('SELECT transfer_id AS "transferId",revision,payload AS document,amount::text,posted_at::text AS "postedAt" FROM transfers WHERE organization_id=$1 ORDER BY posted_at',[org]);
 const totals=await tx.query<{transfer_id:string;dispatch_line_id:string;received:string;lost:string;remaining:string;amount:string;remainingValue:string}>('SELECT transfer_id,dispatch_line_id,sum(received)::text AS received,sum(lost)::text AS lost,sum(quantity-received-lost)::text AS remaining,sum(COALESCE(initial_value,quantity*unit_cost))::text AS amount,sum(COALESCE(remaining_value,(quantity-received-lost)*unit_cost))::text AS "remainingValue" FROM transfer_segments WHERE organization_id=$1 GROUP BY transfer_id,dispatch_line_id',[org]);
 const transfers:Transfer[]=docs.rows.map(d=>{const lines=d.document.lines.map(l=>{const t=totals.rows.find(r=>r.transfer_id===d.transferId&&r.dispatch_line_id===l.movementId)!;return {dispatchLineId:l.movementId,itemId:l.itemId,unitId:l.unitId,quantity:l.quantity,received:t.received,lost:t.lost,remaining:t.remaining,amount:t.amount,remainingValue:t.remainingValue};});const outstanding=lines.some(l=>decimal(l.remaining).gt(0)),loss=lines.some(l=>decimal(l.lost).gt(0)),received=lines.some(l=>decimal(l.received).gt(0));return {...d,lines,state:outstanding?(received||loss?'partial':'inTransit'):loss?'resolvedWithLoss':'completed'};});
 const actions=await tx.query<TransferAction>('SELECT payload AS document,amount::text,posted_at::text AS "postedAt" FROM transfer_actions WHERE organization_id=$1 ORDER BY posted_at',[org]);
 return {transfers,transferActions:actions.rows};
}

export async function postTransfer(db:PGlite,access:Access,input:unknown):Promise<CommandResult>{
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
  if(c.type!=='transfer.dispatch'&&!existing)throw new BusinessError('INVALID_REFERENCE','الإرسال غير مقبول أو غير متاح.');
  const ids=[c.operationId,...c.lines.map(l=>l.movementId)];
  if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[c.organizationId,ids])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف مستند أو سطر مستخدم بالفعل.');
  let total=decimal('0');
  if(c.type==='transfer.dispatch'){
   if(existing)throw new BusinessError('ORDER_LOCKED','الإرسال مقبول بالفعل.');
   const locations=(await tx.query<{id:string}>('SELECT id FROM locations WHERE organization_id=$1 AND id=ANY($2::text[]) AND active',[c.organizationId,[c.sourceId,c.destinationId]])).rows;if(locations.length!==2)throw new BusinessError('INVALID_REFERENCE','اختر مصدر ووجهة نشطين داخل المؤسسة.');
   const prepared=[];
   for(const line of c.lines){
    if(!(await tx.query('SELECT 1 FROM items WHERE organization_id=$1 AND id=$2 AND unit_id=$3 AND active',[c.organizationId,line.itemId,line.unitId])).rows.length)throw new BusinessError('INVALID_REFERENCE','المادة أو وحدة المخزون غير متاحة.');
    const layers=(await tx.query<Layer>('SELECT id,location_id AS "locationId",item_id AS "itemId",remaining::text,unit_cost::text AS "unitCost",sequence FROM cost_layers WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining>0 ORDER BY sequence,id FOR UPDATE',[c.organizationId,c.sourceId,line.itemId])).rows;
    const allocation=await planIssue(tx,c.organizationId,c.sourceId,line.itemId,line.quantity);total=total.add(allocation.amount);prepared.push({line,layers,allocation});
   }
   await tx.query('INSERT INTO transfers(organization_id,transfer_id,revision,source_id,destination_id,payload,amount) VALUES($1,$2,1,$3,$4,$5,$6)',[c.organizationId,c.transferId,c.sourceId,c.destinationId,JSON.stringify(c),total.toFixed(12)]);
   for(const {line,layers,allocation} of prepared){
    await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,transfer_id,transfer_line_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$2)',[c.organizationId,line.movementId,c.sourceId,line.itemId,decimal(line.quantity).neg().toString(),decimal(allocation.amount).neg().toString(),c.type,c.reason,c.businessDate,c.transferId]);
    for(const [ordinal,p] of allocation.allocations.entries()){


     await tx.query('INSERT INTO transfer_segments(organization_id,transfer_id,dispatch_line_id,layer_id,ordinal,quantity,unit_cost,initial_value,remaining_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[c.organizationId,c.transferId,line.movementId,p.layerId,ordinal,p.quantity,allocation.method==='fifo'?layers.find(l=>l.id===p.layerId)!.unitCost:decimal(p.amount).div(p.quantity).toFixed(6),p.amount]);
    }
    await applyIssue(tx,c.organizationId,c.sourceId,line.itemId,line.movementId,line.quantity,allocation);
   }
  }else{
   const d=existing!.payload;
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
      await addIncomingStock(tx,{organizationId:c.organizationId,operationId:movementId,locationId:d.destinationId,itemId:definition.itemId,quantity:p.quantity,unitCost:p.unit_cost,amount:p.amount,type:c.type,reason:c.reason,businessDate:c.businessDate});
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
