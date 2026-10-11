import type {Database} from './database';
import {createHash} from 'node:crypto';
import {BusinessError,menuCommandSchema,salesImportSchema,type Access,type CommandResult,type MenuItem,type ImportedSales,type SalesLine,type SalesStockDeduction,type SalesStockShortage} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {validateMenu,validateSale,salePayload,salesStockRequirements} from '../domain/sales';
import {recipeSnapshot} from './recipes';
import {assertGeneration,planIssue,applyIssue} from './valuation';
import {reconcileStock} from './counts';
type Tx=Pick<Database,'query'>;
export const salesTables=`
CREATE TABLE IF NOT EXISTS menu_items(organization_id text NOT NULL REFERENCES organizations(id),id uuid NOT NULL,source text NOT NULL,code text NOT NULL,revision integer NOT NULL,version_id uuid NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source,code),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id));
CREATE INDEX IF NOT EXISTS menu_version_lookup ON menu_items(organization_id,version_id);
CREATE TABLE IF NOT EXISTS sales_imports(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,location_id text NOT NULL,result jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id));
CREATE INDEX IF NOT EXISTS sales_import_location ON sales_imports(organization_id,location_id);
CREATE TABLE IF NOT EXISTS sales_details(organization_id text NOT NULL,source text NOT NULL,location_id text NOT NULL,business_date date NOT NULL,transaction_id text NOT NULL,line_key text NOT NULL,line_id uuid NOT NULL,import_id uuid NOT NULL,menu_item_id uuid NOT NULL,version_id uuid NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(organization_id,source,location_id,business_date,transaction_id,line_key),UNIQUE(organization_id,line_id),FOREIGN KEY(organization_id,import_id) REFERENCES sales_imports(organization_id,operation_id),FOREIGN KEY(organization_id,menu_item_id) REFERENCES menu_items(organization_id,id),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id));
CREATE INDEX IF NOT EXISTS sales_detail_import ON sales_details(organization_id,import_id);
CREATE INDEX IF NOT EXISTS sales_detail_menu ON sales_details(organization_id,menu_item_id);
CREATE INDEX IF NOT EXISTS sales_detail_version ON sales_details(organization_id,version_id);
CREATE INDEX IF NOT EXISTS sales_detail_location ON sales_details(organization_id,location_id,business_date);
`;
export async function salesSnapshot(tx:Tx,org:string){return {menuItems:(await tx.query<{payload:MenuItem;revision:number}>('SELECT payload,revision FROM menu_items WHERE organization_id=$1 ORDER BY source,code',[org])).rows.map(r=>({...r.payload,revision:r.revision})),salesImports:(await tx.query<{result:ImportedSales}>('SELECT result FROM sales_imports WHERE organization_id=$1 ORDER BY posted_at DESC',[org])).rows.map(r=>r.result)};}
function authorize(access:Access,org:string){if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بمبيعات هذه المؤسسة.',403);}
const hash=(input:unknown)=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
function stockMovementId(importId:string,itemId:string,date:string){const h=hash(['sales-stock',importId,itemId,date]);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
async function previous(tx:Tx,org:string,id:string,digest:string){const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,id])).rows[0];if(prior&&prior.payload_hash!==digest)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior?.result;}
async function record(tx:Tx,access:Access,id:string,digest:string,action:string){const r:CommandResult={operationId:id,outcome:'accepted'};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[access.organizationId,id,digest,JSON.stringify(r)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[access.organizationId,access.userId,id,action]);return r;}
export async function postMenuItem(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 const p=menuCommandSchema.safeParse(input);if(!p.success)throw new BusinessError('INVALID_MENU','راجع كود البيع والإصدار والكمية.',400);const c=p.data,org=c.organizationId,digest=hash(c);authorize(access,org);
 try{return await db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);const prior=await previous(tx,org,c.operationId,digest);if(prior)return prior;
  const current=(await tx.query<{revision:number;payload:MenuItem}>('SELECT revision,payload FROM menu_items WHERE organization_id=$1 AND id=$2',[org,c.record.id])).rows[0];if((current?.revision??0)!==c.expectedRevision)throw new BusinessError('REVISION_CONFLICT','تغير صنف البيع؛ ألغِ الإجراء المرفوض وافتح أحدث تعريف.');
  if(current&&(current.payload.source!==c.record.source||current.payload.code!==c.record.code))throw new BusinessError('IMMUTABLE_CODE','مصدر وكود البيع ثابتان؛ أضف صنفاً جديداً للكود الآخر.');validateMenu(await recipeSnapshot(tx,org),c.record);
  await tx.query('INSERT INTO menu_items(organization_id,id,source,code,revision,version_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,id) DO UPDATE SET revision=$5,version_id=$6,payload=$7',[org,c.record.id,c.record.source,c.record.code,c.expectedRevision+1,c.record.versionId,JSON.stringify(c.record)]);
  return record(tx,access,c.operationId,digest,c.type);
 });}catch(e){if((e as {code?:string}).code==='23505')throw new BusinessError('DUPLICATE_MENU','كود البيع مستخدم لهذا المصدر.');throw e;}
}
export async function postSalesImport(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 const p=salesImportSchema.safeParse(input);if(!p.success)throw new BusinessError('INVALID_SALES','راجع تفاصيل المبيعات المكتملة والمعرّفات والمبالغ.',400);const c=p.data,org=c.organizationId,digest=hash(c);authorize(access,org);
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);const prior=await previous(tx,org,c.operationId,digest);if(prior)return prior;
  if(!(await tx.query('SELECT 1 FROM locations WHERE organization_id=$1 AND id=$2 AND active',[org,c.locationId])).rows.length)throw new BusinessError('INVALID_REFERENCE','اختر موقعاً نشطاً لهذه المؤسسة.');
  if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[org,c.lines.map(l=>l.lineId)])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف سطر المبيعات مستخدم بالفعل.');
  const versions=await recipeSnapshot(tx,org),menus={menuItems:(await tx.query<{payload:MenuItem;revision:number}>('SELECT payload,revision FROM menu_items WHERE organization_id=$1',[org])).rows.map(r=>({...r.payload,revision:r.revision}))},acceptedLineIds:string[]=[],duplicateLineIds:string[]=[],fresh:SalesLine[]=[];let total=decimal('0');
  for(const l of c.lines){const old=(await tx.query<{payload:SalesLine}>('SELECT payload FROM sales_details WHERE organization_id=$1 AND source=$2 AND location_id=$3 AND business_date=$4 AND transaction_id=$5 AND line_key=$6',[org,c.source,c.locationId,l.businessDate,l.transactionId,l.lineKey])).rows[0];
   if(old){if(salePayload(old.payload)!==salePayload(l))throw new BusinessError('EXTERNAL_CONFLICT','تفصيل البيع مستورد ببيانات مختلفة؛ لم يحفظ أي سطر من الملف.');duplicateLineIds.push(l.lineId);}else{validateSale({...versions,menuItems:menus.menuItems},c.source,l);acceptedLineIds.push(l.lineId);fresh.push(l);total=total.add(l.netAmount);}}
  const requirements=salesStockRequirements(versions,fresh),stockDeductions:SalesStockDeduction[]=[],stockShortages:SalesStockShortage[]=[];let stockAmount=decimal('0');
  const before=requirements.length?await reconcileStock(tx,org):[];
  for(const r of requirements){
   if(before.some(b=>b.locationId===c.locationId&&b.itemId===r.itemId&&!b.matches))throw new BusinessError('RECONCILIATION_MISMATCH','رصيد مادة الخصم وحركاتها وطبقاتها غير متطابقة.');
   if(!(await tx.query('SELECT 1 FROM items WHERE organization_id=$1 AND id=$2 AND active',[org,r.itemId])).rows.length)throw new BusinessError('INVALID_REFERENCE','مادة الخصم غير نشطة أو غير متاحة لهذه المؤسسة.');
   const balance=(await tx.query<{quantity:string}>('SELECT quantity::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[org,c.locationId,r.itemId])).rows[0];
   const quantity=decimal(balance?.quantity??'0').lt(r.quantity)?decimal(balance?.quantity??'0').toFixed(6):r.quantity;
   const shortage=decimal(r.quantity).sub(quantity);if(shortage.gt(0))stockShortages.push({itemId:r.itemId,businessDate:r.businessDate,requiredQuantity:r.quantity,deductedQuantity:quantity,shortageQuantity:shortage.toFixed(6)});
   if(decimal(quantity).isZero())continue;
   const movementId=stockMovementId(c.operationId,r.itemId,r.businessDate);
   if([c.operationId,...c.lines.map(l=>l.lineId)].includes(movementId)||(await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=$2 UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=$2',[org,movementId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف حركة خصم البيع مستخدم بالفعل.');
   const plan=await planIssue(tx,org,c.locationId,r.itemId,quantity);
   await applyIssue(tx,org,c.locationId,r.itemId,movementId,quantity,plan);
   await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[org,movementId,c.locationId,r.itemId,decimal(quantity).neg().toString(),decimal(plan.amount).neg().toFixed(12),'sales.issue',c.reference,r.businessDate]);
   const deduction={...r,quantity,movementId,amount:plan.amount};stockDeductions.push(deduction);stockAmount=stockAmount.add(plan.amount);
   await record(tx,access,movementId,hash(['sales-stock',c.operationId,deduction]),'sales.issue');
  }
  const after=requirements.length?await reconcileStock(tx,org):[];if(after.some(b=>b.locationId===c.locationId&&requirements.some(r=>r.itemId===b.itemId)&&!b.matches))throw new BusinessError('RECONCILIATION_MISMATCH','فشلت مطابقة خصم البيع؛ لم تقبل المبيعات أو أي خصم.');
  const result:ImportedSales={document:c,acceptedLineIds,duplicateLineIds,netAmount:total.toFixed(6),postedAt:new Date().toISOString(),stockDeductions,stockShortages,stockDeductionAmount:stockAmount.toFixed(12)};await tx.query('INSERT INTO sales_imports(organization_id,operation_id,location_id,result) VALUES($1,$2,$3,$4)',[org,c.operationId,c.locationId,JSON.stringify(result)]);
  for(const l of fresh)await tx.query('INSERT INTO sales_details VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[org,c.source,c.locationId,l.businessDate,l.transactionId,l.lineKey,l.lineId,c.operationId,l.menuItemId,l.versionId,JSON.stringify(l)]);
  for(const l of c.lines)await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,l.lineId,hash(['sales-line',c.operationId,l.lineId]),JSON.stringify({operationId:l.lineId,outcome:'accepted'})]);return record(tx,access,c.operationId,digest,c.type);
 });
}
