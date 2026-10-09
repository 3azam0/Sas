import { PGlite } from '@electric-sql/pglite';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import {acquireFileLock} from '../../scripts/file-lock.mjs';
import { commandSchema,BusinessError,type Access,type Command,type Snapshot,type Layer,type Item,type Location,type Balance,type Entry,type CommandResult } from '@saas/contracts';
import {allocateFIFO,decimal} from '@saas/domain';
import {schema} from './schema';
export async function createDatabase(path?:string) { if(path) await mkdir(path,{recursive:true});const release=path?acquireFileLock(join(path,'.fodo.lock')):()=>{};const onExit=()=>release();process.once('exit',onExit);try{const db=await PGlite.create(path);const originalClose=db.close.bind(db);db.close=async()=>{try{await originalClose();}finally{process.removeListener('exit',onExit);release();}};await db.exec(schema);return db;}catch(error){process.removeListener('exit',onExit);release();throw error;} }
export async function seed(db:PGlite) {
  await db.transaction(async tx=>{
    for(const [org,name] of [['grills','مجموعة المشاوي'],['bistro','مطاعم بيت المذاق']]) {
      const exists=await tx.query('SELECT id FROM organizations WHERE id=$1',[org]); if(exists.rows.length) continue;
      await tx.query('INSERT INTO organizations VALUES($1,$2)',[org,name]);
      for(const [id,label,kind] of [['central','المخزن والمطبخ المركزي','تخزين وتحضير'],['cairo','فرع القاهرة','مطعم'],['alex','فرع الإسكندرية','مطعم']]) await tx.query('INSERT INTO locations VALUES($1,$2,$3,$4)',[org,id,label,kind]);
      for(const [id,label,sku,category,unit,min] of [['beef','لحم بقري','MT-001','لحوم','كجم','8'],['chicken','دجاج طازج','MT-002','دواجن','كجم','10'],['rice','أرز مصري','DR-001','مواد جافة','كجم','15'],['pepper','فلفل أسود','SP-001','توابل','جم','250'],['box','علبة وجبة','PK-001','تغليف','قطعة','50']]) {
        await tx.query('INSERT INTO items VALUES($1,$2,$3,$4,$5,$6,$7)',[org,id,label,sku,category,unit,min]);
        for(const location of ['central','cairo','alex']) {
          const q=id==='pepper'?'1500':id==='box'?'120':id==='rice'?'45':'20';
          const cost=id==='beef'?'415':id==='chicken'?'145':id==='rice'?'32':id==='pepper'?'0.8':'3.5';
          const op=randomUUID(); const amount=decimal(q).mul(cost).toFixed(12);
          const row=await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING sequence',[org,op,location,id,q,amount,'opening','رصيد تجريبي افتتاحي','2026-10-09']);
          await tx.query('INSERT INTO cost_layers VALUES($1,$2,$3,$4,$5,$6,$7)',[org,randomUUID(),location,id,q,cost,row.rows[0].sequence]);
          await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,$4,$5)',[org,location,id,q,amount]);
        }
      }
    }
  });
}
const globalDB=globalThis as typeof globalThis & {saasDatabase?:Promise<PGlite>};
export function database() { return globalDB.saasDatabase ??= (async()=>{const db=await createDatabase(process.env.SAAS_DATA_DIR || resolve('.data'));await seed(db);return db;})(); }
export async function postCommand(db:PGlite,access:Access,input:unknown):Promise<CommandResult> {
  const parsed=commandSchema.safeParse(input); if(!parsed.success) throw new BusinessError('INVALID_COMMAND','تحقق من بيانات العملية',400);
  const c=parsed.data;
  if(c.organizationId!==access.organizationId || Date.parse(access.expiresAt)<=Date.now()) throw new BusinessError('FORBIDDEN','ليس لديك صلاحية',403);
  const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
  return db.transaction(async tx=>{
    // PGlite serializes transactions; this tenant row also provides a real PG lock boundary.
    await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[access.organizationId]);
    const prior=await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId]);
    if(prior.rows[0]) {if(prior.rows[0].payload_hash!==hash) throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة');return prior.rows[0].result;}
    const valid=await tx.query('SELECT 1 FROM locations l JOIN items i ON i.organization_id=l.organization_id WHERE l.organization_id=$1 AND l.id=$2 AND i.id=$3',[c.organizationId,c.locationId,c.itemId]);
    if(!valid.rows.length) throw new BusinessError('FORBIDDEN','الموقع أو المادة خارج نطاق المؤسسة',403);
    await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,0,0) ON CONFLICT DO NOTHING',[c.organizationId,c.locationId,c.itemId]);
    await tx.query('SELECT quantity FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[c.organizationId,c.locationId,c.itemId]);
    let amount:string;
    if(c.type==='waste.post') {
      const rows=await tx.query<Layer>('SELECT id, location_id AS "locationId", item_id AS "itemId", remaining::text, unit_cost::text AS "unitCost", sequence FROM cost_layers WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining>0 ORDER BY sequence,id FOR UPDATE',[c.organizationId,c.locationId,c.itemId]);
      const allocation=allocateFIFO(rows.rows,c.quantity);amount=allocation.amount;
      for(const part of allocation.allocations) {
        await tx.query('UPDATE cost_layers SET remaining=remaining-$3::numeric WHERE organization_id=$1 AND id=$2',[c.organizationId,part.layerId,part.quantity]);
        await tx.query('INSERT INTO layer_allocations VALUES($1,$2,$3,$4,$5)',[c.organizationId,c.operationId,part.layerId,part.quantity,part.amount]);
      }
    } else amount=decimal(c.quantity).mul(c.unitCost!).toFixed(12);
    const sign=c.type==='receipt.post'?1:-1;
    const entry=await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING sequence',[c.organizationId,c.operationId,c.locationId,c.itemId,decimal(c.quantity).mul(sign).toFixed(6),decimal(amount).mul(sign).toFixed(12),c.type,c.reason,c.businessDate]);
    if(sign===1) await tx.query('INSERT INTO cost_layers VALUES($1,$2,$3,$4,$5,$6,$7)',[c.organizationId,randomUUID(),c.locationId,c.itemId,c.quantity,c.unitCost,entry.rows[0].sequence]);
    await tx.query('UPDATE stock_balances SET quantity=quantity+$4::numeric, value=value+$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[c.organizationId,c.locationId,c.itemId,decimal(c.quantity).mul(sign).toFixed(6),decimal(amount).mul(sign).toFixed(12)]);
    await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);
    const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount};
    await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);
    return result;
  });
}
export async function getSnapshot(db:PGlite,access:Access):Promise<Snapshot> {
  if(Date.parse(access.expiresAt)<=Date.now()) throw new BusinessError('AUTH_REQUIRED','انتهت الجلسة',401);
  return db.transaction(async tx=>{
    const org=access.organizationId;
    const organization=await tx.query<{name:string}>('SELECT name FROM organizations WHERE id=$1',[org]);
    if(!organization.rows[0]) throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة',403);
    const locations=await tx.query<Location>('SELECT id,name,kind FROM locations WHERE organization_id=$1 ORDER BY id',[org]);
    const items=await tx.query<Item>('SELECT id,name,sku,category,unit,minimum::text FROM items WHERE organization_id=$1 ORDER BY sku',[org]);
    const balances=await tx.query<Balance>('SELECT location_id AS "locationId",item_id AS "itemId",quantity::text,value::text,CASE WHEN quantity>0 THEN (value/quantity)::text ELSE NULL END AS average FROM stock_balances WHERE organization_id=$1',[org]);
    const layers=await tx.query<Layer>('SELECT id,location_id AS "locationId",item_id AS "itemId",remaining::text,unit_cost::text AS "unitCost",sequence FROM cost_layers WHERE organization_id=$1 AND remaining>0 ORDER BY sequence',[org]);
    const entries=await tx.query<Entry>('SELECT operation_id AS "operationId",location_id AS "locationId",item_id AS "itemId",quantity::text,amount::text,type,reason,business_date::text AS "businessDate",posted_at::text AS "postedAt" FROM stock_entries WHERE organization_id=$1 ORDER BY sequence DESC LIMIT 100',[org]);
    const receipts=await tx.query<{id:string}>('SELECT operation_id::text AS id FROM command_receipts WHERE organization_id=$1',[org]);
    return {organizationId:org,organizationName:organization.rows[0].name,access,locations:locations.rows,items:items.rows,balances:balances.rows,layers:layers.rows,entries:entries.rows,acceptedOperationIds:receipts.rows.map(x=>x.id),fetchedAt:new Date().toISOString(),currency:'EGP'};
  });
}
