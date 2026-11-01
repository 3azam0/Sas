import { PGlite } from '@electric-sql/pglite';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import {acquireFileLock} from '../../scripts/file-lock.mjs';
import { commandSchema,BusinessError,type Access,type Command,type Snapshot,type Layer,type Item,type Location,type Balance,type Entry,type CommandResult } from '@saas/contracts';
import {decimal} from '@saas/domain';
import {schema} from './schema';
import {stockMove,refreshStockPool} from './valuation';
import {assignReference,backfillReferences,operationPrefix} from './references';
import {workshopSnapshot} from './workshop';
export {postWorkshopCommand} from './workshop';
export async function createDatabase(path?:string) { if(path) await mkdir(path,{recursive:true});const release=path?acquireFileLock(join(path,'.fodo.lock')):()=>{};const onExit=()=>release();process.once('exit',onExit);try{const db=await PGlite.create(path);const originalClose=db.close.bind(db);db.close=async()=>{try{await originalClose();}finally{process.removeListener('exit',onExit);release();}};await db.exec(schema);await db.transaction(async tx=>{
 const done=await tx.query("SELECT 1 FROM inventory_settings WHERE key='weighted-average-v1'");
 if(!done.rows.length){
  const balances=await tx.query<{organization_id:string;location_id:string;item_id:string}>("SELECT organization_id,location_id,item_id FROM stock_balances");
  for(const b of balances.rows)await refreshStockPool(tx,b.organization_id,b.location_id,b.item_id,'0');
  await tx.query("INSERT INTO inventory_settings VALUES('weighted-average-v1','posting-order; historical values retained')");
 }
const referencesDone=await tx.query("SELECT 1 FROM inventory_settings WHERE key='automatic-references-v1'");
 if(!referencesDone.rows.length){await backfillReferences(tx);await tx.query("INSERT INTO inventory_settings VALUES('automatic-references-v1','existing codes retained')");}
});return db;}catch(error){process.removeListener('exit',onExit);release();throw error;} }
export async function seed(db:PGlite) {
  await db.transaction(async tx=>{
    for(const [org,name] of [['grills','مجموعة المشاوي'],['bistro','مطاعم بيت المذاق']]) {
      const exists=await tx.query('SELECT id FROM organizations WHERE id=$1',[org]); if(exists.rows.length) continue;
      await tx.query('INSERT INTO organizations VALUES($1,$2)',[org,name]);
      for(const [id,label,kind] of [['central','المخزن والمطبخ المركزي','تخزين وتحضير'],['cairo','فرع القاهرة','مطعم'],['alex','فرع الإسكندرية','مطعم']]) await tx.query('INSERT INTO locations VALUES($1,$2,$3,$4)',[org,id,label,kind]);
      for(const [id,label,sku,category,unit,min] of [['beef','لحم بقري','MT-001','لحوم','كجم','8'],['chicken','دجاج طازج','MT-002','دواجن','كجم','10'],['rice','أرز مصري','DR-001','مواد جافة','كجم','15'],['pepper','فلفل أسود','SP-001','توابل','جم','250'],['box','علبة وجبة','PK-001','تغليف','قطعة','50']]) {
        await tx.query('INSERT INTO items(organization_id,id,name,sku,category,unit,minimum) VALUES($1,$2,$3,$4,$5,$6,$7)',[org,id,label,sku,category,unit,min]);
        for(const location of ['central','cairo','alex']) {
          const q=id==='pepper'?'1500':id==='box'?'120':id==='rice'?'45':'20';
          const cost=id==='beef'?'415':id==='chicken'?'145':id==='rice'?'32':id==='pepper'?'0.8':'3.5';
          const op=randomUUID(); const amount=decimal(q).mul(cost).toFixed(12);
          const row=await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING sequence',[org,op,location,id,q,amount,'opening','رصيد تجريبي افتتاحي','2026-10-09']);
          await tx.query('INSERT INTO cost_layers(organization_id,id,location_id,item_id,remaining,unit_cost,sequence,remaining_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,randomUUID(),location,id,q,cost,row.rows[0].sequence,amount]);
          await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,$4,$5)',[org,location,id,q,amount]);
        }
      }
    }
    for(const org of ['grills','bistro']) {
      await tx.query('INSERT INTO locations VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[org,'butchery','الجزارة · المطبخ المركزي','جزارة']);
      await tx.query("UPDATE items SET meat_kind='beef_input' WHERE organization_id=$1 AND id='beef' AND meat_kind IS NULL",[org]);
    }
  });
}
const globalDB=globalThis as typeof globalThis & {saasDatabase?:Promise<PGlite>};
export function database() { return globalDB.saasDatabase ??= (async()=>{const db=await createDatabase(process.env.SAAS_DATA_DIR || resolve('.data'));await seed(db);return db;})(); }
export async function postCommand(db:PGlite,access:Access,input:unknown):Promise<CommandResult> {
  const parsed=commandSchema.safeParse(input); if(!parsed.success) throw new BusinessError('INVALID_COMMAND','تحقق من بيانات العملية',400);
  const c=parsed.data;
  if(c.organizationId!==access.organizationId || (!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())) throw new BusinessError('FORBIDDEN','ليس لديك صلاحية',403);
  const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
  return db.transaction(async tx=>{
    // PGlite serializes transactions; this tenant row also provides a real PG lock boundary.
    await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[access.organizationId]);
    const prior=await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId]);
    if(prior.rows[0]) {if(prior.rows[0].payload_hash!==hash) throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة');return prior.rows[0].result;}
    const valid=await tx.query('SELECT 1 FROM locations l JOIN items i ON i.organization_id=l.organization_id WHERE l.organization_id=$1 AND l.id=$2 AND i.id=$3',[c.organizationId,c.locationId,c.itemId]);
    if(!valid.rows.length) throw new BusinessError('FORBIDDEN','الموقع أو المادة خارج نطاق المؤسسة',403);
    const reference=await assignReference(tx,c.organizationId,'operation',c.operationId,operationPrefix(c.type));
    const posted=await stockMove(tx,c.organizationId,{...c,reason:c.reason||reference},c.locationId,c.itemId,c.type==='receipt.post'?c.quantity:decimal(c.quantity).neg().toFixed(6),c.type==='receipt.post'?decimal(c.quantity).mul(c.unitCost!).toFixed(12):undefined);
    const amount=posted.amount;
    await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);
    const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount,reference};
    await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);
    return result;
  });
}
export async function getSnapshot(db:PGlite,access:Access):Promise<Snapshot> {
  if((!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())) throw new BusinessError('AUTH_REQUIRED','انتهت الجلسة',401);
  return db.transaction(async tx=>{
    const org=access.organizationId;
    const organization=await tx.query<{name:string}>('SELECT name FROM organizations WHERE id=$1',[org]);
    if(!organization.rows[0]) throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة',403);
    const locations=await tx.query<Location>('SELECT id,name,kind FROM locations WHERE organization_id=$1 ORDER BY id',[org]);
    const items=await tx.query<Item>('SELECT id,name,sku,category,unit,role,minimum::text,meat_kind AS "meatKind" FROM items WHERE organization_id=$1 ORDER BY sku',[org]);
    const balances=await tx.query<Balance>('SELECT (SELECT COALESCE(max(e.sequence),0)::text FROM stock_entries e WHERE e.organization_id=b.organization_id AND e.location_id=b.location_id AND e.item_id=b.item_id) AS revision,location_id AS "locationId",item_id AS "itemId",quantity::text,value::text,CASE WHEN quantity>0 THEN (value/quantity)::text ELSE NULL END AS average FROM stock_balances b WHERE organization_id=$1',[org]);
    const layers=await tx.query<Layer>('SELECT id,location_id AS "locationId",item_id AS "itemId",remaining::text,remaining_value::text AS "remainingValue",unit_cost::text AS "unitCost",sequence FROM cost_layers WHERE organization_id=$1 AND remaining>0 ORDER BY sequence',[org]);
    const entries=await tx.query<Entry>('SELECT (SELECT r.code FROM document_references r WHERE r.organization_id=e.organization_id AND r.entity_kind=\'operation\' AND r.entity_id=e.operation_id::text) AS reference,operation_id AS "operationId",location_id AS "locationId",item_id AS "itemId",quantity::text,amount::text,type,reason,business_date::text AS "businessDate",posted_at::text AS "postedAt" FROM stock_entries e WHERE organization_id=$1 ORDER BY sequence DESC LIMIT 100',[org]);
    const receipts=await tx.query<{id:string}>('SELECT operation_id::text AS id FROM command_receipts WHERE organization_id=$1',[org]);
    return {organizationId:org,organizationName:organization.rows[0].name,access,locations:locations.rows,items:items.rows,balances:balances.rows,layers:layers.rows,entries:entries.rows,acceptedOperationIds:receipts.rows.map(x=>x.id),fetchedAt:new Date().toISOString(),currency:'EGP',costingMethod:'weighted_average',...await workshopSnapshot(tx,org)};
  });
}
