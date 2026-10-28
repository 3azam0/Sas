import {assertInventoryWrite,assertInventoryManager} from './inventory-permissions';
import {tagOutputLot} from './stock-lots';
import type {Database} from './database';
import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,type Access,type CommandResult,type Item} from '@saas/contracts';
import {butcheryCommandSchema,isKilogramUnit,type ButcheryCatalog,type PostedButchery,type ButcheryOutput} from '../contracts/butchery';
import {decimal} from '@saas/domain';
import {assertGeneration,planIssue,applyIssue,costingMethod,rebalanceAverage} from './valuation';
import {exactOutputLayers} from '../domain/production';
import {reconcileStock} from './counts';

export const butcheryTables=`
CREATE TABLE IF NOT EXISTS butchery_catalog(organization_id text NOT NULL REFERENCES organizations(id),item_id text NOT NULL,unit_id text NOT NULL,meat_kind text NOT NULL CHECK(meat_kind IN ('beef_input','sheep_live','beef_product','lamb_product')),PRIMARY KEY(organization_id,item_id),FOREIGN KEY(organization_id,item_id) REFERENCES items(organization_id,id),FOREIGN KEY(organization_id,unit_id) REFERENCES units(organization_id,id));
CREATE TABLE IF NOT EXISTS butchery_batches(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS butchery_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_butchery_scope' AND conrelid='stock_entries'::regclass) THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_butchery_scope FOREIGN KEY(organization_id,butchery_id) REFERENCES butchery_batches(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_butchery_lookup ON stock_entries(organization_id,butchery_id);
CREATE INDEX IF NOT EXISTS butchery_posted_lookup ON butchery_batches(organization_id,posted_at DESC);
`;
// Hosted callers add these policies in their additive migration, never the frozen baseline.
export const butcheryMigration=butcheryTables+`
ALTER TABLE butchery_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE butchery_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE butchery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE butchery_batches FORCE ROW LEVEL SECURITY;
REVOKE ALL ON butchery_catalog,butchery_batches FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON butchery_catalog,butchery_batches TO fodo_api;
CREATE POLICY tenant_scope ON butchery_catalog TO fodo_api USING(organization_id=current_setting('fodo.tenant',true)) WITH CHECK(organization_id=current_setting('fodo.tenant',true));
CREATE POLICY tenant_scope ON butchery_batches TO fodo_api USING(organization_id=current_setting('fodo.tenant',true)) WITH CHECK(organization_id=current_setting('fodo.tenant',true));
`;
function check(condition:unknown,message:string):asserts condition {if(!condition)throw new BusinessError('INVALID_BUTCHERY',message,400);}
export async function butcherySnapshot(tx:Pick<Database,'query'>,org:string){
 const catalog=await tx.query<ButcheryCatalog>('SELECT item_id AS "itemId",unit_id AS "unitId",meat_kind AS "meatKind" FROM butchery_catalog WHERE organization_id=$1 ORDER BY item_id',[org]);
 const docs=await tx.query<{result:PostedButchery}>('SELECT result FROM butchery_batches WHERE organization_id=$1 ORDER BY posted_at DESC,operation_id',[org]);
 return {butcheryCatalog:catalog.rows,butcheryDocuments:docs.rows.map(d=>d.result)};
}
export async function postButchery(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 assertInventoryWrite(access);
 const parsed=butcheryCommandSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_BUTCHERY','راجع الأصناف والأوزان ونسب التكلفة.',400);const c=parsed.data,org=c.organizationId;
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بالجزارة لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  const tenant=await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);if(!tenant.rows.length)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);await assertGeneration(tx,org,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];
  if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior.result;}
  if((await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','المعرّف مستخدم لحركة مخزون.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(c.businessDate>today)throw new BusinessError('FUTURE_DATE','تاريخ الجزارة لا يمكن أن يكون في المستقبل.');
  const method=await costingMethod(tx,org);let amount='0.000000000000',inputAmount='0.000000000000';const outputs:ButcheryOutput[]=[];
  const item=async(id:string)=>{const r=(await tx.query<Item>('SELECT id,name,active,unit_id AS "unitId" FROM items WHERE organization_id=$1 AND id=$2',[org,id])).rows[0];check(r&&r.active!==false,'المادة غير متاحة أو غير نشطة.');return r;};
  const kg=async(id:string)=>{const r=(await tx.query<{name:string}>('SELECT name FROM units WHERE organization_id=$1 AND id=$2',[org,id])).rows[0];check(r&&isKilogramUnit(r.name),'أصناف الجزارة تستخدم وحدة كيلوجرام.');};
  if(c.type==='product.create'||c.type==='product.classify'){
   let unitId:string;
   if(c.type==='product.create'){
    await kg(c.unitId);unitId=c.unitId;
    check(!(await tx.query('SELECT id FROM items WHERE organization_id=$1 AND (id=$2 OR lower(btrim(name))=lower(btrim($3)))',[org,c.itemId,c.name])).rows.length,'يوجد صنف بهذا الاسم أو المعرّف؛ صنّف الصنف الموجود.');
    const unit=(await tx.query<{name:string}>('SELECT name FROM units WHERE organization_id=$1 AND id=$2',[org,c.unitId])).rows[0];
    await tx.query('INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES($1,$2,$3,$4,$5,$6,$7,0)',[org,c.itemId,c.name,'BT-'+c.itemId,c.meatKind.startsWith('beef')?'لحوم بقري':'لحوم ضاني',unit.name,c.unitId]);
   }else{const i=await item(c.itemId);check(i.unitId,'حدد وحدة مخزون الصنف أولاً.');unitId=i.unitId;await kg(unitId);}
   const existing=(await tx.query<ButcheryCatalog>('SELECT unit_id AS "unitId",meat_kind AS "meatKind" FROM butchery_catalog WHERE organization_id=$1 AND item_id=$2',[org,c.itemId])).rows[0];
   check(!existing||existing.meatKind===c.meatKind&&existing.unitId===unitId,'نوع صنف الجزارة ثابت؛ استخدم صنفاً مختلفاً.');
   await tx.query('INSERT INTO butchery_catalog VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[org,c.itemId,unitId,c.meatKind]);
  }else{
   check((await tx.query('SELECT id FROM locations WHERE organization_id=$1 AND id=$2 AND active',[org,c.locationId])).rows.length,'اختر موقع جزارة نشطاً داخل المؤسسة.');
   const inputItem=await item(c.itemId),catalog=(await butcherySnapshot(tx,org)).butcheryCatalog;
   const inputCatalog=catalog.find(i=>i.itemId===c.itemId);check(inputCatalog&&inputCatalog.meatKind===(c.mode==='beef'?'beef_input':'sheep_live')&&inputCatalog.unitId===inputItem.unitId,'صنف المدخل أو وحدته لا يطابق مسار التجهيز.');await kg(inputCatalog.unitId);
   check(new Set(c.outputs.map(o=>o.itemId)).size===c.outputs.length,'لا تكرر صنفاً في المخرجات.');
   check(c.outputs.reduce((n,o)=>n.add(o.costShare),decimal('0')).eq(100),'يجب أن يكون مجموع نسب التكلفة 100%.');
   const weight=c.outputs.reduce((n,o)=>n.add(o.quantity),decimal('0'));
   if(c.mode==='lamb'){
    check(c.headCount&&c.carcassWeight,'عدد الرؤوس ووزن الذبيحة مطلوبان.');
    check(decimal(c.carcassWeight).add(c.slaughterLoss).eq(c.quantity),'وزن الذبيحة والأحشاء المستخدمة وفاقد الذبح يجب أن يساوي الوزن الحي.');
    check(weight.add(c.cuttingLoss).eq(c.carcassWeight),'المخرجات وفاقد التقطيع يجب أن يساوي وزن الذبيحة والأحشاء المستخدمة.');
   }else{
    check(!c.headCount&&!c.carcassWeight&&decimal(c.slaughterLoss).isZero(),'اللحم البقري المشترى لا يحتاج بيانات ذبح.');
    check(weight.add(c.cuttingLoss).eq(c.quantity),'المخرجات وفاقد التقطيع يجب أن يساوي وزن المدخل.');
   }
   for(const o of c.outputs){const product=await item(o.itemId),kind=catalog.find(i=>i.itemId===o.itemId);check(kind&&kind.meatKind===(c.mode==='beef'?'beef_product':'lamb_product')&&kind.unitId===product.unitId,'نوع المنتج أو وحدته لا يطابق الدفعة.');await kg(kind.unitId);}
   const affected=new Set([c.itemId,...c.outputs.map(o=>o.itemId)]);
   const reconcile=async()=>{if((await reconcileStock(tx,org)).some(r=>r.locationId===c.locationId&&affected.has(r.itemId)&&!r.matches))throw new BusinessError('RECONCILIATION_MISMATCH','الرصيد والدفتر والطبقات غير متطابقة؛ لم تُرحّل الدفعة.');};await reconcile();
   const issue=await planIssue(tx,org,c.locationId,c.itemId,c.quantity);inputAmount=issue.amount;amount=decimal(inputAmount).add(c.processingCost).toFixed(12);
   check(decimal(amount).lt('1000000000000000000'),'قيمة الدفعة كبيرة؛ قسّمها إلى دفعات أصغر.');
   const last=c.outputs.reduce((index,o,i)=>decimal(o.costShare).gt(0)?i:index,-1);let allocated=decimal('0');
   for(const [index,o] of c.outputs.entries()){
    const cost=index===last?decimal(amount).sub(allocated):decimal(amount).mul(o.costShare).div(100).toDecimalPlaces(12,1);allocated=allocated.add(cost);
    exactOutputLayers(o.quantity,cost.toFixed(12));outputs.push({...o,amount:cost.toFixed(12),unitCost:cost.div(o.quantity).toFixed(6)});
   }
   const accepted:PostedButchery={document:c,inputAmount,amount,method,outputs,postedAt:new Date().toISOString()};
   await tx.query('INSERT INTO butchery_batches(organization_id,operation_id,payload,result) VALUES($1,$2,$3,$4)',[org,c.operationId,JSON.stringify(c),JSON.stringify(accepted)]);
   const inputMovement=randomUUID();await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,butchery_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[org,inputMovement,c.locationId,c.itemId,decimal(c.quantity).neg().toFixed(6),decimal(inputAmount).neg().toFixed(12),'butchery.input',c.reason,c.businessDate,c.operationId]);
   await applyIssue(tx,org,c.locationId,c.itemId,inputMovement,c.quantity,issue);
   for(const o of outputs){
    const movement=randomUUID(),entry=(await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,butchery_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING sequence',[org,movement,c.locationId,o.itemId,o.quantity,o.amount,'butchery.output',c.reason,c.businessDate,c.operationId])).rows[0];
    const parts=method==='fifo'?exactOutputLayers(o.quantity,o.amount):[{quantity:o.quantity,unitCost:o.unitCost}];
    for(const part of parts)await tx.query('INSERT INTO cost_layers(organization_id,id,location_id,item_id,remaining,unit_cost,sequence,remaining_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,randomUUID(),c.locationId,o.itemId,part.quantity,part.unitCost,entry.sequence,method==='moving_average'?o.amount:null]);
    await tagOutputLot(tx,org,movement,c.outputs.find(output=>output.itemId===o.itemId)?.lot);
    await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,location_id,item_id) DO UPDATE SET quantity=stock_balances.quantity+EXCLUDED.quantity,value=stock_balances.value+EXCLUDED.value',[org,c.locationId,o.itemId,o.quantity,o.amount]);await rebalanceAverage(tx,org,c.locationId,o.itemId);
   }
   await reconcile();
  }
  if(c.type!=='butchery.process')await tx.query('INSERT INTO butchery_batches(organization_id,operation_id,payload,result) VALUES($1,$2,$3,$4)',[org,c.operationId,JSON.stringify(c),JSON.stringify({document:c,inputAmount,amount,method,postedAt:new Date().toISOString()} satisfies PostedButchery)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);
  const response:CommandResult={operationId:c.operationId,outcome:'accepted',amount};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(response)]);return response;
 });
}
