import {kitchenIssueSnapshot} from './kitchen-issues';
import {organizationProfileSchema} from '@saas/contracts';
import {salesSnapshot} from './sales';
import {financeSnapshot} from './finance';
import {kitchenDisplaySnapshot} from './kitchen-display';
import {productionSnapshot} from './production';
import {recipeSnapshot} from './recipes';
import {assertGeneration,planIssue,applyIssue} from './valuation';
import {countSnapshot} from './counts';
import {transferSnapshot} from './transfers';
import { createHash } from 'node:crypto';
import { commandSchema,BusinessError,type Access,type CostingMethod,type Snapshot,type Layer,type Item,type Location,type Balance,type Entry,type CommandResult,type Kitchen,type PointOfSale,type Unit,type Supplier,type PostedOpening,type PostedReceiptDocument } from '@saas/contracts';
import {decimal} from '@saas/domain';
import {purchaseSnapshot} from './purchasing';
import {addIncomingStock} from './incoming';
import type {Database} from "./database";
export async function postCommand(db:Database,access:Access,input:unknown):Promise<CommandResult> {
  const parsed=commandSchema.safeParse(input); if(!parsed.success) throw new BusinessError('INVALID_COMMAND','تحقق من بيانات العملية',400);
  const c=parsed.data;
  if(c.organizationId!==access.organizationId || Date.parse(access.expiresAt)<=Date.now()) throw new BusinessError('FORBIDDEN','ليس لديك صلاحية',403);
  const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
  return db.transaction(async tx=>{
    // PGlite serializes transactions; this tenant row also provides a real PG lock boundary.
    await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[access.organizationId]);await assertGeneration(tx,c.organizationId,c.generation);
    const prior=await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId]);
    if(prior.rows[0]) {if(prior.rows[0].payload_hash!==hash) throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة');return prior.rows[0].result;}
    const valid=await tx.query('SELECT 1 FROM locations l JOIN items i ON i.organization_id=l.organization_id WHERE l.organization_id=$1 AND l.id=$2 AND i.id=$3',[c.organizationId,c.locationId,c.itemId]);
    if(!valid.rows.length) throw new BusinessError('FORBIDDEN','الموقع أو المادة خارج نطاق المؤسسة',403);
    const definition=(await tx.query<Item>('SELECT active,unit_id AS "unitId",purchase_units AS "purchaseUnits" FROM items WHERE organization_id=$1 AND id=$2',[c.organizationId,c.itemId])).rows[0];
    const site=(await tx.query<{active:boolean}>('SELECT active FROM locations WHERE organization_id=$1 AND id=$2',[c.organizationId,c.locationId])).rows[0];
    if(!definition.active||!site.active)throw new BusinessError('INACTIVE_RECORD','المادة أو الموقع غير نشط. راجع العملية.');
    if(c.supplierId){const supplier=(await tx.query('SELECT 1 FROM suppliers WHERE organization_id=$1 AND id=$2 AND active',[c.organizationId,c.supplierId])).rows;if(!supplier.length)throw new BusinessError('INVALID_SUPPLIER','المورد غير نشط أو غير متاح في المؤسسة.');}
    if(c.purchaseUnitId){const pack=definition.purchaseUnits?.find(p=>p.id===c.purchaseUnitId);const converted=pack?decimal(c.enteredQuantity!).mul(pack.factor):null;if(!converted||converted.decimalPlaces()>6||!converted.eq(c.quantity))throw new BusinessError('INVALID_CONVERSION','كمية وحدة الشراء لا تطابق كمية المخزون.');}
    await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,0,0) ON CONFLICT DO NOTHING',[c.organizationId,c.locationId,c.itemId]);
    await tx.query('SELECT quantity FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[c.organizationId,c.locationId,c.itemId]);
    let amount:string;
    if(c.type==='waste.post') {
      const allocation=await planIssue(tx,c.organizationId,c.locationId,c.itemId,c.quantity);amount=allocation.amount;
      await applyIssue(tx,c.organizationId,c.locationId,c.itemId,c.operationId,c.quantity,allocation);
      await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[c.organizationId,c.operationId,c.locationId,c.itemId,decimal(c.quantity).neg().toFixed(6),decimal(amount).neg().toFixed(12),c.type,c.reason,c.businessDate]);

    } else amount=await addIncomingStock(tx,{...c,unitCost:c.unitCost!});
    if(c.supplierId||c.purchaseUnitId)await tx.query('UPDATE stock_entries SET supplier_id=$3,purchase_unit_id=$4,entered_quantity=$5 WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId,c.supplierId??null,c.purchaseUnitId??null,c.enteredQuantity??null]);
    await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);
    const result:CommandResult={operationId:c.operationId,outcome:'accepted',amount};
    await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);
    return result;
  });
}
export async function getSnapshot(db:Database,access:Access):Promise<Snapshot> {
  if(Date.parse(access.expiresAt)<=Date.now()) throw new BusinessError('AUTH_REQUIRED','انتهت الجلسة',401);
  return db.transaction(async tx=>{
    const org=access.organizationId;
    const organization=await tx.query<{name:string;profile:unknown;generation:string;method:CostingMethod;revision:number}>('SELECT name,profile,generation::text,costing_method AS method,costing_revision AS revision FROM organizations WHERE id=$1 FOR SHARE',[org]);
    if(!organization.rows[0]) throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة',403);
    const units=await tx.query<Unit>('SELECT id,name,revision FROM units WHERE organization_id=$1 ORDER BY name',[org]);
    const kitchens=await tx.query<Kitchen>('SELECT id,name,active,revision,location_id AS "locationId",parent_location_id AS "parentLocationId" FROM kitchens WHERE organization_id=$1 ORDER BY name',[org]);
    const pointsOfSale=await tx.query<PointOfSale>('SELECT id,name,source,kitchen_id AS "kitchenId",active,revision FROM points_of_sale WHERE organization_id=$1 ORDER BY name',[org]);
    const suppliers=await tx.query<Supplier>('SELECT id,name,phone,email,address,active,revision FROM suppliers WHERE organization_id=$1 ORDER BY name',[org]);
    const locations=await tx.query<Location>('SELECT l.id,l.name,l.kind,l.active,l.revision,k.id AS "kitchenId",k.parent_location_id AS "parentLocationId" FROM locations l LEFT JOIN kitchens k ON k.organization_id=l.organization_id AND k.location_id=l.id WHERE l.organization_id=$1 ORDER BY l.id',[org]);
    const items=await tx.query<Item>('SELECT id,name,sku,category,unit,minimum::text,unit_id AS "unitId",purchase_units AS "purchaseUnits",active,revision FROM items WHERE organization_id=$1 ORDER BY sku',[org]);
    const balances=await tx.query<Balance>('SELECT location_id AS "locationId",item_id AS "itemId",quantity::text,value::text,CASE WHEN quantity>0 THEN (value/quantity)::text ELSE NULL END AS average FROM stock_balances WHERE organization_id=$1',[org]);
    const layers=await tx.query<Layer>('SELECT id,location_id AS "locationId",item_id AS "itemId",remaining::text,unit_cost::text AS "unitCost",COALESCE(remaining_value,remaining*unit_cost)::text AS "remainingValue",sequence FROM cost_layers WHERE organization_id=$1 AND remaining>0 ORDER BY sequence',[org]);
    const entries=await tx.query<Entry>('SELECT operation_id AS "operationId",location_id AS "locationId",item_id AS "itemId",quantity::text,amount::text,receipt_document_id AS "receiptDocumentId",reference_amount::text AS "referenceAmount",type,reason,business_date::text AS "businessDate",posted_at::text AS "postedAt",supplier_id AS "supplierId",purchase_unit_id AS "purchaseUnitId",entered_quantity::text AS "enteredQuantity",purchase_receipt_id AS "purchaseReceiptId",purchase_order_line_id AS "purchaseOrderLineId",supplier_return_id AS "supplierReturnId",transfer_id AS "transferId",transfer_line_id AS "transferLineId",production_id AS "productionId",count_id AS "countId",count_line_id AS "countLineId",kitchen_issue_id AS "kitchenIssueId" FROM stock_entries WHERE organization_id=$1 ORDER BY sequence DESC LIMIT 100',[org]);
    const receipts=await tx.query<{id:string}>('SELECT operation_id::text AS id FROM command_receipts WHERE organization_id=$1',[org]);
    const openings=await tx.query<PostedOpening>('SELECT payload AS document,amount::text,posted_at::text AS "postedAt" FROM opening_documents WHERE organization_id=$1 ORDER BY posted_at DESC LIMIT 100',[org]);
    const receiptDocuments=await tx.query<PostedReceiptDocument>('SELECT payload AS document,amount::text,posted_at::text AS "postedAt" FROM receipt_documents WHERE organization_id=$1 ORDER BY posted_at DESC LIMIT 100',[org]);
    return {capabilities:{counterPOS:1 as const,kitchenDisplay:1 as const},...await kitchenDisplaySnapshot(tx,org),...await financeSnapshot(tx,org),...await kitchenIssueSnapshot(tx,org),receipts:receiptDocuments.rows,generation:organization.rows[0].generation,costing:{method:organization.rows[0].method,revision:organization.rows[0].revision,hasStockHistory:(await tx.query('SELECT 1 FROM stock_entries WHERE organization_id=$1 LIMIT 1',[org])).rows.length>0},organizationId:org,organizationName:organization.rows[0].name,organizationProfile:organizationProfileSchema.parse(organization.rows[0].profile),access,locations:locations.rows,items:items.rows,balances:balances.rows,layers:layers.rows,entries:entries.rows,acceptedOperationIds:receipts.rows.map(x=>x.id),fetchedAt:new Date().toISOString(),currency:'EGP',units:units.rows,kitchens:kitchens.rows,pointsOfSale:pointsOfSale.rows,suppliers:suppliers.rows,openings:openings.rows,...await purchaseSnapshot(tx,org),...await transferSnapshot(tx,org),...await countSnapshot(tx,org),...await recipeSnapshot(tx,org),...await productionSnapshot(tx,org),...await salesSnapshot(tx,org)};
  });
}
