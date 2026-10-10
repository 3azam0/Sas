import type {PGlite} from '@electric-sql/pglite';
import {randomUUID,createHash} from 'node:crypto';
import {BusinessError,costingCommandSchema,type Access,type CostingMethod,type CommandResult} from '@saas/contracts';
import {addIncomingStock} from './incoming';
type Tx=Pick<PGlite,'query'>;
export async function seedDevelopmentStock(tx:Tx,org:string,method:CostingMethod){
 const sites=(await tx.query<{id:string}>('SELECT id FROM locations WHERE organization_id=$1 AND active ORDER BY id',[org])).rows;
 const items=(await tx.query<{id:string}>('SELECT id FROM items WHERE organization_id=$1 AND active ORDER BY id',[org])).rows;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 for(const site of sites)for(const item of items){const id=item.id,quantity=id==='pepper'?'1500':id==='box'?'120':id==='rice'?'45':'20',cost=id==='beef'?'415':id==='chicken'?'145':id==='rice'?'32':id==='pepper'?'0.8':'3.5';const parts=method==='moving_average'&&id==='rice'?[['2','20'],['8','30']]:[[quantity,cost]];for(const [q,c] of parts)await addIncomingStock(tx,{organizationId:org,operationId:randomUUID(),locationId:site.id,itemId:id,quantity:q,unitCost:c,type:'opening',reason:'رصيد تطوير تجريبي',businessDate:today});}
}
const transactionalTables=['transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','command_receipts','audit_events'];
export async function resetDevelopmentOrganization(tx:Tx,org:string,method:CostingMethod,clearCatalog=false){
 for(const table of transactionalTables)await tx.query(`DELETE FROM ${table} WHERE organization_id=$1`,[org]);
 if(clearCatalog)for(const table of ['items','suppliers','units','locations'])await tx.query(`DELETE FROM ${table} WHERE organization_id=$1`,[org]);
 await tx.query('UPDATE organizations SET costing_method=$2,costing_revision=costing_revision+1,generation=gen_random_uuid(),development_baseline=true,development_empty_baseline=true WHERE id=$1',[org,method]);
}
export async function initializeDevelopmentBaseline(db:PGlite){
 if(process.env.SAAS_DEMO_MODE!=='1')return;
 await db.transaction(async tx=>{const orgs=(await tx.query<{id:string}>('SELECT id FROM organizations WHERE NOT development_empty_baseline FOR UPDATE')).rows;for(const org of orgs)await resetDevelopmentOrganization(tx,org.id,'moving_average',true);});
}
// Online development configuration explicitly clears transactions; never converts posted live history.
export async function postCosting(db:PGlite,access:Access,input:unknown):Promise<CommandResult>{
 if(process.env.SAAS_DEMO_MODE!=='1')throw new BusinessError('FORBIDDEN','إعادة بيانات التطوير متاحة في بيئة التطوير فقط.',403);
 const p=costingCommandSchema.safeParse(input);if(!p.success)throw new BusinessError('INVALID_COMMAND','اختر طريقة التكلفة وأكد إعادة البيانات التجريبية.',400);const c=p.data;
 if(c.organizationId!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة غير متاحة لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');return db.transaction(async tx=>{
  const org=(await tx.query<{generation:string;revision:number}>('SELECT generation::text,costing_revision AS revision FROM organizations WHERE id=$1 FOR UPDATE',[c.organizationId])).rows[0];if(!org)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows[0];if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','المعرّف مستخدم لبيانات مختلفة.');return prior.result;}
  if(org.generation!==c.generation)throw new BusinessError('STALE_GENERATION','تمت إعادة البيانات. زامن النسخة الجديدة.');if(org.revision!==c.expectedRevision)throw new BusinessError('STALE_REVISION','تغير إعداد التكلفة. زامن أولاً.');
  await resetDevelopmentOrganization(tx,c.organizationId,c.method);const result:CommandResult={operationId:c.operationId,outcome:'accepted'};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,'costing.reset-development']);return result;
 });
}
