import {assertGeneration,planIssue,applyIssue} from './valuation';
import type {Database} from './database';
import {createHash} from 'node:crypto';
import {BusinessError,countCommandSchema,type Access,type CommandResult,type CountDefinition,type CountChange,type FinalizedCount,type StockCount,type StockReconciliation,type Layer} from '@saas/contracts';
import {allocateFIFO,decimal} from '@saas/domain';
import {addIncomingStock} from './incoming';

export const countTables=`
CREATE TABLE IF NOT EXISTS stock_counts(organization_id text NOT NULL REFERENCES organizations(id),count_id uuid NOT NULL,location_id text NOT NULL,revision integer NOT NULL CHECK(revision>0),state text NOT NULL CHECK(state IN ('draft','finalized','cancelled')),payload jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,count_id),FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id));
CREATE INDEX IF NOT EXISTS count_location_lookup ON stock_counts(organization_id,location_id);
CREATE TABLE IF NOT EXISTS count_revisions(organization_id text NOT NULL,count_id uuid NOT NULL,revision integer NOT NULL,payload jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,count_id,revision),FOREIGN KEY(organization_id,count_id) REFERENCES stock_counts(organization_id,count_id));
CREATE TABLE IF NOT EXISTS count_finalizations(organization_id text NOT NULL,operation_id uuid NOT NULL,count_id uuid NOT NULL,payload jsonb NOT NULL,changes jsonb NOT NULL,amount numeric(38,12) NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),UNIQUE(organization_id,count_id),FOREIGN KEY(organization_id,count_id) REFERENCES stock_counts(organization_id,count_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS count_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS count_line_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_count_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_count_scope FOREIGN KEY(organization_id,count_id) REFERENCES stock_counts(organization_id,count_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_count_lookup ON stock_entries(organization_id,count_id);
CREATE INDEX IF NOT EXISTS stock_location_sequence_lookup ON stock_entries(organization_id,location_id,sequence);
CREATE INDEX IF NOT EXISTS stock_location_item_lookup ON stock_entries(organization_id,location_id,item_id);
`;

// Aggregate each independent source first; joining raw rows would multiply values.
export async function reconcileStock(tx:Pick<Database,'query'>,org:string):Promise<StockReconciliation[]>{
 const balances=(await tx.query<{locationId:string;itemId:string;quantity:string;value:string}>('SELECT location_id AS "locationId",item_id AS "itemId",quantity::text,value::text FROM stock_balances WHERE organization_id=$1',[org])).rows;
 const ledger=(await tx.query<{locationId:string;itemId:string;quantity:string;value:string}>('SELECT location_id AS "locationId",item_id AS "itemId",sum(quantity)::text AS quantity,sum(amount)::text AS value FROM stock_entries WHERE organization_id=$1 GROUP BY location_id,item_id',[org])).rows;
 const layers=(await tx.query<{locationId:string;itemId:string;quantity:string;value:string}>('SELECT location_id AS "locationId",item_id AS "itemId",sum(remaining)::text AS quantity,sum(COALESCE(remaining_value,remaining*unit_cost))::text AS value FROM cost_layers WHERE organization_id=$1 GROUP BY location_id,item_id',[org])).rows;
 const key=(r:{locationId:string;itemId:string})=>JSON.stringify([r.locationId,r.itemId]);const b=new Map(balances.map(r=>[key(r),r])),e=new Map(ledger.map(r=>[key(r),r])),l=new Map(layers.map(r=>[key(r),r]));
 return [...new Set([...b.keys(),...e.keys(),...l.keys()])].map(k=>{const row=b.get(k)??e.get(k)??l.get(k)!;const balanceQuantity=b.get(k)?.quantity??'0',balanceValue=b.get(k)?.value??'0',ledgerQuantity=e.get(k)?.quantity??'0',ledgerValue=e.get(k)?.value??'0',layerQuantity=l.get(k)?.quantity??'0',layerValue=l.get(k)?.value??'0';return {locationId:row.locationId,itemId:row.itemId,balanceQuantity,balanceValue,ledgerQuantity,ledgerValue,layerQuantity,layerValue,matches:decimal(balanceQuantity).eq(ledgerQuantity)&&decimal(balanceQuantity).eq(layerQuantity)&&decimal(balanceValue).eq(ledgerValue)&&decimal(balanceValue).eq(layerValue)};});
}
export async function countSnapshot(tx:Pick<Database,'query'>,org:string){
 const docs=(await tx.query<StockCount>('SELECT count_id AS "countId",revision,state,payload AS document,posted_at::text AS "postedAt" FROM stock_counts WHERE organization_id=$1 ORDER BY posted_at',[org])).rows;
 const finals=(await tx.query<FinalizedCount>('SELECT payload AS document,changes,amount::text,posted_at::text AS "postedAt" FROM count_finalizations WHERE organization_id=$1',[org])).rows;
 const revisions=(await tx.query<{countId:string;revision:number;command:import('@saas/contracts').CountCommand;postedAt:string}>('SELECT count_id AS "countId",revision,payload AS command,posted_at::text AS "postedAt" FROM count_revisions WHERE organization_id=$1 ORDER BY posted_at,revision',[org])).rows;
 const points=(await tx.query<{locationId:string;sequence:string}>('SELECT l.id AS "locationId",COALESCE(max(e.sequence),0)::text AS sequence FROM locations l LEFT JOIN stock_entries e ON e.organization_id=l.organization_id AND e.location_id=l.id WHERE l.organization_id=$1 GROUP BY l.id',[org])).rows;
 return {counts:docs.map(d=>({...d,finalization:finals.find(f=>f.document.countId===d.countId)})),countRevisions:revisions,stockCheckpoints:points,reconciliation:await reconcileStock(tx,org)};
}

export async function postCount(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=countCommandSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_COMMAND','تحقق من مستند الجرد.',400);const c=parsed.data;
 if(c.organizationId!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','ليس لديك صلاحية لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[c.organizationId]);
 await assertGeneration(tx,c.organizationId,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows[0];
  if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior.result;}
  if((await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','المعرّف مستخدم لحركة مخزون.');
  const current=(await tx.query<{revision:number;state:string;payload:CountDefinition}>('SELECT revision,state,payload FROM stock_counts WHERE organization_id=$1 AND count_id=$2 FOR UPDATE',[c.organizationId,c.countId])).rows[0];
  if((current?.revision??0)!==c.expectedRevision)throw new BusinessError('STALE_REVISION','تغير مستند الجرد. زامن وراجع الإصدار.');
  if(current&&current.state!=='draft')throw new BusinessError('COUNT_LOCKED','الجرد معتمد أو ملغى؛ لا يمكن تعديله.');
  const revision=c.expectedRevision+1;let amount:string|undefined;
  if(c.type==='count.save'){
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(c.businessDate>today||Date.parse(c.cutoffAt)>Date.now()+300000)throw new BusinessError('FUTURE_DATE','تاريخ أو وقت الجرد في المستقبل.');
   if(current&&current.payload.locationId!==c.locationId)throw new BusinessError('INVALID_REFERENCE','لا يمكن نقل الجرد إلى موقع آخر.');
   if(current&&(current.payload.stockSequence!==c.stockSequence||current.payload.cutoffAt!==c.cutoffAt||c.lines.some(l=>{const old=current.payload.lines.find(x=>x.itemId===l.itemId);return old&&!decimal(old.expectedQuantity).eq(l.expectedQuantity);})))throw new BusinessError('BASELINE_MISMATCH','تعديل المسودة يحافظ على أساسها. أنشئ جرداً جديداً بعد إعادة العد الفعلي.');
   if(!(await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2 AND active',[c.organizationId,c.locationId])).rows.length)throw new BusinessError('INVALID_REFERENCE','موقع الجرد غير متاح أو غير نشط.');
   for(const line of c.lines)if(!(await tx.query('SELECT 1 FROM items WHERE organization_id=$1 AND id=$2 AND unit_id=$3',[c.organizationId,line.itemId,line.unitId])).rows.length)throw new BusinessError('INVALID_REFERENCE','المادة أو وحدة الجرد خارج نطاق المؤسسة.');
   await tx.query('INSERT INTO stock_counts(organization_id,count_id,location_id,revision,state,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id,count_id) DO UPDATE SET revision=EXCLUDED.revision,payload=EXCLUDED.payload',[c.organizationId,c.countId,c.locationId,revision,'draft',JSON.stringify(c)]);
  }else{
   if(!current)throw new BusinessError('INVALID_REFERENCE','مسودة الجرد لم تقبل بعد.');const d=current.payload;
   if(c.type==='count.cancel')await tx.query("UPDATE stock_counts SET revision=$3,state='cancelled' WHERE organization_id=$1 AND count_id=$2",[c.organizationId,c.countId,revision]);
   else{
    if(!(await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2 AND active',[c.organizationId,d.locationId])).rows.length)throw new BusinessError('INVALID_REFERENCE','موقع الجرد غير نشط.');
    if(c.lines.length!==d.lines.length||c.lines.some(l=>!d.lines.some(x=>x.lineId===l.lineId)))throw new BusinessError('INVALID_REFERENCE','سطور الاعتماد لا تطابق المسودة كاملة.');
    const ids=c.lines.map(l=>l.movementId);if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[c.organizationId,ids])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف حركة التسوية مستخدم بالفعل.');
    const sequence=(await tx.query<{sequence:string}>('SELECT COALESCE(max(sequence),0)::text AS sequence FROM stock_entries WHERE organization_id=$1 AND location_id=$2',[c.organizationId,d.locationId])).rows[0].sequence;
    if(sequence!==d.stockSequence)throw new BusinessError('STALE_COUNT','تغير مخزون الموقع بعد أساس الجرد. زامن وأعد العد الفعلي؛ لا تعاد كتابة الرصيد القديم.');
    const before=await reconcileStock(tx,c.organizationId);const prepared=[];
    for(const line of d.lines){
     const reconciliation=before.find(r=>r.locationId===d.locationId&&r.itemId===line.itemId);if(reconciliation&&!reconciliation.matches)throw new BusinessError('RECONCILIATION_MISMATCH','الرصيد والحركات وطبقات التكلفة غير متطابقة. أوقف الاعتماد وراجع السجل.');
     const expected=reconciliation?.balanceQuantity??'0';if(!decimal(expected).eq(line.expectedQuantity))throw new BusinessError('BASELINE_MISMATCH','كمية الأساس لا تطابق الرصيد المقبول. زامن وأعد العد.');
     const variance=decimal(line.countedQuantity).sub(expected),movementId=c.lines.find(l=>l.lineId===line.lineId)!.movementId;let allocation:Awaited<ReturnType<typeof planIssue>>|undefined;
     if(variance.gt(0)&&line.surplusUnitCost===undefined)throw new BusinessError('COST_REQUIRED','أدخل تكلفة وحدة صريحة لكل زيادة قبل اعتماد الجرد.');
     if(variance.lt(0)){
      allocation=await planIssue(tx,c.organizationId,d.locationId,line.itemId,variance.neg().toString());
     }
     const value=variance.lt(0)?decimal(allocation!.amount).neg().toFixed(12):variance.gt(0)?variance.mul(line.surplusUnitCost!).toFixed(12):'0.000000000000';prepared.push({line,movementId,variance,allocation,value});
    }
    let total=decimal('0');const changes:CountChange[]=[];
    for(const {line,movementId,variance,allocation,value} of prepared){
     total=total.add(value);
     if(variance.gt(0))await addIncomingStock(tx,{organizationId:c.organizationId,operationId:movementId,locationId:d.locationId,itemId:line.itemId,quantity:variance.toString(),unitCost:line.surplusUnitCost!,type:'count.adjust',reason:d.reason,businessDate:d.businessDate});
     if(variance.lt(0)){
      await applyIssue(tx,c.organizationId,d.locationId,line.itemId,movementId,variance.neg().toString(),allocation!);
      await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[c.organizationId,movementId,d.locationId,line.itemId,variance.toString(),value,'count.adjust',d.reason,d.businessDate]);

     }
     if(!variance.isZero())await tx.query('UPDATE stock_entries SET count_id=$3,count_line_id=$4 WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,movementId,c.countId,line.lineId]);
     const change:CountChange={lineId:line.lineId,movementId,itemId:line.itemId,expected:line.expectedQuantity,counted:line.countedQuantity,variance:variance.toString(),amount:value,surplusUnitCost:variance.gt(0)?line.surplusUnitCost:undefined};changes.push(change);
     await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,movementId,createHash('sha256').update(JSON.stringify({countOperation:c.operationId,change})).digest('hex'),JSON.stringify({operationId:movementId,outcome:'accepted',amount:value})]);
    }
    const after=await reconcileStock(tx,c.organizationId);if(after.some(r=>r.locationId===d.locationId&&d.lines.some(l=>l.itemId===r.itemId)&&!r.matches))throw new BusinessError('RECONCILIATION_MISMATCH','فشلت مطابقة الجرد؛ لم تعتمد أي تسوية.');
    amount=total.toFixed(12);await tx.query('INSERT INTO count_finalizations(organization_id,operation_id,count_id,payload,changes,amount) VALUES($1,$2,$3,$4,$5,$6)',[c.organizationId,c.operationId,c.countId,JSON.stringify(c),JSON.stringify(changes),amount]);
    await tx.query("UPDATE stock_counts SET revision=$3,state='finalized' WHERE organization_id=$1 AND count_id=$2",[c.organizationId,c.countId,revision]);
   }
  }
  await tx.query('INSERT INTO count_revisions(organization_id,count_id,revision,payload) VALUES($1,$2,$3,$4)',[c.organizationId,c.countId,revision,JSON.stringify(c)]);
  const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);return result;
 });
}
