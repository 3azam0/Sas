import {createHash} from 'node:crypto';
import {BusinessError,kitchenOrderCommandSchema,type Access,type CommandResult,type ImportedSales,type KitchenTicket} from '@saas/contracts';
import type {Database,QueryDatabase} from './database';
import {assertGeneration} from './valuation';
import {validateKitchenTransition} from '../domain/kitchen-display';
export const kitchenDisplayTables=`
CREATE TABLE IF NOT EXISTS pos_kitchen_actions(
 organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,sale_id uuid NOT NULL,kitchen_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),state text NOT NULL CHECK(state IN ('preparing','ready','collected')),payload jsonb NOT NULL,actor text NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,operation_id),UNIQUE(organization_id,sale_id,revision),
 FOREIGN KEY(organization_id,sale_id) REFERENCES sales_imports(organization_id,operation_id),FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id)
);
CREATE INDEX IF NOT EXISTS pos_kitchen_scope ON pos_kitchen_actions(organization_id,kitchen_id,sale_id,revision DESC);
`;
export async function kitchenDisplaySnapshot(tx:QueryDatabase,org:string):Promise<{kitchenTickets:KitchenTicket[]}>{const rows=(await tx.query<{sale_id:string;kitchen_id:string;revision:number;state:KitchenTicket['state'];posted_at:Date|string;actor:string}>('SELECT DISTINCT ON (sale_id) sale_id,kitchen_id,revision,state,posted_at,actor FROM pos_kitchen_actions WHERE organization_id=$1 ORDER BY sale_id,revision DESC',[org])).rows;return {kitchenTickets:rows.map(r=>({saleId:r.sale_id,kitchenId:r.kitchen_id,revision:r.revision,state:r.state,updatedAt:new Date(r.posted_at).toISOString(),actor:r.actor}))};}
export async function postKitchenOrder(db:Database,access:Access,input:unknown):Promise<CommandResult>{const parsed=kitchenOrderCommandSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_KITCHEN_ORDER','راجع الطلب وحالة التجهيز.',400);const c=parsed.data;if(c.organizationId!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بتحديث هذا المطبخ.',403);const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');return db.transaction(async tx=>{
 await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[c.organizationId]);await assertGeneration(tx,c.organizationId,c.generation);
 const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows[0];if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرف التحديث مستخدم لبيانات أخرى.');return prior.result;}
 const sale=(await tx.query<{result:ImportedSales}>('SELECT result FROM sales_imports WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.saleId])).rows[0]?.result;
 if(!sale?.document.checkout||sale.document.kitchenId!==c.kitchenId||!sale.acceptedLineIds.length)throw new BusinessError('INVALID_KITCHEN_ORDER','الطلب ليس بيعاً نقدياً مقبولاً لهذا المطبخ.');
 if(!(await tx.query('SELECT 1 FROM kitchens WHERE organization_id=$1 AND id=$2 AND active',[c.organizationId,c.kitchenId])).rows.length)throw new BusinessError('INVALID_KITCHEN','المطبخ غير نشط أو خارج المؤسسة.');
 const previous=(await tx.query<{revision:number;state:KitchenTicket['state']}>('SELECT revision,state FROM pos_kitchen_actions WHERE organization_id=$1 AND sale_id=$2 ORDER BY revision DESC LIMIT 1',[c.organizationId,c.saleId])).rows[0];if((previous?.revision??0)!==c.expectedRevision)throw new BusinessError('KITCHEN_REVISION_CONFLICT','تغيرت حالة الطلب من شاشة أخرى. حدّث الطلب وراجع الحالة.');validateKitchenTransition(previous?.state??'new',c.state);
 await tx.query('INSERT INTO pos_kitchen_actions(organization_id,operation_id,sale_id,kitchen_id,revision,state,payload,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[c.organizationId,c.operationId,c.saleId,c.kitchenId,c.expectedRevision+1,c.state,JSON.stringify(c),access.userId]);
 const result:CommandResult={operationId:c.operationId,outcome:'accepted'};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);return result;
 });}
